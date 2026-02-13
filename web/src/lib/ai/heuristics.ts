import type { MinimalEmailData } from '@shared/types/email'
import type {
  EmailCategory,
  CategorizationResult,
  SuggestedAction,
} from '@shared/types/categories'

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
    local.startsWith('no-reply')
  )
}

function hasMarketingMailerName(xMailer: string): boolean {
  const lower = xMailer.toLowerCase()
  return MARKETING_MAILER_PATTERNS.some((pattern) => lower.includes(pattern))
}

// ---------------------------------------------------------------------------
// Heuristic rule definitions (internal, for MinimalEmailData)
// ---------------------------------------------------------------------------

interface HeuristicRule {
  name: string
  priority: number
  test: (email: MinimalEmailData) => boolean
  category: EmailCategory
  confidence: number
}

const CONFIDENCE_THRESHOLD = 0.70

const rules: HeuristicRule[] = [
  // Rule 1: List-Unsubscribe header present -> newsletter (0.92)
  {
    name: 'list-unsubscribe-header',
    priority: 1,
    test: (e) => e.headers.hasListUnsubscribe && !e.headers.isNoreply,
    category: 'newsletter',
    confidence: 0.92,
  },
  // Rule 2: Precedence: bulk -> newsletter (0.90)
  {
    name: 'precedence-bulk',
    priority: 2,
    test: (e) => e.headers.hasPrecedenceBulk,
    category: 'newsletter',
    confidence: 0.90,
  },
  // Rule 3: Known marketing domains -> marketing (0.95)
  {
    name: 'known-marketing-domain',
    priority: 3,
    test: (e) => domainMatches(e.from.domain, MARKETING_SENDING_DOMAINS),
    category: 'marketing',
    confidence: 0.95,
  },
  // Rule 4: noreply + List-Unsubscribe -> newsletter (0.93)
  {
    name: 'noreply-with-unsubscribe',
    priority: 4,
    test: (e) => e.headers.isNoreply && e.headers.hasListUnsubscribe,
    category: 'newsletter',
    confidence: 0.93,
  },
  // Rule 5: noreply without List-Unsubscribe -> transactional (0.75)
  {
    name: 'noreply-no-unsubscribe',
    priority: 5,
    test: (e) => e.headers.isNoreply && !e.headers.hasListUnsubscribe,
    category: 'transactional',
    confidence: 0.75,
  },
  // Rule 6: Receipt/invoice/order subject -> transactional (0.88)
  {
    name: 'transactional-subject',
    priority: 6,
    test: (e) => TRANSACTIONAL_SUBJECT_PATTERNS.some((p) => p.test(e.subject)),
    category: 'transactional',
    confidence: 0.88,
  },
  // Rule 7: Known social domains -> social (0.90)
  {
    name: 'known-social-domain',
    priority: 7,
    test: (e) => domainMatches(e.from.domain, SOCIAL_DOMAINS),
    category: 'social',
    confidence: 0.90,
  },
  // Rule 8: Known dev tool / notification domains -> notification (0.88)
  {
    name: 'known-dev-tool-domain',
    priority: 8,
    test: (e) => domainMatches(e.from.domain, DEV_NOTIFICATION_DOMAINS),
    category: 'notification',
    confidence: 0.88,
  },
  // Rule 9: X-Campaign header present -> marketing (0.85)
  // Note: MinimalEmailData exposes xCampaign but not xMailer directly.
  // The standalone HeuristicInput path (standaloneRules) also checks xMailer.
  {
    name: 'x-campaign-header',
    priority: 9,
    test: (e) => !!e.headers.xCampaign,
    category: 'marketing',
    confidence: 0.85,
  },
  // Rule 10: Return-Path mismatch + List-Unsubscribe -> marketing (0.82)
  {
    name: 'return-path-mismatch-unsubscribe',
    priority: 10,
    test: (e) => e.headers.hasReturnPathMismatch && e.headers.hasListUnsubscribe,
    category: 'marketing',
    confidence: 0.82,
  },
]

// ---------------------------------------------------------------------------
// Heuristic rule definitions for HeuristicInput (standalone)
// ---------------------------------------------------------------------------

interface StandaloneRule {
  name: string
  priority: number
  test: (input: HeuristicInput) => boolean
  category: EmailCategory
  confidence: number
}

const standaloneRules: StandaloneRule[] = [
  // Rule 1: List-Unsubscribe header present -> newsletter (0.92)
  {
    name: 'list-unsubscribe-header',
    priority: 1,
    test: (input) =>
      !!input.headers.listUnsubscribe && !isNoreplyAddress(input.senderAddress),
    category: 'newsletter',
    confidence: 0.92,
  },
  // Rule 2: Precedence: bulk -> newsletter (0.90)
  {
    name: 'precedence-bulk',
    priority: 2,
    test: (input) =>
      input.headers.precedence?.toLowerCase() === 'bulk',
    category: 'newsletter',
    confidence: 0.90,
  },
  // Rule 3: Known marketing domains -> marketing (0.95)
  {
    name: 'known-marketing-domain',
    priority: 3,
    test: (input) =>
      domainMatches(input.senderDomain.toLowerCase(), MARKETING_SENDING_DOMAINS),
    category: 'marketing',
    confidence: 0.95,
  },
  // Rule 4: noreply + List-Unsubscribe -> newsletter (0.93)
  {
    name: 'noreply-with-unsubscribe',
    priority: 4,
    test: (input) =>
      isNoreplyAddress(input.senderAddress) && !!input.headers.listUnsubscribe,
    category: 'newsletter',
    confidence: 0.93,
  },
  // Rule 5: noreply without List-Unsubscribe -> transactional (0.75)
  {
    name: 'noreply-no-unsubscribe',
    priority: 5,
    test: (input) =>
      isNoreplyAddress(input.senderAddress) && !input.headers.listUnsubscribe,
    category: 'transactional',
    confidence: 0.75,
  },
  // Rule 6: Receipt/invoice/order subject -> transactional (0.88)
  {
    name: 'transactional-subject',
    priority: 6,
    test: (input) =>
      TRANSACTIONAL_SUBJECT_PATTERNS.some((p) => p.test(input.subject)),
    category: 'transactional',
    confidence: 0.88,
  },
  // Rule 7: Known social domains -> social (0.90)
  {
    name: 'known-social-domain',
    priority: 7,
    test: (input) =>
      domainMatches(input.senderDomain.toLowerCase(), SOCIAL_DOMAINS),
    category: 'social',
    confidence: 0.90,
  },
  // Rule 8: Known dev tool / notification domains -> notification (0.88)
  {
    name: 'known-dev-tool-domain',
    priority: 8,
    test: (input) =>
      domainMatches(input.senderDomain.toLowerCase(), DEV_NOTIFICATION_DOMAINS),
    category: 'notification',
    confidence: 0.88,
  },
  // Rule 9: X-Campaign or X-Mailer header with marketing tool names -> marketing (0.85)
  {
    name: 'x-campaign-or-x-mailer-header',
    priority: 9,
    test: (input) =>
      !!input.headers.xCampaign ||
      (!!input.headers.xMailer && hasMarketingMailerName(input.headers.xMailer)),
    category: 'marketing',
    confidence: 0.85,
  },
  // Rule 10: Return-Path domain mismatch from sender domain + List-Unsubscribe -> marketing (0.82)
  {
    name: 'return-path-mismatch-unsubscribe',
    priority: 10,
    test: (input) => {
      if (!input.headers.returnPath || !input.headers.listUnsubscribe) return false
      const returnPathDomain = extractDomainFromReturnPath(input.headers.returnPath)
      if (!returnPathDomain) return false
      return returnPathDomain !== input.senderDomain.toLowerCase()
    },
    category: 'marketing',
    confidence: 0.82,
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
  for (const rule of rules) {
    if (rule.test(email) && rule.confidence >= CONFIDENCE_THRESHOLD) {
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
  for (const rule of standaloneRules) {
    if (rule.test(input)) {
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

// ---------------------------------------------------------------------------
// Suggested actions per category
// ---------------------------------------------------------------------------

function getSuggestedActions(
  category: EmailCategory,
  email: MinimalEmailData
): SuggestedAction[] {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

  switch (category) {
    case 'newsletter':
      if (!email.isRead) {
        return [
          { type: 'unsubscribe', reason: 'Newsletter you never opened', priority: 5 },
          { type: 'archive', reason: 'Clean up inbox', priority: 4 },
        ]
      }
      return [{ type: 'archive', reason: 'Read newsletter', priority: 3 }]

    case 'marketing':
      return [
        { type: 'unsubscribe', reason: 'Marketing email', priority: 4 },
        { type: 'archive', reason: 'Clean up inbox', priority: 3 },
      ]

    case 'spam':
      return [{ type: 'move_to_trash', reason: 'Likely spam', priority: 5 }]

    case 'transactional':
      if (new Date(email.date).getTime() < thirtyDaysAgo) {
        return [
          {
            type: 'archive',
            reason: 'Old transactional email (>30 days)',
            priority: 3,
          },
        ]
      }
      return [{ type: 'keep', reason: 'Recent transactional email', priority: 1 }]

    case 'social':
      return [{ type: 'archive', reason: 'Social notification', priority: 3 }]

    case 'notification':
      return [{ type: 'archive', reason: 'Notification', priority: 2 }]

    case 'personal':
    case 'important':
      return [
        {
          type: 'keep',
          reason: 'Personal/important email — never auto-remove',
          priority: 1,
        },
      ]

    default:
      return [{ type: 'keep', reason: 'Unknown category', priority: 1 }]
  }
}
