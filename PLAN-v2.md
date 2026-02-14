# Plan v2: Sweepy Web App con Gmail API

## Contexto

Sweepy tiene un backend funcional (Next.js + Supabase + pipeline IA de 3 capas).
La extensión de Chrome con gmail.js era el canal de entrada, pero tiene un techo bajo:
- Solo lee ~50 emails del DOM
- No puede ejecutar acciones
- Frágil ante cambios de Gmail
- UX limitada (side panel)
- Solo Chrome desktop

Después de investigar OpenClaw, Maton.ai, ClawHub, CASA, y múltiples arquitecturas,
la conclusión es: **web app con Gmail API + OAuth propio en el backend**.

- Gmail API da acceso a TODOS los emails (paginado, sin límite)
- Ejecuta acciones reales (batchModify, trash, labels)
- Web app funciona en cualquier dispositivo
- CASA Tier 2 ($540/año) cuando se superen 100 usuarios
- El backend ya tiene todo lo pesado (pipeline IA, billing, DB, auth)

---

## Lo que YA existe y NO cambia

```
✅ Pipeline IA 3 capas (heurísticas → cache → LLM)     ~1,248 líneas
✅ API /api/v1/emails/analyze                            208 líneas
✅ API /api/v1/actions/history + reject                  funcional
✅ API /api/v1/billing/checkout + portal                 funcional
✅ API /api/v1/config (feature flags)                    funcional
✅ Supabase schema (8 tablas + RLS)                      360 líneas
✅ Auth (Supabase Google OAuth)                          funcional
✅ Rate limiting (Upstash Redis)                         funcional
✅ Stripe billing ($5/mes, 7 días trial)                 funcional
✅ Landing page + login + legal pages                    funcional
✅ Shared types (MinimalEmailData, categories, etc.)     ~300 líneas
```

## Lo que se ELIMINA

```
❌ extension/ (directorio completo)
❌ gmail.js, postal-mime, jquery-shim
❌ Content scripts (main-world.ts, isolated.ts)
❌ Service worker (background.ts)
❌ Message bus, email-extractor
❌ Side panel UI
❌ chrome.identity auth flow
❌ API /api/v1/auth/extension-token
```

## Lo que se CREA (5 pasos)

---

### Prerequisito: Google Cloud Console

Antes de codear:

1. Google Cloud Console → nuevo proyecto "Sweepy"
2. APIs & Services → Enable "Gmail API"
3. OAuth Consent Screen:
   - App name: "Sweepy"
   - User support email: tu email
   - Scopes: `gmail.modify`, `gmail.labels`
   - Test users: agregar emails de las 10 personas
   - Publishing status: "Testing" (no publicar todavía)
4. Credentials → Create OAuth client ID:
   - Application type: "Web application"
   - Authorized redirect URIs: `http://localhost:3000/api/auth/gmail/callback`
     y `https://tu-dominio.com/api/auth/gmail/callback`
5. Copiar CLIENT_ID y CLIENT_SECRET

Resultado: `.env` con las nuevas variables.

---

### Paso 1: Gmail OAuth Flow en el backend

**Crear:** `web/src/lib/gmail/auth.ts` (~80 líneas)
**Crear:** `web/src/app/api/auth/gmail/route.ts` (~30 líneas)
**Crear:** `web/src/app/api/auth/gmail/callback/route.ts` (~60 líneas)
**Modificar:** `supabase/migrations/` — nueva migración para tokens

#### 1.1 Nueva migración SQL

```sql
-- 00002_gmail_tokens.sql
alter table public.profiles add column gmail_access_token text;
alter table public.profiles add column gmail_refresh_token text;
alter table public.profiles add column gmail_token_expires_at timestamptz;
alter table public.profiles add column gmail_connected boolean not null default false;
```

Nota: En producción, los tokens deberían estar encriptados (AES-256).
Para MVP con 10 personas, plaintext en Supabase con RLS es aceptable.
TODO futuro: encriptar con una clave en env var.

#### 1.2 Gmail auth library (`web/src/lib/gmail/auth.ts`)

```
Funciones:
- getGmailAuthUrl(userId): string
    → Genera URL de Google OAuth con state=userId
    → Scopes: ['https://www.googleapis.com/auth/gmail.modify']
    → redirect_uri: APP_URL/api/auth/gmail/callback
    → access_type: 'offline' (para refresh token)
    → prompt: 'consent' (fuerza refresh token)

- exchangeCodeForTokens(code): { accessToken, refreshToken, expiresAt }
    → POST a https://oauth2.googleapis.com/token
    → Retorna tokens

- refreshAccessToken(refreshToken): { accessToken, expiresAt }
    → POST a https://oauth2.googleapis.com/token con grant_type=refresh_token

- getValidToken(userId): string
    → Lee tokens de profiles
    → Si expiró → refreshAccessToken() → guarda nuevo token
    → Retorna access_token válido

- revokeGmailAccess(userId): void
    → POST a https://oauth2.googleapis.com/revoke
    → Limpia tokens en profiles
```

#### 1.3 Rutas OAuth

**GET /api/auth/gmail** → Redirige a Google OAuth
- Verifica que el usuario está logueado (Supabase session)
- Genera URL con getGmailAuthUrl()
- Redirect

**GET /api/auth/gmail/callback** → Recibe el código
- Extrae `code` y `state` de query params
- exchangeCodeForTokens(code)
- Guarda tokens en profiles (service role)
- Redirect a /dashboard con ?gmail=connected

#### 1.4 Variables de entorno nuevas

```
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
```

**Verificación:**
1. Ir a /dashboard → Click "Conectar Gmail"
2. Google muestra pantalla de consentimiento
3. Autorizar → redirect a /dashboard
4. profiles.gmail_connected = true

---

### Paso 2: Cliente Gmail API

**Crear:** `web/src/lib/gmail/client.ts` (~150 líneas)

```
Funciones:
- gmailFetch(userId, path, options?): Promise<Response>
    → getValidToken(userId) para auth
    → fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    → Retry en 401 (refresh token + reintentar)
    → Throw en otros errores

- listMessageIds(userId, query, maxResults): Promise<string[]>
    → GET messages?q={query}&maxResults={maxResults}
    → Paginación automática con nextPageToken
    → query default: 'in:inbox'
    → maxResults default: 500

- getMessageMetadata(userId, messageId): Promise<GmailMessage>
    → GET messages/{id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject...
    → Headers solicitados: From, Subject, Date, List-Unsubscribe,
      List-Unsubscribe-Post, Precedence, X-Campaign, Return-Path

- batchGetMessages(userId, ids, onProgress?): Promise<GmailMessage[]>
    → Parallel fetch con concurrencia limitada (5 simultáneos)
    → Promise.allSettled en chunks
    → Callback de progreso opcional

- batchModifyMessages(userId, ids, addLabelIds?, removeLabelIds?): Promise<void>
    → POST messages/batchModify
    → Max 1000 IDs por request (Gmail limit)
    → Para archivar: removeLabelIds=['INBOX']

- trashMessage(userId, messageId): Promise<void>
    → POST messages/{id}/trash

- listLabels(userId): Promise<GmailLabel[]>
    → GET labels

- createLabel(userId, name): Promise<GmailLabel>
    → POST labels { name, labelListVisibility: 'labelShow' }

- getOrCreateLabel(userId, name): Promise<GmailLabel>
    → listLabels → find by name → createLabel si no existe
```

**Tipos** (en `shared/types/gmail.ts`):

```typescript
interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  sizeEstimate: number
  payload: {
    headers: Array<{ name: string; value: string }>
  }
}

interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
}
```

**Verificación:**
1. Desde un test script o API route temporal:
   listMessageIds(userId, 'in:inbox', 10) retorna IDs
2. getMessageMetadata(userId, id) retorna headers correctos

---

### Paso 3: Extractor Gmail → MinimalEmailData + endpoint de scan

**Crear:** `web/src/lib/gmail/extractor.ts` (~80 líneas)
**Crear:** `web/src/app/api/v1/scan/route.ts` (~120 líneas)

#### 3.1 Extractor

```
Función:
- extractMinimalEmailData(msg: GmailMessage): MinimalEmailData
    → Parsea header "From" → { address, name, domain }
    → subject = getHeader('Subject') truncado a 200 chars
    → snippet = msg.snippet truncado a 100 chars
    → date = getHeader('Date') → ISO 8601
    → isRead = !msg.labelIds.includes('UNREAD')
    → headers.listUnsubscribe = getHeader('List-Unsubscribe')
    → headers.precedence = getHeader('Precedence')
    → etc. (mismo mapping que el plan original)
    → bodyLength = msg.sizeEstimate
    → linkCount = 0 (sin body)
    → imageCount = 0 (sin body)
    → hasUnsubscribeText = !!headers.listUnsubscribe

Reutilizar de shared/: parseFromField() si existe, o crear helper.
```

#### 3.2 Endpoint de scan

**POST /api/v1/scan**

Este es el endpoint NUEVO que reemplaza el flujo extension → backend.
Orquesta todo: listar emails → extraer metadata → clasificar → guardar.

```
Flow:
1. Auth check (Supabase session, no extension JWT)
2. Verificar gmail_connected === true
3. Verificar subscription activa (o trial)
4. Rate limit check (20 scans/hora)
5. Crear email_scans record (status='running')
6. listMessageIds(userId, 'in:inbox', maxEmails)
   → Default: 500. Configurable por plan.
7. batchGetMessages(userId, ids)
   → Progreso: podría usar Server-Sent Events o polling
8. extractMinimalEmailData() para cada mensaje
9. categorizeEmails() ← PIPELINE EXISTENTE, sin cambios
10. Guardar suggested_actions ← LÓGICA EXISTENTE
11. Actualizar email_scans (status='completed', stats)
12. Actualizar usage_tracking
13. Retornar { scanId, stats, resultsSummary }
```

**Request:**
```json
{
  "maxEmails": 500,
  "query": "in:inbox"
}
```

**Response:**
```json
{
  "scanId": "uuid",
  "stats": {
    "total": 487,
    "resolvedByHeuristic": 341,
    "resolvedByCache": 82,
    "resolvedByLlm": 64,
    "llmCostUsd": 0.008
  },
  "categories": {
    "newsletter": 142,
    "marketing": 98,
    "transactional": 87,
    "social": 45,
    "notification": 67,
    "spam": 23,
    "personal": 15,
    "important": 10
  }
}
```

Nota: El scan puede tardar 10-30 segundos para 500 emails.
Para MVP: el frontend hace polling cada 2 segundos a GET /api/v1/scan/{id}/status.
Futuro: Server-Sent Events o WebSocket.

**GET /api/v1/scan/:id/status** (~30 líneas)
- Retorna status del scan (running/completed/failed)
- Si completed: incluye stats y categories

**Verificación:**
1. POST /api/v1/scan → scan empieza
2. Poll /api/v1/scan/{id}/status hasta completed
3. Verificar que clasifica >50 emails (antes imposible)
4. Verificar stats correctos (heuristic > cache > llm)

---

### Paso 4: Endpoint de ejecución de acciones

**Crear:** `web/src/app/api/v1/actions/execute/route.ts` (~100 líneas)

```
POST /api/v1/actions/execute

Request:
{
  "actionIds": ["uuid1", "uuid2", ...],  // IDs de suggested_actions
  "action": "approve"                     // approve | reject
}

Flow (approve):
1. Auth check
2. Cargar suggested_actions por IDs (verificar ownership)
3. Agrupar por action_type:
   - archive → batchModifyMessages(ids, [], ['INBOX'])
   - move_to_trash → trashMessage(id) para cada uno
   - mark_read → batchModifyMessages(ids, [], ['UNREAD'])
   - keep → solo marcar como 'approved', no hacer nada
   - unsubscribe → TODO futuro (Phase 2)
4. Ejecutar acciones via Gmail API
5. Actualizar suggested_actions.status = 'executed'
6. Insertar en action_log
7. Retornar { executed: N, failed: N, errors: [...] }

Flow (reject):
→ Delega a /api/v1/actions/reject existente
```

**POST /api/v1/actions/execute/bulk** (~50 líneas)

```
Para acciones masivas: "archivar TODOS los newsletters sin leer"

Request:
{
  "scanId": "uuid",
  "category": "newsletter",
  "action": "archive",
  "filter": { "isRead": false }  // opcional
}

Flow:
1. Cargar suggested_actions del scan + categoría + filtro
2. Confirmar cantidad: { count: 142, action: "archive" }
3. Ejecutar en batches de 1000 (Gmail limit)
4. Retornar stats
```

**Verificación:**
1. Scan completo → ver suggested actions en dashboard
2. Click "Archivar newsletters" → POST /actions/execute/bulk
3. Verificar en Gmail que los emails fueron archivados
4. Verificar en action_log que se registraron

---

### Paso 5: Dashboard mejorado

**Modificar:** `web/src/app/(dashboard)/dashboard/page.tsx`
**Crear:** `web/src/app/(dashboard)/scan/[id]/page.tsx` (~200 líneas)
**Crear:** `web/src/components/` — componentes reutilizables

#### 5.1 Dashboard principal (modificar existente)

```
Estado actual: Muestra stats de scans pasados.

Agregar:
- Botón "Conectar Gmail" (si gmail_connected === false)
  → Redirect a /api/auth/gmail
- Botón "Escanear Inbox" (si gmail_connected === true)
  → POST /api/v1/scan → mostrar progreso → redirect a resultados
- Estado del scan en curso (polling)
- Link a resultados del último scan
```

#### 5.2 Página de resultados de scan (/scan/[id])

```
Layout:

┌─────────────────────────────────────────────────┐
│  🧹 Sweepy — Resultado del scan                │
│  Escaneados: 487 emails · 13 feb 2026          │
├─────────────────────────────────────────────────┤
│                                                 │
│  📰 Newsletters (142)                          │
│  ├── 89 sin leer                               │
│  ├── Acción sugerida: Archivar sin leer        │
│  └── [☑ Seleccionar todo] [Archivar] [Ver]    │
│                                                 │
│  🛍️ Marketing (98)                             │
│  ├── 76 sin leer                               │
│  ├── Acción sugerida: Desuscribir + archivar   │
│  └── [☑ Seleccionar todo] [Archivar] [Ver]    │
│                                                 │
│  🗑️ Spam (23)                                  │
│  ├── Acción sugerida: Mover a papelera         │
│  └── [☑ Seleccionar todo] [Borrar] [Ver]      │
│                                                 │
│  🔔 Notificaciones (67)                        │
│  ├── 45 sin leer, mayoría >7 días             │
│  └── [Archivar viejas] [Ver]                   │
│                                                 │
│  📱 Social (45)                                 │
│  └── [Archivar] [Ver]                          │
│                                                 │
│  🧾 Transaccional (87)                          │
│  └── [Archivar >30 días] [Ver]                 │
│                                                 │
│  ✉️ Personal (15)          🔒 Protegido        │
│  ⭐ Importante (10)        🔒 Protegido        │
│                                                 │
│  ─────────────────────────────────────────────  │
│  Resumen: 398 emails para limpiar              │
│  [ 🧹 Ejecutar acciones seleccionadas ]        │
└─────────────────────────────────────────────────┘
```

#### 5.3 Vista detallada de categoría (expandible o modal)

```
Al hacer click en [Ver] de una categoría:

📰 Newsletters (142)
┌──────────────────────────────────────────────────┐
│ ☑ │ TechCrunch Daily        │ 23 emails │ ●●●○○ │
│ ☑ │ Mercado Libre ofertas   │ 45 emails │ ●●●●● │
│ ☐ │ Clarín newsletter       │ 34 emails │ ●●○○○ │
│ ☑ │ Farmacity promo         │ 12 emails │ ●●●●○ │
│ ☑ │ Dev.to weekly           │  8 emails │ ●○○○○ │
│ ...                                              │
├──────────────────────────────────────────────────┤
│ Seleccionados: 4 senders (88 emails)            │
│ [Archivar seleccionados] [Cancelar]              │
└──────────────────────────────────────────────────┘

●●●●● = confianza de clasificación (0-1)
```

#### 5.4 Componentes necesarios

```
web/src/components/
├── ConnectGmailButton.tsx      — Botón para conectar Gmail
├── ScanButton.tsx              — Inicia scan + muestra progreso
├── ScanProgress.tsx            — Barra de progreso con fases
├── CategoryCard.tsx            — Tarjeta de categoría con acciones
├── CategoryDetail.tsx          — Lista expandida de senders
├── ActionConfirmDialog.tsx     — "¿Seguro que querés archivar 89 emails?"
└── ScanResultsSummary.tsx      — Resumen compacto (para dashboard)
```

**Verificación end-to-end:**
1. Login → Dashboard → "Conectar Gmail" → OAuth → Connected ✅
2. "Escanear Inbox" → Progreso → Resultados por categoría
3. "Archivar newsletters sin leer" → Confirmación → Ejecutado
4. Verificar en Gmail que los emails fueron archivados
5. Dashboard actualizado con stats del scan

---

## Archivos nuevos y modificados

| Archivo | Acción | Líneas ~Δ |
|---|---|---|
| `web/src/lib/gmail/auth.ts` | CREAR | +80 |
| `web/src/lib/gmail/client.ts` | CREAR | +150 |
| `web/src/lib/gmail/extractor.ts` | CREAR | +80 |
| `web/src/app/api/auth/gmail/route.ts` | CREAR | +30 |
| `web/src/app/api/auth/gmail/callback/route.ts` | CREAR | +60 |
| `web/src/app/api/v1/scan/route.ts` | CREAR | +120 |
| `web/src/app/api/v1/scan/[id]/status/route.ts` | CREAR | +30 |
| `web/src/app/api/v1/actions/execute/route.ts` | CREAR | +100 |
| `web/src/app/api/v1/actions/execute/bulk/route.ts` | CREAR | +50 |
| `web/src/app/(dashboard)/dashboard/page.tsx` | MODIFICAR | +50 |
| `web/src/app/(dashboard)/scan/[id]/page.tsx` | CREAR | +200 |
| `web/src/components/*.tsx` (7 componentes) | CREAR | +400 |
| `shared/types/gmail.ts` | CREAR | +30 |
| `supabase/migrations/00002_gmail_tokens.sql` | CREAR | +10 |
| `extension/` (directorio completo) | ELIMINAR | -2000 |
| `web/src/app/api/v1/auth/extension-token/` | ELIMINAR | -80 |
| `web/src/app/extension-callback/` | ELIMINAR | -30 |
| `shared/types/messages.ts` | SIMPLIFICAR | -100 |
| `shared/types/email-provider.ts` | ELIMINAR | -30 |
| **NETO** | | **~-1000 líneas** |

---

## Dependencias entre pasos

```
Prerequisito (Google Cloud Console)
    ↓
Paso 1 (Gmail OAuth)
    ↓
Paso 2 (Gmail API client)
    ↓
Paso 3 (Extractor + Scan endpoint)  ← usa pipeline existente
    ↓
Paso 4 (Execute actions)
    ↓
Paso 5 (Dashboard UI)

Pasos 1-2 son secuenciales (OAuth → client).
Paso 3 depende de 1+2.
Paso 4 depende de 2 (client) pero puede desarrollarse en paralelo con 3.
Paso 5 puede empezar en paralelo (UI estática) pero necesita 3+4 para funcionar.
```

---

## Variables de entorno nuevas

```bash
# Gmail OAuth (NUEVO)
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxx

# Las demás se mantienen igual
```

---

## Testing mode: 10 personas

Con Google OAuth en Testing mode:
- Agregar los 10 emails en OAuth Consent Screen → Test Users
- Los usuarios verán pantalla "Google hasn't verified this app"
- Hacen click en "Advanced" → "Go to Sweepy (unsafe)"
- Tokens en Testing mode expiran cada 7 días
  → El usuario tendrá que re-conectar Gmail semanalmente
  → Aceptable para validación, no para producción

Para salir de Testing mode (>100 usuarios):
1. Completar verificación OAuth de Google (gratis, 2-6 semanas)
2. Pagar CASA Tier 2 (~$540/año)
3. Los tokens dejan de expirar cada 7 días

---

## Verificación end-to-end final

```
1. npm run build → compila sin errores
2. Abrir https://localhost:3000 → landing page
3. Login con Google → dashboard
4. "Conectar Gmail" → OAuth flow → connected
5. "Escanear Inbox" → progreso → resultados
6. Ver categorías con conteos correctos
7. "Archivar newsletters sin leer" → confirmación → ejecutado
8. Verificar en Gmail: emails archivados ✅
9. Dashboard: stats actualizados
10. Repetir con 2-3 cuentas de test
```

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Tokens expiran cada 7 días (Testing mode) | Cierta | Aceptable para 10 personas. UI clara de re-conexión. |
| Scan tarda >30s para 500+ emails | Media | Polling + UI de progreso. Timeout de 60s. |
| Google rechaza la app en verificación | Baja | Privacy policy ya existe. App tipo "email client" es permitido. |
| Rate limit de Gmail API (250 quota units/sec) | Baja | Concurrencia limitada a 5. Exponential backoff. |
| Refresh token desaparece | Baja | Detectar y pedir re-conexión. |

---

## Futuro (después de validar con 10 personas)

1. **CASA + verificación** → salir de Testing mode → tokens no expiran
2. **Bot de Telegram** → notificaciones proactivas (opcional)
3. **Unsubscribe** → RFC 8058 one-click o redirect a link
4. **Scan incremental** → solo emails nuevos desde último scan
5. **Outlook** → Microsoft Graph API (segunda integración)
6. **OpenClaw skill** → publicar en ClawHub para usuarios técnicos
7. **Encriptación de tokens** → AES-256 en DB para producción
