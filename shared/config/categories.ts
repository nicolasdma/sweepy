import type { EmailCategory } from '../types/categories'

export const CATEGORY_CONFIG: Record<
  EmailCategory,
  { label: string; emoji: string; color: string; protected: boolean; defaultAction: string; order: number }
> = {
  spam:          { label: 'Spam',          emoji: '🗑️', color: 'red',     protected: false, defaultAction: 'move_to_trash', order: 1 },
  marketing:     { label: 'Marketing',     emoji: '🛍️', color: 'purple',  protected: false, defaultAction: 'move_to_trash', order: 2 },
  newsletter:    { label: 'Newsletter',    emoji: '📰', color: 'blue',    protected: false, defaultAction: 'move_to_trash', order: 3 },
  notification:  { label: 'Notification',  emoji: '🔔', color: 'amber',   protected: false, defaultAction: 'move_to_trash', order: 4 },
  social:        { label: 'Social',        emoji: '📱', color: 'pink',    protected: false, defaultAction: 'move_to_trash', order: 5 },
  transactional: { label: 'Transactional', emoji: '🧾', color: 'emerald', protected: false, defaultAction: 'keep',          order: 6 },
  personal:      { label: 'Personal',      emoji: '✉️', color: 'indigo',  protected: true,  defaultAction: 'keep',          order: 7 },
  important:     { label: 'Important',     emoji: '⭐', color: 'emerald', protected: true,  defaultAction: 'keep',          order: 8 },
  unknown:       { label: 'Unknown',       emoji: '❓', color: 'gray',    protected: false, defaultAction: 'keep',          order: 9 },
} as const

export const CATEGORY_ORDER = (Object.entries(CATEGORY_CONFIG) as [EmailCategory, typeof CATEGORY_CONFIG[EmailCategory]][])
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([k]) => k)

export const PROTECTED_CATEGORIES = new Set(
  (Object.entries(CATEGORY_CONFIG) as [EmailCategory, typeof CATEGORY_CONFIG[EmailCategory]][])
    .filter(([, v]) => v.protected)
    .map(([k]) => k)
)

export const CLEANUP_CATEGORIES = (Object.entries(CATEGORY_CONFIG) as [EmailCategory, typeof CATEGORY_CONFIG[EmailCategory]][])
  .filter(([, v]) => !v.protected && v.defaultAction !== 'keep')
  .map(([k]) => k)

// Tailwind color mappings
export const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string; gradient: string; bar: string }> = {
  spam:          { text: 'text-red-600',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     gradient: 'from-red-500/8 to-red-500/3',       bar: 'bg-red-400' },
  marketing:     { text: 'text-purple-600',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  gradient: 'from-purple-500/8 to-purple-500/3', bar: 'bg-purple-400' },
  newsletter:    { text: 'text-blue-600',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    gradient: 'from-blue-500/8 to-blue-500/3',     bar: 'bg-blue-400' },
  notification:  { text: 'text-amber-600',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   gradient: 'from-amber-500/8 to-amber-500/3',   bar: 'bg-amber-400' },
  social:        { text: 'text-pink-600',    bg: 'bg-pink-500/10',    border: 'border-pink-500/20',    gradient: 'from-pink-500/8 to-pink-500/3',     bar: 'bg-pink-400' },
  transactional: { text: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', gradient: 'from-emerald-500/8 to-emerald-500/3', bar: 'bg-emerald-400' },
  personal:      { text: 'text-indigo-600',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  gradient: 'from-indigo-500/8 to-indigo-500/3', bar: 'bg-indigo-400' },
  important:     { text: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', gradient: 'from-emerald-500/8 to-emerald-500/3', bar: 'bg-emerald-500' },
  unknown:       { text: 'text-gray-600',    bg: 'bg-gray-500/10',    border: 'border-gray-500/20',    gradient: 'from-gray-500/8 to-gray-500/3',     bar: 'bg-gray-400' },
}

// Presentation groups — 3 super-groups for the user (semáforo: clean/review/safe)
export type CategoryGroupKey = 'cleanup' | 'review' | 'safe'

export interface CategoryGroup {
  key: CategoryGroupKey
  label: string
  emoji: string
  description: string
  categories: EmailCategory[]
  gradient: string
  text: string
  bar: string
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    key: 'cleanup',
    label: 'Clean up',
    emoji: '🧹',
    description: 'Emails you can safely trash',
    categories: ['spam', 'marketing', 'newsletter', 'notification', 'social'],
    gradient: 'from-red-500/8 to-orange-500/3',
    text: 'text-red-600',
    bar: 'bg-red-400',
  },
  {
    key: 'review',
    label: 'Review',
    emoji: '👀',
    description: 'Might be useful — take a quick look',
    categories: ['transactional', 'unknown'],
    gradient: 'from-amber-500/8 to-yellow-500/3',
    text: 'text-amber-600',
    bar: 'bg-amber-400',
  },
  {
    key: 'safe',
    label: 'Keep',
    emoji: '✅',
    description: 'Personal and important emails — no changes',
    categories: ['personal', 'important'],
    gradient: 'from-emerald-500/8 to-green-500/3',
    text: 'text-emerald-600',
    bar: 'bg-emerald-400',
  },
]

// Extension-specific color mappings (Tailwind v3 compatible)
export const CATEGORY_EXT_COLORS: Record<string, { colorClasses: string; badgeBg: string }> = {
  spam:          { colorClasses: 'text-red-700 bg-red-50 border-red-200',       badgeBg: 'bg-red-100 text-red-700' },
  marketing:     { colorClasses: 'text-purple-700 bg-purple-50 border-purple-200', badgeBg: 'bg-purple-100 text-purple-700' },
  newsletter:    { colorClasses: 'text-blue-700 bg-blue-50 border-blue-200',    badgeBg: 'bg-blue-100 text-blue-700' },
  notification:  { colorClasses: 'text-amber-700 bg-amber-50 border-amber-200', badgeBg: 'bg-amber-100 text-amber-700' },
  social:        { colorClasses: 'text-pink-700 bg-pink-50 border-pink-200',    badgeBg: 'bg-pink-100 text-pink-700' },
  transactional: { colorClasses: 'text-emerald-700 bg-emerald-50 border-emerald-200', badgeBg: 'bg-emerald-100 text-emerald-700' },
  personal:      { colorClasses: 'text-indigo-700 bg-indigo-50 border-indigo-200', badgeBg: 'bg-indigo-100 text-indigo-700' },
  important:     { colorClasses: 'text-emerald-700 bg-emerald-50 border-emerald-200', badgeBg: 'bg-emerald-100 text-emerald-700' },
  unknown:       { colorClasses: 'text-gray-700 bg-gray-50 border-gray-200',    badgeBg: 'bg-gray-100 text-gray-700' },
}
