import type { MinimalEmailData } from '@shared/types/email'
import type {
  EmailCategory,
  CategorizationResult,
} from '@shared/types/categories'
import { getSuggestedActions } from './suggested-actions'

// ---------------------------------------------------------------------------
// Public interfaces for standalone heuristic usage
// ---------------------------------------------------------------------------

export interface HeuristicInput {
  senderAddress: string
  senderDomain: string
  senderName?: string
  subject: string
  headers: {
    listUnsubscribe?: string
    precedence?: string
    xCampaign?: string
    xMailer?: string
    returnPath?: string
  }
}

export interface HeuristicResult {
  category: EmailCategory
  confidence: number
  rule: string // Which rule matched (for debugging/logging)
}

// ---------------------------------------------------------------------------
// Known domain lists (exported for reuse / testing)
// ---------------------------------------------------------------------------

export const MARKETING_SENDING_DOMAINS = new Set([
  // Email service providers / marketing platforms
  'mailchimp.com',
  'sendgrid.net',
  'sendgrid.com',
  'mailgun.org',
  'mailgun.com',
  'constantcontact.com',
  'campaign-archive.com',
  'list-manage.com',
  'hubspot.com',
  'hubspotemail.net',
  'hubspot.net',
  'klaviyo.com',
  'brevo.com',
  'sendinblue.com',
  'mailerlite.com',
  'convertkit.com',
  'kit.com',
  'drip.com',
  'aweber.com',
  'getresponse.com',
  'activecampaign.com',
  'customer.io',
  'intercom-mail.com',
  'intercom.io',
  'mandrillapp.com',
  'amazonses.com',
  'postmarkapp.com',
  'sparkpostmail.com',
  'email.mg',
  'mailtrap.io',
  'mailjet.com',
  'moosend.com',
  'omnisend.com',
  'sailthru.com',
  'iterable.com',
  'sendpulse.com',
  'benchmark.email',
  'campaignmonitor.com',
  'createsend.com',
  'emarsys.net',
])

export const SOCIAL_DOMAINS = new Set([
  // Major social networks
  'facebookmail.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'linkedinmail.com',
  'instagram.com',
  'tiktok.com',
  'pinterest.com',
  'reddit.com',
  'redditmail.com',
  'tumblr.com',
  'snapchat.com',
  'discord.com',
  'discordapp.com',
  'medium.com',
  'quora.com',
  'mastodon.social',
  'threads.net',
  'bluesky.social',
  'bsky.app',
  'youtube.com',
  'whatsapp.com',
  'telegram.org',
  'signal.org',
  'nextdoor.com',
  'meetup.com',
  'twitch.tv',
  'strava.com',
])

export const DEV_NOTIFICATION_DOMAINS = new Set([
  // Version control & CI/CD
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'circleci.com',
  'travisci.com',
  'travis-ci.com',
  'drone.io',
  'github.io',
  // Project management & collaboration
  'atlassian.com',
  'atlassian.net',
  'jira.com',
  'slack.com',
  'slackbot.com',
  'notion.so',
  'linear.app',
  'asana.com',
  'trello.com',
  'clickup.com',
  'monday.com',
  // Design & dev tools
  'figma.com',
  'vercel.com',
  'netlify.com',
  'heroku.com',
  'railway.app',
  'render.com',
  'fly.io',
  // Monitoring & observability
  'sentry.io',
  'getsentry.com',
  'datadog.com',
  'pagerduty.com',
  'opsgenie.com',
  'statuspage.io',
  'newrelic.com',
  'bugsnag.com',
  // Package registries & docs
  'npmjs.com',
  'crates.io',
  'pypi.org',
  'docker.com',
  'dockerhub.com',
  // Cloud & infrastructure
  'supabase.io',
  'supabase.com',
  'firebase.google.com',
  'cloudflare.com',
  'aws.amazon.com',
  'digitalocean.com',
  'stripe.com',
  'twilio.com',
  'auth0.com',
])

// Marketing tool names found in X-Mailer headers
const MARKETING_MAILER_PATTERNS = [
  'mailchimp',
  'sendgrid',
  'hubspot',
  'klaviyo',
  'brevo',
  'sendinblue',
  'mailerlite',
  'convertkit',
  'activecampaign',
  'campaign monitor',
  'campaignmonitor',
  'constant contact',
  'constantcontact',
  'mailgun',
  'mandrill',
  'mailjet',
  'moosend',
  'omnisend',
  'drip',
  'aweber',
  'getresponse',
  'emarsys',
  'iterable',
  'sailthru',
  'sparkpost',
  'postmark',
  'customer.io',
  'intercom',
  'marketo',
  'pardot',
  'eloqua',
]

// Receipt/invoice/order subject patterns
const TRANSACTIONAL_SUBJECT_PATTERNS = [
  /\b(receipt|invoice|order\s*(confirmation|#|number)|payment\s*(confirmation|received)|shipping\s*(confirmation|update|notification)|delivery\s*(confirmation|update)|tracking\s*(number|#|update))\b/i,
  /\b(your\s+order|order\s+shipped|out\s+for\s+delivery|has\s+been\s+delivered)\b/i,
  /\b(subscription\s+(renewed|confirmed|activated)|billing\s+statement|charge\s+of)\b/i,
  /\b(password\s+reset|verify\s+your|confirm\s+your\s+(email|account)|two-factor|2fa|security\s+code)\b/i,
]

// Promotional subject patterns → marketing, not newsletter
const PROMOTIONAL_SUBJECT_PATTERNS = [
  /\b(\d+%\s*(off|dto|descuento|de?\s*descuento|discount))\b/i,
  /\b(off|sale|promo|oferta|ofertas|descuento|descuentos|cupón|cupon|coupon|deal|deals)\b/i,
  /\b(free\s+shipping|envío\s+gratis|envio\s+gratis)\b/i,
  /\b(last\s+chance|última\s+oportunidad|solo\s+por\s+hoy|flash\s+sale|limited\s+time)\b/i,
  /\b(shop\s+now|comprar\s+ahora|aprovechá|aprovecha|no\s+te\s+pierdas)\b/i,
  /\b(save\s+up\s+to|ahorrá|ahorra|regalo|regalamos|cashback)\b/i,
  /\b(premios?|increíble|increible|exclusivo|exclusiva|gratis|ganá|gana|descubrí|descubre)\b/i,
  /\b(win|winner|prize|reward|bonus|upgrade|unlock|claim)\b/i,
]

function hasPromotionalSubject(subject: string): boolean {
  return PROMOTIONAL_SUBJECT_PATTERNS.some((p) => p.test(subject))
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isSubdomainOfSet(domain: string, domainSet: Set<string>): boolean {
  const parts = domain.split('.')
  for (let i = 1; i < parts.length; i++) {
    const parent = parts.slice(i).join('.')
    if (domainSet.has(parent)) return true
  }
  return false
}

function domainMatches(domain: string, domainSet: Set<string>): boolean {
  return domainSet.has(domain) || isSubdomainOfSet(domain, domainSet)
}

function extractDomainFromEmail(email: string): string {
  const atIndex = email.lastIndexOf('@')
  if (atIndex === -1) return ''
  return email.slice(atIndex + 1).toLowerCase()
}

function extractDomainFromReturnPath(returnPath: string): string {
  // Return-Path can be like "<bounce@sendgrid.net>" or just "bounce@sendgrid.net"
  const cleaned = returnPath.replace(/[<>]/g, '').trim()
  return extractDomainFromEmail(cleaned)
}

function isNoreplyAddress(address: string): boolean {
  const local = address.split('@')[0]?.toLowerCase() ?? ''
  return (
    local === 'noreply' ||
    local === 'no-reply' ||
    local === 'donotreply' ||
    local === 'do-not-reply' ||
    local.startsWith('noreply') ||
    local.startsWith('no-reply') ||
    local.startsWith('donotreply') ||
    local.startsWith('do-not-reply')
  )
}

/** Broader check: sender address looks automated (noreply, notifications, alerts, etc.) */
function isAutomatedSender(address: string): boolean {
  if (isNoreplyAddress(address)) return true
  const local = address.split('@')[0]?.toLowerCase() ?? ''
  return (
    local.startsWith('notifications') ||
    local.startsWith('notification') ||
    local.startsWith('alerts') ||
    local.startsWith('alert') ||
    local.startsWith('mailer-daemon') ||
    local.startsWith('postmaster') ||
    local.startsWith('support') ||
    local.startsWith('info') ||
    local.startsWith('hello') ||
    local.startsWith('team') ||
    local.startsWith('news') ||
    local.startsWith('updates') ||
    local.startsWith('service') ||
    local.startsWith('billing')
  )
}

function hasMarketingMailerName(xMailer: string): boolean {
  const lower = xMailer.toLowerCase()
  return MARKETING_MAILER_PATTERNS.some((pattern) => lower.includes(pattern))
}

function isReplyOrForward(subject: string): boolean {
  return /^(re|fwd|fw)\s*:/i.test(subject.trim())
}

function isGmailImportant(email: MinimalEmailData): boolean {
  return email.labels.includes('IMPORTANT')
}

function isGmailPersonal(email: MinimalEmailData): boolean {
  return email.labels.includes('CATEGORY_PERSONAL')
}

function isStarred(email: MinimalEmailData): boolean {
  return email.labels.includes('STARRED')
}

/** Email looks like it's from a real person, not an automated system */
function looksPersonal(email: MinimalEmailData): boolean {
  return (
    !email.headers.isNoreply &&
    !isAutomatedSender(email.from.address) &&
    !email.headers.hasListUnsubscribe &&
    !email.headers.hasPrecedenceBulk &&
    !email.headers.xCampaign &&
    email.bodyLength < 20000 &&
    !domainMatches(email.from.domain, MARKETING_SENDING_DOMAINS) &&
    !domainMatches(email.from.domain, SOCIAL_DOMAINS) &&
    !domainMatches(email.from.domain, DEV_NOTIFICATION_DOMAINS)
  )
}

// ---------------------------------------------------------------------------
// Unified heuristic rule definitions
// ---------------------------------------------------------------------------

interface UnifiedRule {
  name: string
  priority: number
  testEmail: (email: MinimalEmailData) => boolean
  testInput: (input: HeuristicInput) => boolean
  category: EmailCategory
  confidence: number
}

const CONFIDENCE_THRESHOLD = 0.70

const unifiedRules: UnifiedRule[] = [
  // ── TIER 0: SAFETY — Protect important/personal emails ────────────────
  // These rules MUST fire first to prevent important emails from being
  // miscategorized as newsletter/marketing/etc.

  // Rule 0a: Gmail marked as IMPORTANT + looks personal -> important (0.90)
  // Gmail's own ML classifier says it's important AND it has no bulk signals
  {
    name: 'gmail-important-personal',
    priority: 0,
    testEmail: (e) => isGmailImportant(e) && looksPersonal(e),
    testInput: () => false, // Only works with full email data
    category: 'important',
    confidence: 0.90,
  },
  // Rule 0b: Gmail CATEGORY_PERSONAL + not automated -> personal (0.88)
  {
    name: 'gmail-category-personal',
    priority: 0,
    testEmail: (e) => isGmailPersonal(e) && !isAutomatedSender(e.from.address),
    testInput: () => false,
    category: 'personal',
    confidence: 0.88,
  },
  // Rule 0c: Starred email -> important (0.92)
  {
    name: 'starred-email',
    priority: 0,
    testEmail: (e) => isStarred(e),
    testInput: () => false,
    category: 'important',
    confidence: 0.92,
  },
  // Rule 0d: Reply/Forward thread + looks personal -> personal (0.85)
  // Re: / Fwd: means it's a conversation — very likely human-to-human
  {
    name: 'reply-forward-personal',
    priority: 0,
    testEmail: (e) => isReplyOrForward(e.subject) && looksPersonal(e),
    testInput: (input) =>
      isReplyOrForward(input.subject) &&
      !isNoreplyAddress(input.senderAddress) &&
      !input.headers.listUnsubscribe,
    category: 'personal',
    confidence: 0.85,
  },

  // ── TIER 1: Domain-specific rules (most precise, check first) ──────────

  // Rule 1: Known marketing platform domains -> marketing (0.95)
  {
    name: 'known-marketing-domain',
    priority: 1,
    testEmail: (e) => domainMatches(e.from.domain, MARKETING_SENDING_DOMAINS),
    testInput: (input) =>
      domainMatches(input.senderDomain.toLowerCase(), MARKETING_SENDING_DOMAINS),
    category: 'marketing',
    confidence: 0.95,
  },
  // Rule 2: Known social network domains -> social (0.93)
  {
    name: 'known-social-domain',
    priority: 2,
    testEmail: (e) => domainMatches(e.from.domain, SOCIAL_DOMAINS),
    testInput: (input) =>
      domainMatches(input.senderDomain.toLowerCase(), SOCIAL_DOMAINS),
    category: 'social',
    confidence: 0.93,
  },
  // Rule 3: Known dev tool / notification domains -> notification (0.92)
  {
    name: 'known-dev-tool-domain',
    priority: 3,
    testEmail: (e) => domainMatches(e.from.domain, DEV_NOTIFICATION_DOMAINS),
    testInput: (input) =>
      domainMatches(input.senderDomain.toLowerCase(), DEV_NOTIFICATION_DOMAINS),
    category: 'notification',
    confidence: 0.92,
  },

  // ── TIER 2: Subject-based rules (content signals) ─────────────────────

  // Rule 4: Receipt/invoice/order subject -> transactional (0.88)
  {
    name: 'transactional-subject',
    priority: 4,
    testEmail: (e) => TRANSACTIONAL_SUBJECT_PATTERNS.some((p) => p.test(e.subject)),
    testInput: (input) =>
      TRANSACTIONAL_SUBJECT_PATTERNS.some((p) => p.test(input.subject)),
    category: 'transactional',
    confidence: 0.88,
  },
  // Rule 5: Promotional subject + List-Unsubscribe -> marketing (0.88)
  // Catches "50% off!", "flash sale", etc. that have unsubscribe links
  {
    name: 'promotional-subject-with-unsubscribe',
    priority: 5,
    testEmail: (e) =>
      e.headers.hasListUnsubscribe && hasPromotionalSubject(e.subject),
    testInput: (input) =>
      !!input.headers.listUnsubscribe && hasPromotionalSubject(input.subject),
    category: 'marketing',
    confidence: 0.88,
  },

  // ── TIER 3: Header-based rules (marketing signals) ────────────────────

  // Rule 6: X-Campaign or marketing X-Mailer -> marketing (0.85)
  {
    name: 'x-campaign-or-x-mailer-header',
    priority: 6,
    testEmail: (e) => !!e.headers.xCampaign,
    testInput: (input) =>
      !!input.headers.xCampaign ||
      (!!input.headers.xMailer && hasMarketingMailerName(input.headers.xMailer)),
    category: 'marketing',
    confidence: 0.85,
  },
  // Rule 7: Return-Path domain mismatch + List-Unsubscribe -> marketing (0.82)
  {
    name: 'return-path-mismatch-unsubscribe',
    priority: 7,
    testEmail: (e) => e.headers.hasReturnPathMismatch && e.headers.hasListUnsubscribe,
    testInput: (input) => {
      if (!input.headers.returnPath || !input.headers.listUnsubscribe) return false
      const returnPathDomain = extractDomainFromReturnPath(input.headers.returnPath)
      if (!returnPathDomain) return false
      return returnPathDomain !== input.senderDomain.toLowerCase()
    },
    category: 'marketing',
    confidence: 0.82,
  },

  // ── TIER 4: Generic header catch-alls (least specific, check last) ────

  // Rule 8: noreply + List-Unsubscribe -> newsletter (0.80)
  // (domain-specific rules already caught social/notification/marketing above)
  {
    name: 'noreply-with-unsubscribe',
    priority: 8,
    testEmail: (e) => e.headers.isNoreply && e.headers.hasListUnsubscribe,
    testInput: (input) =>
      isNoreplyAddress(input.senderAddress) && !!input.headers.listUnsubscribe,
    category: 'newsletter',
    confidence: 0.80,
  },
  // Rule 9: List-Unsubscribe header (no noreply) -> newsletter (0.78)
  // Generic catch-all: if it has unsubscribe and wasn't caught above, it's a newsletter
  {
    name: 'list-unsubscribe-header',
    priority: 9,
    testEmail: (e) => e.headers.hasListUnsubscribe,
    testInput: (input) => !!input.headers.listUnsubscribe,
    category: 'newsletter',
    confidence: 0.78,
  },
  // Rule 10: Precedence: bulk -> newsletter (0.75)
  {
    name: 'precedence-bulk',
    priority: 10,
    testEmail: (e) => e.headers.hasPrecedenceBulk,
    testInput: (input) =>
      input.headers.precedence?.toLowerCase() === 'bulk',
    category: 'newsletter',
    confidence: 0.75,
  },
  // Rule 11: noreply without List-Unsubscribe -> transactional (0.72)
  {
    name: 'noreply-no-unsubscribe',
    priority: 11,
    testEmail: (e) => e.headers.isNoreply && !e.headers.hasListUnsubscribe,
    testInput: (input) =>
      isNoreplyAddress(input.senderAddress) && !input.headers.listUnsubscribe,
    category: 'transactional',
    confidence: 0.72,
  },
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply heuristic rules to a standalone input (not tied to MinimalEmailData).
 * Returns the first matching rule result, or null if no rule matched.
 * Rules are evaluated in priority order (first match wins).
 */
export function applyHeuristics(input: HeuristicInput): HeuristicResult | null
/**
 * Apply heuristic rules to categorize a single email.
 * Returns a full CategorizationResult if confidence >= threshold, null otherwise.
 */
export function applyHeuristics(email: MinimalEmailData): CategorizationResult | null
export function applyHeuristics(
  inputOrEmail: HeuristicInput | MinimalEmailData
): HeuristicResult | CategorizationResult | null {
  // Determine which input type we received by checking for MinimalEmailData-specific fields
  if (isMinimalEmailData(inputOrEmail)) {
    return applyHeuristicsInternal(inputOrEmail)
  }
  return applyHeuristicsStandalone(inputOrEmail)
}

function isMinimalEmailData(
  input: HeuristicInput | MinimalEmailData
): input is MinimalEmailData {
  return 'id' in input && 'from' in input && 'headers' in input && 'hasListUnsubscribe' in (input as MinimalEmailData).headers
}

/**
 * Internal: apply rules against MinimalEmailData (used by pipeline).
 */
function applyHeuristicsInternal(
  email: MinimalEmailData
): CategorizationResult | null {
  for (const rule of unifiedRules) {
    if (rule.testEmail(email) && rule.confidence >= CONFIDENCE_THRESHOLD) {
      return {
        emailId: email.id,
        category: rule.category,
        confidence: rule.confidence,
        source: 'heuristic',
        reasoning: `Matched rule: ${rule.name}`,
        suggestedActions: getSuggestedActions(rule.category, email),
      }
    }
  }
  return null
}

/**
 * Standalone: apply rules against HeuristicInput.
 */
function applyHeuristicsStandalone(
  input: HeuristicInput
): HeuristicResult | null {
  for (const rule of unifiedRules) {
    if (rule.testInput(input)) {
      return {
        category: rule.category,
        confidence: rule.confidence,
        rule: rule.name,
      }
    }
  }
  return null
}

/**
 * Apply heuristics to a batch of emails.
 * Returns { resolved, unresolved } split.
 */
export function applyHeuristicsBatch(emails: MinimalEmailData[]): {
  resolved: CategorizationResult[]
  unresolved: MinimalEmailData[]
} {
  const resolved: CategorizationResult[] = []
  const unresolved: MinimalEmailData[] = []

  const ruleHits: Record<string, number> = {}

  for (const email of emails) {
    const result = applyHeuristicsInternal(email)
    if (result) {
      resolved.push(result)
      const ruleName = result.reasoning?.replace('Matched rule: ', '') ?? 'unknown'
      ruleHits[ruleName] = (ruleHits[ruleName] ?? 0) + 1
    } else {
      unresolved.push(email)
    }
  }

  console.log(`[Sweepy:Heuristics] Batch: ${resolved.length} resolved, ${unresolved.length} unresolved. Rule hits:`, ruleHits)

  return { resolved, unresolved }
}

