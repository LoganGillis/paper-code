import type { Page, Space } from '@shared/api'

export const DESK_PREFIX = 'paper:desk:'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

const EPIGRAPHS = [
  'Lay the page out.',
  'Keep the ink moving.',
  'The middle is still a beginning.',
  'One true sentence.',
  'Leave a note for Monday.',
  'Wander.',
  'Rest, then underline.'
]

export function isDeskPageId(id: string): boolean {
  return id.startsWith(DESK_PREFIX)
}

export function deskPageId(spaceId: string): string {
  return `${DESK_PREFIX}${spaceId}`
}

export function spaceIdFromDesk(id: string): string | null {
  return isDeskPageId(id) ? id.slice(DESK_PREFIX.length) : null
}

export function startOfWeek(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = day.getDay()
  day.setDate(day.getDate() + (weekday === 0 ? -6 : 1 - weekday))
  return day
}

export function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function dailyTitle(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export function weekdayName(date: Date): string {
  return WEEKDAYS[date.getDay()] ?? ''
}

export function weekdayShort(date: Date): string {
  return WEEKDAYS_SHORT[date.getDay()] ?? ''
}

export function epigraphFor(date: Date): string {
  return EPIGRAPHS[date.getDay()] ?? ''
}

export function formatClock(date: Date): string {
  const hours = date.getHours()
  const hour12 = hours % 12 || 12
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const suffix = hours < 12 ? 'am' : 'pm'
  return `${hour12}:${minutes} ${suffix}`
}

export function weekDays(from = new Date()): Date[] {
  const monday = startOfWeek(from)
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function dailyDoc(date: Date): object {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: dailyTitle(date) }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: weekdayName(date) }]
      },
      { type: 'paragraph' }
    ]
  }
}

export function buildDeskPage(space: Space): Page {
  const now = new Date().toISOString()
  return {
    id: deskPageId(space.id),
    spaceId: space.id,
    folderId: null,
    title: 'Desk',
    type: 'markdown',
    content: '',
    description: '',
    icon: 'House',
    iconColor: space.iconColor,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now
  }
}
