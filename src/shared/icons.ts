export const ICON_COLOR_IDS = [
  'slate',
  'rose',
  'peach',
  'amber',
  'sage',
  'mint',
  'sky',
  'indigo',
  'lilac',
  'blush'
] as const

export type IconColorId = (typeof ICON_COLOR_IDS)[number]

export const ICON_ACCENT: Record<IconColorId, string> = {
  slate: 'oklch(0.42 0.03 250)',
  rose: 'oklch(0.48 0.1 12)',
  peach: 'oklch(0.5 0.08 50)',
  amber: 'oklch(0.5 0.08 75)',
  sage: 'oklch(0.42 0.06 140)',
  mint: 'oklch(0.4 0.06 175)',
  sky: 'oklch(0.42 0.07 230)',
  indigo: 'oklch(0.44 0.08 275)',
  lilac: 'oklch(0.45 0.08 310)',
  blush: 'oklch(0.48 0.08 350)'
}

export const ICON_NAMES = [
  'BookOpen',
  'Notebook',
  'Library',
  'Layers',
  'LayoutGrid',
  'House',
  'Folder',
  'FolderOpen',
  'FolderPlus',
  'FileText',
  'FileCode',
  'FileCode2',
  'FileJson',
  'Table2',
  'File',
  'Files',
  'StickyNote',
  'ScrollText',
  'Code',
  'CodeXml',
  'Terminal',
  'Braces',
  'Brackets',
  'Binary',
  'Bug',
  'Cpu',
  'Database',
  'Server',
  'Globe',
  'Link',
  'Hash',
  'Pencil',
  'PenLine',
  'Highlighter',
  'Eraser',
  'Type',
  'Quote',
  'List',
  'ListOrdered',
  'Check',
  'CheckSquare',
  'Square',
  'Circle',
  'Triangle',
  'Hexagon',
  'Diamond',
  'Sparkles',
  'Star',
  'Heart',
  'Bookmark',
  'Flag',
  'Pin',
  'Lightbulb',
  'Flame',
  'Zap',
  'Sun',
  'Moon',
  'Cloud',
  'Leaf',
  'Flower2',
  'Mountain',
  'Compass',
  'Map',
  'Rocket',
  'Plane',
  'Ship',
  'Bike',
  'Car',
  'Camera',
  'Image',
  'Music',
  'Headphones',
  'Mic',
  'Video',
  'Play',
  'Pause',
  'Timer',
  'Clock',
  'Calendar',
  'AlarmClock',
  'Bell',
  'Inbox',
  'Mail',
  'MessageSquare',
  'MessagesSquare',
  'Phone',
  'User',
  'Users',
  'Smile',
  'Settings',
  'SlidersHorizontal',
  'Wrench',
  'Hammer',
  'Key',
  'Lock',
  'Unlock',
  'Shield',
  'Search',
  'Filter',
  'Paperclip',
  'Clipboard',
  'Copy',
  'Archive',
  'Trash2',
  'Box',
  'Package',
  'Puzzle',
  'Shapes',
  'Palette',
  'Pipette',
  'Aperture',
  'Atom',
  'Brain',
  'Dna',
  'FlaskConical',
  'TestTube',
  'Calculator',
  'LineChart',
  'TrendingUp',
  'Target',
  'Gauge',
  'Wallet',
  'CreditCard',
  'ShoppingBag',
  'Gift',
  'Trophy',
  'Medal',
  'Crown'
] as const

export type IconName = (typeof ICON_NAMES)[number]

export function isIconName(value: string): value is IconName {
  return (ICON_NAMES as readonly string[]).includes(value)
}

export function isIconColorId(value: string): value is IconColorId {
  return (ICON_COLOR_IDS as readonly string[]).includes(value)
}

export function defaultIconForPage(
  type: 'markdown' | 'javascript' | 'typescript' | 'csv'
): IconName {
  if (type === 'javascript') return 'FileCode'
  if (type === 'typescript') return 'FileCode2'
  if (type === 'csv') return 'Table2'
  return 'FileText'
}

export function defaultColorForPage(
  type: 'markdown' | 'javascript' | 'typescript' | 'csv'
): IconColorId {
  if (type === 'javascript') return 'peach'
  if (type === 'typescript') return 'sky'
  if (type === 'csv') return 'sage'
  return 'slate'
}

export function normalizeIcon(value: string, fallback: IconName = 'FileText'): IconName {
  return isIconName(value) ? value : fallback
}

export function normalizeColor(value: string, fallback: IconColorId = 'slate'): IconColorId {
  return isIconColorId(value) ? value : fallback
}
