import type { Page } from '@shared/api'

export const DESK_PAGE_ID = 'paper:desk'

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
  return id === DESK_PAGE_ID || id.startsWith('paper:desk:')
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

export function buildDeskPage(spaceId: string): Page {
  const now = new Date().toISOString()
  return {
    id: DESK_PAGE_ID,
    spaceId,
    folderId: null,
    title: 'Desk',
    type: 'markdown',
    content: '',
    description: '',
    icon: 'House',
    iconColor: 'slate',
    sortOrder: 0,
    archived: false,
    deletedAt: null,
    locked: false,
    spellcheck: false,
    createdAt: now,
    updatedAt: now
  }
}
