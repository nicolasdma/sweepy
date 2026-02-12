import type { MinimalEmailData } from '@shared/types/email'
import type { EmailCategory, CategorizationResult, SuggestedAction } from '@shared/types/categories'

interface HeuristicRule {
  name: string
  priority: number
  test: (email: MinimalEmailData) => boolean
  category: EmailCategory
  confidence: number
}

// Known marketing/bulk sender domains
const MARKETING_DOMAINS = new Set([
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
  'klaviyo.com',
  'brevo.com',
  'sendinblue.com',
  'mailerlite.com',
  'convertkit.com',
  'drip.com',
  'aweber.com',
  'getresponse.com',
  'activecampaign.com',
  'customer.io',
  'intercom-mail.com',
  'mandrillapp.com',
  'amazonses.com',
  'postmarkapp.com',
  'sparkpostmail.com',
  'email.mg',
])

// Known social media notification domains
const SOCIAL_DOMAINS = new Set([
  'facebookmail.com',
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
  'medium.com',
  'quora.com',
])

// Known dev tool / notification domains
const DEV_TOOL_DOMAINS = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'atlassian.com',
  'jira.com',
  'slack.com',
  'notion.so',
  'figma.com',
  'vercel.com',
  'netlify.com',
  'heroku.com',
  'sentry.io',
  'datadog.com',
  'pagerduty.com',
  'circleci.com',
  'travisci.com',
  'npmjs.com',
])

// Receipt/invoice/order subject patterns
const TRANSACTIONAL_SUBJECT_PATTERNS = [
  /\b(receipt|invoice|order\s*(confirmation|#|number)|payment\s*(confirmation|received)|shipping\s*(confirmation|update|notification)|delivery\s*(confirmation|update)|tracking\s*(number|#|update))\b/i,
  /\b(your\s+order|order\s+shipped|out\s+for\s+delivery|has\s+been\s+delivered)\b/i,
  /\b(subscription\s+(renewed|confirmed|activated)|billing\s+statement|charge\s+of)\b/i,
  /\b(password\s+reset|verify\s+your|confirm\s+your\s+(email|account)|two-factor|2fa|security\s+code)\b/i,
]

const CONFIDENCE_THRESHOLD = 0.80

const rules: HeuristicRule[] = [
  // Rule 1: List-Unsubscribe header → newsletter
  {
    name: 'list-unsubscribe-header',
    priority: 1,
    test: (e) => e.headers.hasListUnsubscribe && !e.headers.isNoreply,
    category: 'newsletter',
    confidence: 0.92,
  },
  // Rule 2: Precedence: bulk → newsletter
  {
    name: 'precedence-bulk',
    priority: 2,
    test: (e) => e.headers.hasPrecedenceBulk,
    category: 'newsletter',
    confidence: 0.90,
  },
  // Rule 3: Known marketing domains → marketing
  {
    name: 'known-marketing-domain',
    priority: 3,
    test: (e) => {
      const domain = e.from.domain
      // Check if the return path domain (or from domain) is a marketing platform
      return MARKETING_DOMAINS.has(domain) || isSubdomainOfSet(domain, MARKETING_DOMAINS)
    },
    category: 'marketing',
    confidence: 0.95,
  },
  // Rule 4: noreply + List-Unsubscribe → newsletter
  {
    name: 'noreply-with-unsubscribe',
    priority: 4,
    test: (e) => e.headers.isNoreply && e.headers.hasListUnsubscribe,
    category: 'newsletter',
    confidence: 0.93,
  },
  // Rule 5: noreply without List-Unsubscribe → transactional
  {
    name: 'noreply-no-unsubscribe',
    priority: 5,
    test: (e) => e.headers.isNoreply && !e.headers.hasListUnsubscribe,
    category: 'transactional',
    confidence: 0.75,
  },
  // Rule 6: Receipt/invoice/order subject → transactional
  {
    name: 'transactional-subject',
    priority: 6,
    test: (e) => TRANSACTIONAL_SUBJECT_PATTERNS.some((p) => p.test(e.subject)),
    category: 'transactional',
    confidence: 0.88,
  },
  // Rule 7: Known social domains → social
  {
    name: 'known-social-domain',
    priority: 7,
    test: (e) => SOCIAL_DOMAINS.has(e.from.domain) || isSubdomainOfSet(e.from.domain, SOCIAL_DOMAINS),
    category: 'social',
    confidence: 0.90,
  },
  // Rule 8: Known dev tool domains → notification
  {
    name: 'known-dev-tool-domain',
    priority: 8,
    test: (e) => DEV_TOOL_DOMAINS.has(e.from.domain) || isSubdomainOfSet(e.from.domain, DEV_TOOL_DOMAINS),
    category: 'notification',
    confidence: 0.88,
  },
  // Rule 9: X-Campaign header → marketing
  {
    name: 'x-campaign-header',
    priority: 9,
    test: (e) => !!e.headers.xCampaign,
    category: 'marketing',
    confidence: 0.85,
  },
  // Rule 10: Return-Path mismatch + List-Unsubscribe → marketing
  {
    name: 'return-path-mismatch-unsubscribe',
    priority: 10,
    test: (e) => e.headers.hasReturnPathMismatch && e.headers.hasListUnsubscribe,
    category: 'marketing',
    confidence: 0.82,
  },
]

function isSubdomainOfSet(domain: string, domainSet: Set<string>): boolean {
  const parts = domain.split('.')
  for (let i = 1; i < parts.length; i++) {
    const parent = parts.slice(i).join('.')
    if (domainSet.has(parent)) return true
  }
  return false
}

/**
 * Apply heuristic rules to categorize a single email.
 * Returns result if confidence >= threshold, null otherwise.
 */
export function applyHeuristics(email: MinimalEmailData): CategorizationResult | null {
  // Rules are already sorted by priority
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
 * Apply heuristics to a batch of emails.
 * Returns { resolved, unresolved } split.
 */
export function applyHeuristicsBatch(emails: MinimalEmailData[]): {
  resolved: CategorizationResult[]
  unresolved: MinimalEmailData[]
} {
  const resolved: CategorizationResult[] = []
  const unresolved: MinimalEmailData[] = []

  for (const email of emails) {
    const result = applyHeuristics(email)
    if (result) {
      resolved.push(result)
    } else {
      unresolved.push(email)
    }
  }

  return { resolved, unresolved }
}

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
      return [
        { type: 'archive', reason: 'Read newsletter', priority: 3 },
      ]

    case 'marketing':
      return [
        { type: 'unsubscribe', reason: 'Marketing email', priority: 4 },
        { type: 'archive', reason: 'Clean up inbox', priority: 3 },
      ]

    case 'spam':
      return [
        { type: 'move_to_trash', reason: 'Likely spam', priority: 5 },
      ]

    case 'transactional':
      if (new Date(email.date).getTime() < thirtyDaysAgo) {
        return [
          { type: 'archive', reason: 'Old transactional email (>30 days)', priority: 3 },
        ]
      }
      return [
        { type: 'keep', reason: 'Recent transactional email', priority: 1 },
      ]

    case 'social':
      return [
        { type: 'archive', reason: 'Social notification', priority: 3 },
      ]

    case 'notification':
      return [
        { type: 'archive', reason: 'Notification', priority: 2 },
      ]

    case 'personal':
    case 'important':
      return [
        { type: 'keep', reason: 'Personal/important email — never auto-remove', priority: 1 },
      ]

    default:
      return [
        { type: 'keep', reason: 'Unknown category', priority: 1 },
      ]
  }
}
