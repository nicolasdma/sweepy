# InboxPilot — AI Email Management Agent

## Context

Producto SaaS para administrar email con IA. Mercado validado (8/10 personas quieren esto). Competencia cara (Inbox Zero $18/mo), vende datos (Cleanfox), o es básica.

Este plan incorpora feedback de 3 revisiones especializadas (Systems Architect, Product Engineer, Failure Engineer) + análisis del código de Inbox Zero (open source, AGPL-3.0 con restricciones comerciales — NO se puede forkear para uso comercial).

**Approach**: Código 100% propio, inspirado en patrones de Inbox Zero.

---

## Decisiones Clave

| Decisión | Elección | Razón |
|---|---|---|
| Email access (MVP) | **gmail.js (DOM)** | $0 inicial. Migrar a Gmail API + CASA Tier 2 (~$1K/año) cuando haya revenue |
| Estructura | **Repo simple** (no monorepo Turborepo) | Overkill para solo dev. `/web` + `/extension` + `/shared` |
| Lanzamiento | **Fases incrementales** | Fase 1: read-only → Fase 2: acciones seguras → Fase 3: eliminar |
| sender cache | **Per-user** (no global) | Categorización es personal, no universal |
| Auto-execute | **NO en MVP** | Siempre aprobación manual (con batch approve) |
| Eliminar emails | **Nunca permanente** | Siempre mover a label "InboxPilot - Cleaned" (cuarentena) |
| LLM temperature | **0** (no 0.1) | Determinismo para clasificación consistente |
| Nombre | **InboxPilot** | (Alternativas: Sweepr, Tidybox, Clearbox) |

---

## Arquitectura

```
Chrome Extension (Manifest V3)
├── content script (ISOLATED) → inyecta script en MAIN world
├── MAIN world: gmail.js lee emails + parsea headers
├── Service Worker: estado, auth, comunicación con backend
├── Side Panel: UI de recomendaciones
└── Protocolo de mensajes con correlation IDs + timeouts

Backend (Next.js en Vercel Pro)
├── API versionada (/api/v1/*)
├── Pipeline IA: heurísticas → cache per-user → LLM (con circuit breaker)
├── Auth: Supabase (Google OAuth)
├── Billing: Stripe ($5/mes, 7 días trial)
├── Config remota (para iterar sin Chrome Web Store review)
└── Dashboard web

DB: Supabase PostgreSQL | Cache: Upstash Redis
Observabilidad: Sentry (extension + backend) + logging estructurado
```

### Interfaz EmailProvider (definida desde día 1)

```typescript
// /shared/types/email-provider.ts
interface EmailProvider {
  getEmails(options: ScanOptions): Promise<EmailMetadata[]>
  archiveEmail(id: string): Promise<ActionResult>
  moveToLabel(id: string, label: string): Promise<ActionResult>
  markAsRead(id: string): Promise<ActionResult>
  getUnsubscribeInfo(id: string): Promise<UnsubscribeInfo | null>
}
```

Todo el código interactúa con emails a través de esta interfaz. Gmail usa gmail.js internamente. Cuando migremos a Gmail API o agreguemos Outlook, solo cambia la implementación.

---

## Tech Stack

| Componente | Tecnología |
|---|---|
| Repo | Simple: `/web` + `/extension` + `/shared` + `/supabase` |
| Extension | TypeScript, Manifest V3, gmail.js, PostalMime, Vite (CRXJS) |
| Frontend | Next.js 14+ (App Router), Tailwind, shadcn/ui |
| Backend | Next.js API routes (versionadas: /api/v1/) |
| AI | GPT-4o-mini (primary), heurísticas + cache como capas previas |
| Database | Supabase (PostgreSQL) |
| Cache | Upstash Redis |
| Auth | Supabase Auth (Google OAuth) |
| Pagos | Stripe |
| Error tracking | Sentry (Chrome Extension SDK + Next.js) |
| Deploy | Vercel Pro ($20/mes) |

---

## Pricing: $5/mes (7 días trial gratis, sin tarjeta)

## Costos Operativos

| Escala | Costo/mes | Por usuario |
|---|---|---|
| 100 usuarios | ~$53 (+$20 Sentry) | $0.53 |
| 1,000 usuarios | ~$170 | $0.17 |
| 10,000 usuarios | ~$1,100 | $0.11 |

---

## Fases del Producto

### FASE 1: Solo Lectura (MVP — Semanas 1-5)

La extensión **solo clasifica y sugiere**. No ejecuta ninguna acción. Esto elimina los riesgos más críticos (acciones destructivas, DOM manipulation para acciones, emails borrados incorrectamente).

**Lo que el usuario puede hacer:**
- Conectar su Gmail
- Escanear inbox (últimos 30 días / 1000 emails max)
- Ver clasificación de cada email (newsletter, spam, importante, etc.)
- Ver sugerencias agrupadas: "47 newsletters que nunca abrís", "12 promos viejas"
- Ver info de unsubscribe disponible por sender
- Dashboard con analytics básicos

**Lo que NO puede hacer aún:**
- Ejecutar acciones (archivar, eliminar, unsubscribe)

### FASE 2: Acciones Seguras (Semanas 6-8)

- Archivar emails (mover a label "InboxPilot - Cleaned", NO eliminar)
- Marcar como leído
- Batch approve (seleccionar múltiples, aprobar de una vez)
- Historial de acciones con opción de revertir

### FASE 3: Acciones Avanzadas (Semanas 9-10)

- Unsubscribe (RFC 8058 one-click + fallback a abrir URL)
- Mover a papelera (nunca delete permanente)
- Escaneo incremental (solo emails nuevos desde último scan)

### FASE 4: Escala (Post-MVP)

- Migrar a Gmail API + CASA Tier 2 (~$1K/año)
- Outlook via Microsoft Graph API
- Telegram/WhatsApp notifications
- AI learning from user feedback
- Escaneo programado
- Multi-cuenta

---

## Implementación Detallada (Fase 1 MVP)

### Semana 1-2: Fundación

**1. Inicializar repo**
```
inboxpilot/
├── web/                     # Next.js app
│   ├── src/
│   │   ├── app/             # App Router
│   │   │   ├── (marketing)/ # Landing, pricing
│   │   │   ├── (dashboard)/ # Dashboard protegido
│   │   │   └── api/v1/      # API versionada
│   │   ├── lib/
│   │   │   ├── ai/          # Pipeline, heuristics, LLM, cache
│   │   │   ├── supabase/    # Clients
│   │   │   ├── stripe/      # Config + helpers
│   │   │   └── redis.ts     # Upstash client
│   │   └── components/      # UI (shadcn)
│   └── package.json
├── extension/               # Chrome Extension
│   ├── src/
│   │   ├── manifest.json
│   │   ├── service-worker/
│   │   │   └── background.ts
│   │   ├── content/
│   │   │   ├── isolated.ts  # Bridge ISOLATED world
│   │   │   └── main-world.ts # gmail.js + extraction
│   │   ├── sidepanel/       # React side panel
│   │   ├── popup/           # Minimal popup
│   │   ├── providers/
│   │   │   └── gmail-adapter.ts  # Implementa EmailProvider
│   │   ├── lib/
│   │   │   ├── message-bus.ts    # Protocolo con correlation IDs
│   │   │   ├── email-extractor.ts
│   │   │   ├── mime-parser.ts
│   │   │   ├── api-client.ts     # Fetch tipado al backend
│   │   │   └── auth.ts
│   │   └── assets/
│   └── package.json
├── shared/                  # Tipos compartidos (importados via path alias)
│   ├── types/
│   │   ├── email.ts
│   │   ├── email-provider.ts    # Interfaz EmailProvider
│   │   ├── actions.ts
│   │   ├── categories.ts
│   │   ├── messages.ts          # Tipos discriminados para message bus
│   │   ├── api.ts               # Request/response types
│   │   └── user.ts
│   └── tsconfig.json
├── supabase/
│   └── migrations/
├── .env.example
└── package.json
```

**2. Configurar servicios externos**
- Supabase: proyecto + migraciones + Google OAuth
- Stripe: producto "InboxPilot Pro" $5/mes
- Upstash Redis: instancia
- Sentry: proyectos (extension + web)

**3. Next.js base**
- Auth flow completo (Google OAuth → callback → session)
- Middleware de auth en API routes
- Sentry integrado

**4. Tipos compartidos** en `/shared/types/`

### Semana 2-3: Extension + Pipeline IA

**5. Extension scaffold**
- Manifest V3 con CRXJS Vite Plugin (HMR para content scripts)
- Permisos mínimos: `storage`, `sidePanel`, `activeTab`, `scripting`
- Host permissions: `https://mail.google.com/*`

**6. Message Bus con correlation IDs**

```typescript
// /extension/src/lib/message-bus.ts
interface Message {
  id: string              // crypto.randomUUID()
  type: string
  payload: unknown
  version: string         // Extension version (para detectar desync)
  source: 'main' | 'isolated' | 'worker'
  timestamp: number
}

// Cada hop tiene timeout de 5 segundos
// Si no hay ack, retry 1 vez, luego error al usuario
// Service Worker dormido: ping primero, luego enviar
```

**7. gmail.js injection con health check**

```
MAIN world script:
1. Inyecta gmail.js
2. Espera gmail.observe.on('load')
3. Health check: intenta leer 1 email
   - Si falla: postMessage({type: 'HEALTH_CHECK_FAILED'})
   - Extension muestra banner: "Temporalmente incompatible"
4. Si OK: postMessage({type: 'READY'})
```

**8. Email data extraction**
- `gmail.new.get.email_data()` para metadata
- `gmail.get.email_source_promise()` para MIME (headers)
- PostalMime para parsear List-Unsubscribe, Precedence, etc.
- Campos derivados sin enviar raw data: longitud body, # links, # imágenes, tiene "unsubscribe" en body
- Minimización + sanitización (redact credit cards, SSN, tokens)

**9. Heuristics engine** (costo: $0)

Reglas en orden de prioridad:
1. `List-Unsubscribe` header → newsletter (0.92 confianza)
2. `Precedence: bulk` → newsletter (0.90)
3. Known marketing domains (mailchimp, sendgrid, etc.) → marketing (0.95)
4. `noreply@` + List-Unsubscribe → newsletter (0.93)
5. `noreply@` sin List-Unsubscribe → transactional (0.75)
6. Subject matches receipt/invoice/order → transactional (0.88)
7. Known social domains → social (0.90)
8. Known dev tool domains → notification (0.88)
9. `X-Campaign` header → marketing (0.85)
10. Return-Path mismatch + List-Unsubscribe → marketing (0.82)

Si confianza ≥ 0.80 → resuelto. Si no → siguiente capa.

**10. Redis sender cache (PER USER)**
- Key: `user:{userId}:sender:{address}` → `{category, confidence, categorizedBy}`
- TTL 30 días con degradación leve de confianza (0.2%/día, max 5%)
- Invalidación cuando usuario rechaza categorización

**11. LLM integration (GPT-4o-mini)**
- Batches dinámicos: acumular hasta 20 emails O timeout de 10 segundos
- Temperature 0, seed fijo para reproducibilidad
- Structured output (JSON mode) + validación con Zod
- **Circuit breaker**: 3 fallos consecutivos → desactivar LLM por 60 segundos → solo heurísticas
- Sanitización anti-prompt-injection: delimitadores claros, instrucción explícita de que el contenido es datos
- Fallback: si LLM falla → categorizar como "unknown" con action "keep"

**12. Pipeline orchestrator**
```
categorizeEmails(emails, userId):
  1. Heuristics (sync, $0)     → ~60-70% resuelto
  2. User cache (Redis, $0)    → ~15-20% resuelto
  3. LLM (GPT-4o-mini, ~$0.12/1K) → ~15-25% restante

  Para cada email categorizado:
  - newsletter (nunca abierto) → sugerir UNSUBSCRIBE + ARCHIVE
  - newsletter (a veces abierto) → sugerir ARCHIVE
  - spam → sugerir MOVE_TO_TRASH
  - marketing → sugerir UNSUBSCRIBE + ARCHIVE
  - transactional (>30 días) → sugerir ARCHIVE
  - transactional (<30 días) → KEEP
  - social → sugerir ARCHIVE
  - personal/important → SIEMPRE KEEP (nunca sugerir eliminar)
```

### Semana 3-4: Integración + UI

**13. API endpoints (versionados)**

```
POST /api/v1/emails/analyze
  - Recibe: MinimalEmailData[] (max 50 por request)
  - Retorna: CategorizationResult[]
  - Auth: JWT required
  - Rate limit: 20 scans/hora

POST /api/v1/actions/reject
  - Recibe: { actionId, userCategory?, feedback? }
  - Invalida cache de ese sender para este usuario
  - Guarda en user_feedback

GET /api/v1/actions/history
  - Paginado, filtrable por status/category
  - Auth: JWT required

GET /api/v1/config
  - Retorna config remota (feature flags, versión mínima de extension)
  - Permite iterar sin Chrome Web Store review
```

**14. Side Panel UI**
- Botón "Escanear" prominente
- Barra de progreso: "Escaneando... 234 de 1,000 (23%)"
- Resultados agrupados por categoría
- Confidence score visible por email
- En Fase 1: solo información, sin botones de acción

**15. Extension auth flow**
1. Popup muestra "Conectar con Google"
2. Abre tab de web app → Supabase Google OAuth
3. Callback guarda session
4. Web app genera token para extension
5. Extension lo guarda en `chrome.storage.session`
6. Refresh token en `chrome.storage.local` con TTL de 30 días
7. Refresh proactivo
8. Mutex para refresh

**16. Leader election entre tabs**
- `BroadcastChannel` para negociar tab líder
- Solo el líder ejecuta scans
- Otros tabs se sincronizan vía `chrome.storage.onChanged`

**17. Scan limits**
- Scan inicial: últimos 30 días O últimos 1,000 emails (lo que sea menor)
- Procesamiento en micro-batches de 10 emails
- Empezar por los más recientes

### Semana 4-5: Dashboard + Monetización + Lanzamiento

**18. Dashboard web**
- Resumen: emails escaneados, categorías encontradas
- Lista de categorizaciones con detalle
- Analytics: top senders, distribución por categoría
- Settings: preferencias de categorías protegidas
- Billing: Stripe Customer Portal

**19. Landing page**
- Hero con propuesta de valor clara
- Demo/screenshots del side panel
- Pricing ($5/mes, 7 días gratis)
- Privacy + FAQ

**20. Stripe integration**
- Checkout con `trial_period_days: 7`
- Webhooks idempotentes
- Verificación bilateral
- Grace period 24h

**21. Compliance**
- Privacy Policy publicada en web
- Terms of Service
- Data handling declaration
- Consent explícito al primer scan
- Opción "solo heurísticas"

**22. Chrome Web Store submission**
- Íconos en todos los tamaños
- Screenshots + video demo
- Descripción con justificación de permisos
- Buffer de 2 semanas para review
- Plan B: distribución unlisted

---

## Database Schema

### Tablas:

**profiles** (extiende auth.users)
- id, email, display_name, avatar_url
- stripe_customer_id, stripe_subscription_id, subscription_status
- trial_start, trial_end, current_period_end
- categories_to_protect (array, default: ['personal', 'important'])
- scan_limit_per_day (default: 20)

**user_sender_profiles** (PER USER, no global)
- id, user_id, sender_address (unique per user), sender_domain, sender_name
- category, confidence, categorized_by ('heuristic'|'cache'|'llm'|'user_override')
- has_list_unsubscribe, list_unsubscribe_url, supports_one_click
- email_count, open_rate
- UNIQUE(user_id, sender_address)

**email_scans**
- id, user_id, started_at, completed_at, status
- total_emails_scanned, resolved_by_heuristic, resolved_by_cache, resolved_by_llm
- llm_cost_usd, category_counts (JSONB)

**suggested_actions**
- id, user_id, scan_id
- gmail_email_id, gmail_thread_id
- sender_address, sender_name, subject_preview (100 chars), email_date
- category, confidence, action_type, reasoning, categorized_by
- status: 'pending' | 'approved' | 'rejected' | 'queued' | 'executing' | 'executed' | 'failed' | 'expired'
- TTL: expiran después de 7 días si no se actúa

**user_feedback**
- id, user_id, action_id
- original_category, original_action, original_confidence
- user_category, user_action, feedback_type ('approved'|'rejected'|'corrected')
- sender_address, sender_domain

**action_log** (audit trail)
- id, user_id, email_id, action_type, confidence_score
- was_batch_approved, executed_at, result, error_message
- email_subject_hash (SHA-256, para debugging sin PII)

**usage_tracking**
- id, user_id, period_start, period_end
- scans_count, emails_processed, llm_calls_count, llm_tokens_used

### RLS:
- Todas las tablas: usuarios solo ven/modifican sus propios datos
- Auth en middleware de API routes (JWT verification)
- `service_role` key SOLO en backend, NUNCA en extension

---

## Seguridad y Privacidad

### Datos al backend (mínimos):
- Sender address + name, subject (200 chars), snippet (100 chars)
- Headers: List-Unsubscribe, Precedence, boolean flags
- Campos derivados: body length, # links, # images, has "unsubscribe" text
- Fecha, estado leído/no leído

### NUNCA se envía:
- Body completo, adjuntos, CC/BCC, otros contactos, IPs

### Sanitización:
- Redact credit cards, SSN, tokens largos
- Truncar agresivamente antes de enviar a OpenAI

### API Security:
- JWT auth en TODOS los endpoints
- Rate limiting POR ENDPOINT
- API key OpenAI: usage limits configurados
- Versionamiento de API con header `X-Extension-Version`

### Extension Security:
- CSP estricta en manifest
- Origin validation en TODOS los postMessage
- Tokens en `chrome.storage.session` (access) + `chrome.storage.local` (refresh)
- Version check: si extension y backend desincronizados → banner "Recarga Gmail"

---

## Observabilidad (desde día 1)

- **Sentry**: Error tracking en extension + backend
- **Logging estructurado**: Axiom o Betterstack
- **Métricas clave**: Error rate gmail.js, latencia pipeline IA, tasa aprobación/rechazo, % resuelto por capa, tasa error LLM
- **Health check automatizado**: Test E2E con Puppeteer cada 6h

---

## Resiliencia y Fallbacks

| Servicio caído | Fallback |
|---|---|
| OpenAI | Circuit breaker → solo heurísticas + cache |
| Redis (Upstash) | Skip cache → directo a LLM |
| Supabase | Extension muestra último scan cacheado localmente |
| Vercel | Banner "Servicio temporalmente no disponible" |
| gmail.js roto | Health check → banner + feature flag remoto |

---

## Riesgos Post-Review

| Riesgo | Severidad | Mitigación |
|---|---|---|
| gmail.js se rompe con update de Gmail | CRITICAL | Health check + test E2E + feature flag + migración Gmail API |
| Chrome Web Store rechaza | CRITICAL | Privacy policy, permisos mínimos, distribución unlisted Plan B |
| Clasificación incorrecta | CRITICAL | Nunca delete permanente, cuarentena, aprobación manual |
| GDPR por datos a OpenAI | HIGH | Consent explícito, opción "solo heurísticas", data minimization |
| Service Worker se duerme | HIGH | Estado en chrome.storage, operation log, keep-alive |
| Prompt injection | HIGH | Sanitización, delimitadores, validación Zod |
| Stripe webhook out-of-order | MEDIUM | Idempotencia, verificación bilateral, grace period |
| Múltiples tabs duplicación | MEDIUM | Leader election, dedup en Service Worker |

---

## Timeline Realista

| Semana | Foco |
|---|---|
| 1-2 | Repo setup, servicios externos, auth, tipos compartidos, extension scaffold |
| 2-3 | gmail.js injection, health check, email extraction, message bus |
| 3-4 | Pipeline IA completo, API endpoints, side panel UI |
| 4-5 | Dashboard, landing page, Stripe, compliance docs |
| 5-6 | Testing, bug fixes, polish |
| 6-7 | Chrome Web Store submission + buffer review |
| 7-8 | Iteración post-feedback de review |
| **8** | **LAUNCH Fase 1 (read-only)** |
| 9-10 | Fase 2: acciones seguras |
| 11-12 | Fase 3: unsubscribe + mover a papelera |

---

## Patrones Aprendidos de Inbox Zero (referencia, NO código copiado)

1. **Pipeline IA**: Heurísticas antes de LLM
2. **LLM con retry robusto**: `withLLMRetry()` + `jsonrepair`
3. **Prompt security**: Instrucciones anti-injection en todos los prompts
4. **Unsubscribe como servicio separado**: Fastify + Playwright (Fase 3+)
5. **Cold email detection**: Verificar comunicación previa con sender
6. **Gmail Pub/Sub webhooks**: Para Fase 4 con Gmail API
7. **Vercel AI SDK**: Abstracción multi-provider (considerar adoptar)

---

## Migración futura a Gmail API (Fase 4)

Cuando haya revenue (~$1K/mes):
1. Registrar app en Google Cloud Console
2. Solicitar scopes: `gmail.readonly` + `gmail.modify`
3. Pasar auditoría CASA Tier 2 (~$1,000, ~2-4 semanas)
4. Implementar `GmailApiProvider` que implemente `EmailProvider`
5. Feature flag: users nuevos usan API, existentes migran gradualmente
6. Mantener gmail.js como fallback temporal

---

## Branches para Desarrollo Paralelo

```
main
├── feat/shared-types          # Task 2: Shared types (NO dependencies)
├── feat/web-foundation        # Task 4: Next.js + auth + Supabase clients
├── feat/extension-scaffold    # Task 5: Chrome Extension + message bus + gmail.js
├── feat/supabase-schema       # Task 6: DB migrations + RLS policies
├── feat/ai-pipeline           # Task 7: Heuristics + cache + LLM (depends on shared-types)
├── feat/api-endpoints         # Task 8: API routes (depends on web-foundation + ai-pipeline)
├── feat/auth-flow             # Task 9: Auth (depends on web-foundation + extension-scaffold)
├── feat/stripe-billing        # Task 10: Stripe (depends on web-foundation + supabase-schema)
└── feat/dashboard-ui          # Dashboard + landing (depends on web-foundation + api-endpoints)
```

### Dependency Graph:
```
shared-types ─────────────┬──→ ai-pipeline ──→ api-endpoints ──→ dashboard-ui
                          │                          ↑
web-foundation ───────────┼──────────────────────────┤
                          │                          │
extension-scaffold ───────┼──→ auth-flow             │
                          │                          │
supabase-schema ──────────┴──→ stripe-billing ───────┘
```

### Parallelizable (sin dependencias entre sí):
- `feat/shared-types` + `feat/web-foundation` + `feat/extension-scaffold` + `feat/supabase-schema`
