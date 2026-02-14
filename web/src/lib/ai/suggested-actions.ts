import type { MinimalEmailData } from '@shared/types/email'
import type { EmailCategory, SuggestedAction } from '@shared/types/categories'

/**
 * Returns suggested actions for a given email category.
 * Unified implementation used by both heuristic and LLM pipelines.
 */
export function getSuggestedActions(
  category: EmailCategory,
  email?: MinimalEmailData
): SuggestedAction[] {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

  switch (category) {
    case 'newsletter':
      if (email && !email.isRead) {
        return [
          { type: 'move_to_trash', reason: 'Newsletter you never opened', priority: 5 },
        ]
      }
      return [{ type: 'move_to_trash', reason: 'Newsletter', priority: 3 }]

    case 'marketing':
      return [
        { type: 'move_to_trash', reason: 'Marketing email', priority: 4 },
      ]

    case 'spam':
      return [{ type: 'move_to_trash', reason: 'Likely spam', priority: 5 }]

    case 'transactional': {
      const isOld = email
        ? new Date(email.date).getTime() < thirtyDaysAgo
        : false
      if (isOld) {
        return [
          {
            type: 'archive',
            reason: 'Old transactional email (>30 days)',
            priority: 3,
          },
        ]
      }
      return [{ type: 'keep', reason: 'Recent transactional email', priority: 1 }]
    }

    case 'social':
      return [{ type: 'move_to_trash', reason: 'Social notification', priority: 3 }]

    case 'notification':
      return [{ type: 'move_to_trash', reason: 'Notification', priority: 2 }]

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
