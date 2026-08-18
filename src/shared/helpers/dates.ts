import { inspect } from 'node:util'

export type DateUnit =
  'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond'

export type WeekdayName =
  'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'

type Clock = () => Date

const WEEKDAYS: WeekdayName[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
]

const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
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
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

function copy(date: Date): Date {
  return new Date(date.getTime())
}

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

function localDateTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
): Date {
  return new Date(year, month - 1, day, hour, minute, second, millisecond)
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfIsoWeek(date: Date): Date {
  const day = startOfLocalDay(date)
  const weekday = day.getDay()
  const iso = weekday === 0 ? 7 : weekday
  day.setDate(day.getDate() - (iso - 1))
  return day
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function addMonths(date: Date, amount: number): Date {
  const year = date.getFullYear()
  const monthIndex = date.getMonth() + amount
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()
  const millisecond = date.getMilliseconds()
  const cursor = new Date(year, monthIndex, 1, hour, minute, second, millisecond)
  cursor.setDate(Math.min(day, lastDayOfMonth(cursor.getFullYear(), cursor.getMonth() + 1)))
  return cursor
}

function parseWeekday(input: number | string): number {
  if (typeof input === 'number') {
    if (input >= 1 && input <= 7 && Number.isInteger(input)) {
      return input === 7 ? 0 : input
    }
    if (input >= 0 && input <= 6 && Number.isInteger(input)) return input
    throw new Error(`Unknown weekday number: ${input}`)
  }
  const key = input.trim().toLowerCase()
  const full = WEEKDAYS.indexOf(key as WeekdayName)
  if (full >= 0) return full
  const short = WEEKDAY_SHORT.findIndex((name) => name.toLowerCase() === key)
  if (short >= 0) return short
  throw new Error(`Unknown weekday: ${input}`)
}

function parseIsoDate(value: string): { date: Date; kind: 'date' | 'time' } | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (dateOnly) {
    return {
      kind: 'date',
      date: localDate(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]))
    }
  }
  const dateTime = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
    value.trim()
  )
  if (dateTime) {
    return {
      kind: 'time',
      date: localDateTime(
        Number(dateTime[1]),
        Number(dateTime[2]),
        Number(dateTime[3]),
        Number(dateTime[4]),
        Number(dateTime[5]),
        Number(dateTime[6] ?? 0),
        Number((dateTime[7] ?? '0').padEnd(3, '0'))
      )
    }
  }
  return null
}

export class $Date {
  readonly #value: Date
  readonly #kind: 'date' | 'time'

  constructor(value: Date, kind: 'date' | 'time') {
    this.#value = kind === 'date' ? startOfLocalDay(value) : copy(value)
    this.#kind = kind
  }

  static from(value: Date, kind: 'date' | 'time' = 'date'): $Date {
    return new $Date(value, kind)
  }

  get kind(): 'date' | 'time' {
    return this.#kind
  }

  get year(): number {
    return this.#value.getFullYear()
  }

  get month(): number {
    return this.#value.getMonth() + 1
  }

  get day(): number {
    return this.#value.getDate()
  }

  get hour(): number {
    return this.#kind === 'date' ? 0 : this.#value.getHours()
  }

  get minute(): number {
    return this.#kind === 'date' ? 0 : this.#value.getMinutes()
  }

  get second(): number {
    return this.#kind === 'date' ? 0 : this.#value.getSeconds()
  }

  get millisecond(): number {
    return this.#kind === 'date' ? 0 : this.#value.getMilliseconds()
  }

  get weekday(): number {
    return this.#value.getDay()
  }

  get weekdayName(): string {
    return WEEKDAY_LABELS[this.weekday] ?? 'Sunday'
  }

  get isoWeekday(): number {
    return this.weekday === 0 ? 7 : this.weekday
  }

  get isWeekend(): boolean {
    return this.weekday === 0 || this.weekday === 6
  }

  get isWeekday(): boolean {
    return !this.isWeekend
  }

  addDays(amount: number): $Date {
    const next = copy(this.#value)
    next.setDate(next.getDate() + amount)
    return new $Date(next, this.#kind)
  }

  subDays(amount: number): $Date {
    return this.addDays(-amount)
  }

  addWeeks(amount: number): $Date {
    return this.addDays(amount * 7)
  }

  subWeeks(amount: number): $Date {
    return this.addWeeks(-amount)
  }

  addMonths(amount: number): $Date {
    return new $Date(addMonths(this.#value, amount), this.#kind)
  }

  subMonths(amount: number): $Date {
    return this.addMonths(-amount)
  }

  addYears(amount: number): $Date {
    return this.addMonths(amount * 12)
  }

  subYears(amount: number): $Date {
    return this.addYears(-amount)
  }

  addHours(amount: number): $Date {
    const next = copy(this.#kind === 'date' ? startOfLocalDay(this.#value) : this.#value)
    next.setHours(next.getHours() + amount)
    return new $Date(next, 'time')
  }

  subHours(amount: number): $Date {
    return this.addHours(-amount)
  }

  addMinutes(amount: number): $Date {
    const next = copy(this.#kind === 'date' ? startOfLocalDay(this.#value) : this.#value)
    next.setMinutes(next.getMinutes() + amount)
    return new $Date(next, 'time')
  }

  subMinutes(amount: number): $Date {
    return this.addMinutes(-amount)
  }

  addSeconds(amount: number): $Date {
    const next = copy(this.#kind === 'date' ? startOfLocalDay(this.#value) : this.#value)
    next.setSeconds(next.getSeconds() + amount)
    return new $Date(next, 'time')
  }

  subSeconds(amount: number): $Date {
    return this.addSeconds(-amount)
  }

  addMilliseconds(amount: number): $Date {
    const next = copy(this.#kind === 'date' ? startOfLocalDay(this.#value) : this.#value)
    next.setMilliseconds(next.getMilliseconds() + amount)
    return new $Date(next, 'time')
  }

  subMilliseconds(amount: number): $Date {
    return this.addMilliseconds(-amount)
  }

  add(amount: number, unit: DateUnit): $Date {
    if (unit === 'year') return this.addYears(amount)
    if (unit === 'month') return this.addMonths(amount)
    if (unit === 'week') return this.addWeeks(amount)
    if (unit === 'day') return this.addDays(amount)
    if (unit === 'hour') return this.addHours(amount)
    if (unit === 'minute') return this.addMinutes(amount)
    if (unit === 'second') return this.addSeconds(amount)
    return this.addMilliseconds(amount)
  }

  sub(amount: number, unit: DateUnit): $Date {
    return this.add(-amount, unit)
  }

  startOf(unit: DateUnit | 'isoWeek' = 'day'): $Date {
    const value = copy(this.#value)
    if (unit === 'year') return new $Date(new Date(value.getFullYear(), 0, 1), 'date')
    if (unit === 'month')
      return new $Date(new Date(value.getFullYear(), value.getMonth(), 1), 'date')
    if (unit === 'week' || unit === 'isoWeek') return new $Date(startOfIsoWeek(value), 'date')
    if (unit === 'day')
      return new $Date(startOfLocalDay(value), this.#kind === 'time' ? 'time' : 'date')
    if (unit === 'hour') {
      return new $Date(
        new Date(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), 0, 0, 0),
        'time'
      )
    }
    if (unit === 'minute') {
      return new $Date(
        new Date(
          value.getFullYear(),
          value.getMonth(),
          value.getDate(),
          value.getHours(),
          value.getMinutes(),
          0,
          0
        ),
        'time'
      )
    }
    return new $Date(
      new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        value.getHours(),
        value.getMinutes(),
        value.getSeconds(),
        0
      ),
      'time'
    )
  }

  endOf(unit: DateUnit | 'isoWeek' = 'day'): $Date {
    if (unit === 'year') return new $Date(new Date(this.year, 11, 31, 23, 59, 59, 999), 'time')
    if (unit === 'month') {
      return new $Date(new Date(this.year, this.month, 0, 23, 59, 59, 999), 'time')
    }
    if (unit === 'week' || unit === 'isoWeek') {
      return this.startOf('week').addDays(6).endOf('day')
    }
    if (unit === 'day') {
      return new $Date(new Date(this.year, this.month - 1, this.day, 23, 59, 59, 999), 'time')
    }
    if (unit === 'hour') {
      return new $Date(
        new Date(this.year, this.month - 1, this.day, this.hour, 59, 59, 999),
        'time'
      )
    }
    if (unit === 'minute') {
      return new $Date(
        new Date(this.year, this.month - 1, this.day, this.hour, this.minute, 59, 999),
        'time'
      )
    }
    return new $Date(
      new Date(this.year, this.month - 1, this.day, this.hour, this.minute, this.second, 999),
      'time'
    )
  }

  startOfDay(): $Date {
    return this.startOf('day')
  }

  endOfDay(): $Date {
    return this.endOf('day')
  }

  startOfWeek(): $Date {
    return this.startOf('week')
  }

  endOfWeek(): $Date {
    return this.startOf('week').addDays(6)
  }

  startOfMonth(): $Date {
    return this.startOf('month')
  }

  endOfMonth(): $Date {
    return new $Date(new Date(this.year, this.month, 0), 'date')
  }

  startOfYear(): $Date {
    return this.startOf('year')
  }

  endOfYear(): $Date {
    return new $Date(new Date(this.year, 11, 31), 'date')
  }

  next(weekday: number | string): $Date {
    const target = parseWeekday(weekday)
    const delta = (target - this.weekday + 7) % 7
    return this.addDays(delta === 0 ? 7 : delta)
  }

  previous(weekday: number | string): $Date {
    const target = parseWeekday(weekday)
    const delta = (this.weekday - target + 7) % 7
    return this.subDays(delta === 0 ? 7 : delta)
  }

  at(hour: number, minute = 0, second = 0, millisecond = 0): $Date {
    return new $Date(
      localDateTime(this.year, this.month, this.day, hour, minute, second, millisecond),
      'time'
    )
  }

  toDate(): $Date {
    return new $Date(this.#value, 'date')
  }

  toTime(): $Date {
    return new $Date(this.#kind === 'date' ? startOfLocalDay(this.#value) : this.#value, 'time')
  }

  toNative(): Date {
    return copy(this.#value)
  }

  isSame(
    other: $Date,
    unit: DateUnit = this.#kind === 'date' || other.#kind === 'date' ? 'day' : 'millisecond'
  ): boolean {
    if (unit === 'year') return this.year === other.year
    if (unit === 'month') return this.year === other.year && this.month === other.month
    if (unit === 'week') return this.startOf('week').isSame(other.startOf('week'), 'day')
    if (unit === 'day') {
      return this.year === other.year && this.month === other.month && this.day === other.day
    }
    if (unit === 'hour') return this.isSame(other, 'day') && this.hour === other.hour
    if (unit === 'minute') return this.isSame(other, 'hour') && this.minute === other.minute
    if (unit === 'second') return this.isSame(other, 'minute') && this.second === other.second
    return this.toNative().getTime() === other.toNative().getTime()
  }

  isBefore(other: $Date): boolean {
    return this.valueOf() < other.valueOf()
  }

  isAfter(other: $Date): boolean {
    return this.valueOf() > other.valueOf()
  }

  isSameOrBefore(other: $Date): boolean {
    return this.isSame(other) || this.isBefore(other)
  }

  isSameOrAfter(other: $Date): boolean {
    return this.isSame(other) || this.isAfter(other)
  }

  isToday(clock: Clock = () => new Date()): boolean {
    return this.isSame($Date.from(clock(), 'date'), 'day')
  }

  isYesterday(clock: Clock = () => new Date()): boolean {
    return this.isSame($Date.from(clock(), 'date').subDays(1), 'day')
  }

  isTomorrow(clock: Clock = () => new Date()): boolean {
    return this.isSame($Date.from(clock(), 'date').addDays(1), 'day')
  }

  diff(other: $Date, unit: DateUnit = 'day'): number {
    if (unit === 'year') {
      return (
        this.year -
        other.year -
        (this.month < other.month || (this.month === other.month && this.day < other.day) ? 1 : 0)
      )
    }
    if (unit === 'month') {
      return (
        (this.year - other.year) * 12 + (this.month - other.month) - (this.day < other.day ? 1 : 0)
      )
    }
    const ms = this.valueOf() - other.valueOf()
    if (unit === 'week') return Math.trunc(ms / 604_800_000)
    if (unit === 'day') return Math.trunc(ms / 86_400_000)
    if (unit === 'hour') return Math.trunc(ms / 3_600_000)
    if (unit === 'minute') return Math.trunc(ms / 60_000)
    if (unit === 'second') return Math.trunc(ms / 1000)
    return ms
  }

  format(pattern?: string): string {
    const token = pattern ?? (this.#kind === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss')
    const hour = this.hour
    const meridiem = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 === 0 ? 12 : hour % 12
    return token.replace(
      /YYYY|MMMM|dddd|MMM|ddd|YY|MM|DD|HH|hh|mm|ss|SSS|A|a|M|D|H|h|m|s/g,
      (match) => {
        if (match === 'YYYY') return String(this.year)
        if (match === 'YY') return pad(this.year % 100)
        if (match === 'MMMM') return MONTH_LABELS[this.month - 1] ?? ''
        if (match === 'MMM') return MONTH_SHORT[this.month - 1] ?? ''
        if (match === 'MM') return pad(this.month)
        if (match === 'M') return String(this.month)
        if (match === 'DD') return pad(this.day)
        if (match === 'D') return String(this.day)
        if (match === 'dddd') return this.weekdayName
        if (match === 'ddd') return WEEKDAY_SHORT[this.weekday] ?? ''
        if (match === 'HH') return pad(hour)
        if (match === 'H') return String(hour)
        if (match === 'hh') return pad(hour12)
        if (match === 'h') return String(hour12)
        if (match === 'mm') return pad(this.minute)
        if (match === 'm') return String(this.minute)
        if (match === 'ss') return pad(this.second)
        if (match === 's') return String(this.second)
        if (match === 'SSS') return pad(this.millisecond, 3)
        if (match === 'A') return meridiem
        return meridiem.toLowerCase()
      }
    )
  }

  toISO(): string {
    if (this.#kind === 'date') return this.format('YYYY-MM-DD')
    return `${this.format('YYYY-MM-DD')}T${this.format('HH:mm:ss')}`
  }

  toJSON(): string {
    return this.toISO()
  }

  toString(): string {
    return this.#kind === 'date' ? this.format('YYYY-MM-DD') : this.format('YYYY-MM-DD HH:mm:ss')
  }

  valueOf(): number {
    return this.#value.getTime()
  }

  [Symbol.toPrimitive](hint: string): number | string {
    return hint === 'string' ? this.toString() : this.valueOf()
  }

  [inspect.custom](): string {
    return this.toString()
  }
}

export function $date(...args: unknown[]): $Date {
  if (args.length === 0) return $Date.from(new Date(), 'date')
  if (args[0] instanceof $Date) return args[0].toDate()
  if (args[0] instanceof Date) return $Date.from(args[0], 'date')
  if (typeof args[0] === 'string') {
    const parsed = parseIsoDate(args[0])
    if (!parsed) throw new Error(`Cannot parse date: ${args[0]}`)
    return $Date.from(parsed.date, 'date')
  }
  if (typeof args[0] === 'number' && typeof args[1] === 'number' && typeof args[2] === 'number') {
    return $Date.from(localDate(args[0], args[1], args[2]), 'date')
  }
  throw new Error('Use $date(), $date("YYYY-MM-DD"), or $date(year, month, day)')
}

export function $time(...args: unknown[]): $Date {
  if (args.length === 0) return $Date.from(new Date(), 'time')
  if (args[0] instanceof $Date) return args[0].toTime()
  if (args[0] instanceof Date) return $Date.from(args[0], 'time')
  if (typeof args[0] === 'string') {
    const parsed = parseIsoDate(args[0])
    if (!parsed) throw new Error(`Cannot parse time: ${args[0]}`)
    return $Date.from(parsed.date, 'time')
  }
  if (typeof args[0] === 'number' && typeof args[1] === 'number' && typeof args[2] === 'number') {
    return $Date.from(
      localDateTime(
        args[0],
        args[1],
        args[2],
        typeof args[3] === 'number' ? args[3] : 0,
        typeof args[4] === 'number' ? args[4] : 0,
        typeof args[5] === 'number' ? args[5] : 0,
        typeof args[6] === 'number' ? args[6] : 0
      ),
      'time'
    )
  }
  throw new Error(
    'Use $time(), $time("YYYY-MM-DD HH:mm:ss"), or $time(year, month, day, hour, minute, second)'
  )
}

function weekdayThisWeek(clock: Clock, weekday: number): $Date {
  return $Date.from(startOfIsoWeek(clock()), 'date').addDays(weekday === 0 ? 6 : weekday - 1)
}

export function installDateHelpers(
  target: Record<string, unknown>,
  clock: Clock = () => new Date()
): void {
  const lazy = (create: (now: Date) => $Date): PropertyDescriptor => ({
    configurable: true,
    enumerable: true,
    get: () => create(clock())
  })

  Object.defineProperties(target, {
    $Date: { configurable: true, enumerable: true, value: $Date },
    $date: {
      configurable: true,
      enumerable: true,
      value: (...args: unknown[]) =>
        args.length === 0 ? $Date.from(clock(), 'date') : $date(...args)
    },
    $time: {
      configurable: true,
      enumerable: true,
      value: (...args: unknown[]) =>
        args.length === 0 ? $Date.from(clock(), 'time') : $time(...args)
    },
    $datetime: {
      configurable: true,
      enumerable: true,
      value: (...args: unknown[]) =>
        args.length === 0 ? $Date.from(clock(), 'time') : $time(...args)
    },
    $today: lazy((now) => $Date.from(now, 'date')),
    $yesterday: lazy((now) => $Date.from(now, 'date').subDays(1)),
    $tomorrow: lazy((now) => $Date.from(now, 'date').addDays(1)),
    $now: lazy((now) => $Date.from(now, 'time')),
    $startOfWeek: lazy((now) => $Date.from(startOfIsoWeek(now), 'date')),
    $endOfWeek: lazy((now) => $Date.from(startOfIsoWeek(now), 'date').addDays(6)),
    $startOfMonth: lazy((now) =>
      $Date.from(new Date(now.getFullYear(), now.getMonth(), 1), 'date')
    ),
    $endOfMonth: lazy((now) =>
      $Date.from(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'date')
    ),
    $startOfYear: lazy((now) => $Date.from(new Date(now.getFullYear(), 0, 1), 'date')),
    $endOfYear: lazy((now) => $Date.from(new Date(now.getFullYear(), 11, 31), 'date')),
    $monday: lazy((now) => weekdayThisWeek(() => now, 1)),
    $tuesday: lazy((now) => weekdayThisWeek(() => now, 2)),
    $wednesday: lazy((now) => weekdayThisWeek(() => now, 3)),
    $thursday: lazy((now) => weekdayThisWeek(() => now, 4)),
    $friday: lazy((now) => weekdayThisWeek(() => now, 5)),
    $saturday: lazy((now) => weekdayThisWeek(() => now, 6)),
    $sunday: lazy((now) => weekdayThisWeek(() => now, 0))
  })
}
