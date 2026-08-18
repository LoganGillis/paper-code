export type HelperDoc = {
  label: string
  kind: 'constant' | 'function' | 'class' | 'method' | 'property'
  detail: string
  info: string
  snippet?: string
}

export const DATE_ROOTS = [
  '$today',
  '$yesterday',
  '$tomorrow',
  '$now',
  '$startOfWeek',
  '$endOfWeek',
  '$startOfMonth',
  '$endOfMonth',
  '$startOfYear',
  '$endOfYear',
  '$monday',
  '$tuesday',
  '$wednesday',
  '$thursday',
  '$friday',
  '$saturday',
  '$sunday',
  '$date',
  '$time',
  '$datetime',
  '$Date'
] as const

export const DATE_GLOBALS: HelperDoc[] = [
  {
    label: '$today',
    kind: 'constant',
    detail: '$Date',
    info: 'Today as a calendar date in the local timezone. Recalculated each time you read it.'
  },
  {
    label: '$yesterday',
    kind: 'constant',
    detail: '$Date',
    info: 'Yesterday’s calendar date.'
  },
  {
    label: '$tomorrow',
    kind: 'constant',
    detail: '$Date',
    info: 'Tomorrow’s calendar date.'
  },
  {
    label: '$now',
    kind: 'constant',
    detail: '$Date (time)',
    info: 'The current local date and time, down to the second.'
  },
  {
    label: '$startOfWeek',
    kind: 'constant',
    detail: '$Date',
    info: 'Monday of this week (ISO week).'
  },
  {
    label: '$endOfWeek',
    kind: 'constant',
    detail: '$Date',
    info: 'Sunday of this week (ISO week).'
  },
  {
    label: '$startOfMonth',
    kind: 'constant',
    detail: '$Date',
    info: 'The first day of this month.'
  },
  {
    label: '$endOfMonth',
    kind: 'constant',
    detail: '$Date',
    info: 'The last day of this month.'
  },
  {
    label: '$startOfYear',
    kind: 'constant',
    detail: '$Date',
    info: 'January 1 of this year.'
  },
  {
    label: '$endOfYear',
    kind: 'constant',
    detail: '$Date',
    info: 'December 31 of this year.'
  },
  {
    label: '$monday',
    kind: 'constant',
    detail: '$Date',
    info: 'This week’s Monday.'
  },
  {
    label: '$tuesday',
    kind: 'constant',
    detail: '$Date',
    info: 'This week’s Tuesday.'
  },
  {
    label: '$wednesday',
    kind: 'constant',
    detail: '$Date',
    info: 'This week’s Wednesday.'
  },
  {
    label: '$thursday',
    kind: 'constant',
    detail: '$Date',
    info: 'This week’s Thursday.'
  },
  {
    label: '$friday',
    kind: 'constant',
    detail: '$Date',
    info: 'This week’s Friday.'
  },
  {
    label: '$saturday',
    kind: 'constant',
    detail: '$Date',
    info: 'This week’s Saturday.'
  },
  {
    label: '$sunday',
    kind: 'constant',
    detail: '$Date',
    info: 'This week’s Sunday.'
  },
  {
    label: '$date',
    kind: 'function',
    detail: '(…args) → $Date',
    info: 'Build a calendar date. $date(), $date("2026-08-18"), or $date(2026, 8, 18). Month is 1-based.',
    snippet: '$date(${args})'
  },
  {
    label: '$time',
    kind: 'function',
    detail: '(…args) → $Date',
    info: 'Build a local date-time. $time(), $time("2026-08-18 15:04:05"), or $time(y, m, d, h, min, s).',
    snippet: '$time(${args})'
  },
  {
    label: '$datetime',
    kind: 'function',
    detail: 'alias of $time',
    info: 'Same as $time — a local date-time.',
    snippet: '$datetime(${args})'
  },
  {
    label: '$Date',
    kind: 'class',
    detail: 'class',
    info: 'The Paper date/time object. Use instanceof $Date, or prefer $date / $time / $today.'
  }
]

export const DATE_MEMBERS: HelperDoc[] = [
  {
    label: 'addDays',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Return a copy this many days later. Does not change the original.',
    snippet: 'addDays(${n})'
  },
  {
    label: 'subDays',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Return a copy this many days earlier.',
    snippet: 'subDays(${n})'
  },
  {
    label: 'addWeeks',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Return a copy this many weeks later.',
    snippet: 'addWeeks(${n})'
  },
  {
    label: 'subWeeks',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Return a copy this many weeks earlier.',
    snippet: 'subWeeks(${n})'
  },
  {
    label: 'addMonths',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Add months, clamping the day (Jan 31 + 1 month → Feb 28/29).',
    snippet: 'addMonths(${n})'
  },
  {
    label: 'subMonths',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Subtract months, clamping the day if needed.',
    snippet: 'subMonths(${n})'
  },
  {
    label: 'addYears',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Return a copy this many years later.',
    snippet: 'addYears(${n})'
  },
  {
    label: 'subYears',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Return a copy this many years earlier.',
    snippet: 'subYears(${n})'
  },
  {
    label: 'addHours',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Add hours. A calendar date is promoted to a date-time at midnight first.',
    snippet: 'addHours(${n})'
  },
  {
    label: 'subHours',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Subtract hours. Promotes a date to a date-time.',
    snippet: 'subHours(${n})'
  },
  {
    label: 'addMinutes',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Add minutes. Promotes a date to a date-time.',
    snippet: 'addMinutes(${n})'
  },
  {
    label: 'subMinutes',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Subtract minutes. Promotes a date to a date-time.',
    snippet: 'subMinutes(${n})'
  },
  {
    label: 'addSeconds',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Add seconds. Promotes a date to a date-time.',
    snippet: 'addSeconds(${n})'
  },
  {
    label: 'subSeconds',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Subtract seconds. Promotes a date to a date-time.',
    snippet: 'subSeconds(${n})'
  },
  {
    label: 'addMilliseconds',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Add milliseconds. Promotes a date to a date-time.',
    snippet: 'addMilliseconds(${n})'
  },
  {
    label: 'subMilliseconds',
    kind: 'method',
    detail: '(n) → $Date',
    info: 'Subtract milliseconds. Promotes a date to a date-time.',
    snippet: 'subMilliseconds(${n})'
  },
  {
    label: 'add',
    kind: 'method',
    detail: '(n, unit) → $Date',
    info: 'Add an amount of year, month, week, day, hour, minute, second, or millisecond.',
    snippet: 'add(${n}, "${unit}")'
  },
  {
    label: 'sub',
    kind: 'method',
    detail: '(n, unit) → $Date',
    info: 'Subtract an amount of a given unit.',
    snippet: 'sub(${n}, "${unit}")'
  },
  {
    label: 'startOf',
    kind: 'method',
    detail: '(unit) → $Date',
    info: 'Snap to the start of a year, month, week, day, hour, minute, or second.',
    snippet: 'startOf("${unit}")'
  },
  {
    label: 'endOf',
    kind: 'method',
    detail: '(unit) → $Date',
    info: 'Snap to the end of a year, month, week, day, hour, minute, or second.',
    snippet: 'endOf("${unit}")'
  },
  {
    label: 'startOfDay',
    kind: 'method',
    detail: '() → $Date',
    info: 'Midnight on this calendar day.',
    snippet: 'startOfDay()'
  },
  {
    label: 'endOfDay',
    kind: 'method',
    detail: '() → $Date',
    info: '23:59:59.999 on this calendar day.',
    snippet: 'endOfDay()'
  },
  {
    label: 'startOfWeek',
    kind: 'method',
    detail: '() → $Date',
    info: 'Monday of this value’s week.',
    snippet: 'startOfWeek()'
  },
  {
    label: 'endOfWeek',
    kind: 'method',
    detail: '() → $Date',
    info: 'Sunday of this value’s week.',
    snippet: 'endOfWeek()'
  },
  {
    label: 'startOfMonth',
    kind: 'method',
    detail: '() → $Date',
    info: 'The first day of this value’s month.',
    snippet: 'startOfMonth()'
  },
  {
    label: 'endOfMonth',
    kind: 'method',
    detail: '() → $Date',
    info: 'The last day of this value’s month.',
    snippet: 'endOfMonth()'
  },
  {
    label: 'startOfYear',
    kind: 'method',
    detail: '() → $Date',
    info: 'January 1 of this value’s year.',
    snippet: 'startOfYear()'
  },
  {
    label: 'endOfYear',
    kind: 'method',
    detail: '() → $Date',
    info: 'December 31 of this value’s year.',
    snippet: 'endOfYear()'
  },
  {
    label: 'next',
    kind: 'method',
    detail: '(weekday) → $Date',
    info: 'The next occurrence of a weekday, never today. Accepts "friday" or an ISO 1–7 number.',
    snippet: 'next("${weekday}")'
  },
  {
    label: 'previous',
    kind: 'method',
    detail: '(weekday) → $Date',
    info: 'The previous occurrence of a weekday, never today.',
    snippet: 'previous("${weekday}")'
  },
  {
    label: 'at',
    kind: 'method',
    detail: '(h, m?, s?) → $Date',
    info: 'This calendar day at a local time. Promotes a date to a date-time.',
    snippet: 'at(${hour}, ${minute})'
  },
  {
    label: 'toDate',
    kind: 'method',
    detail: '() → $Date',
    info: 'Drop the time and keep the calendar day.',
    snippet: 'toDate()'
  },
  {
    label: 'toTime',
    kind: 'method',
    detail: '() → $Date',
    info: 'Treat this as a date-time (midnight if it was only a date).',
    snippet: 'toTime()'
  },
  {
    label: 'toNative',
    kind: 'method',
    detail: '() → Date',
    info: 'A native JavaScript Date in the local timezone.',
    snippet: 'toNative()'
  },
  {
    label: 'isSame',
    kind: 'method',
    detail: '(other, unit?) → boolean',
    info: 'True if both values match at the given unit (default day for dates).',
    snippet: 'isSame(${other})'
  },
  {
    label: 'isBefore',
    kind: 'method',
    detail: '(other) → boolean',
    info: 'True if this instant is earlier than other.',
    snippet: 'isBefore(${other})'
  },
  {
    label: 'isAfter',
    kind: 'method',
    detail: '(other) → boolean',
    info: 'True if this instant is later than other.',
    snippet: 'isAfter(${other})'
  },
  {
    label: 'isSameOrBefore',
    kind: 'method',
    detail: '(other) → boolean',
    info: 'True if this is the same as or earlier than other.',
    snippet: 'isSameOrBefore(${other})'
  },
  {
    label: 'isSameOrAfter',
    kind: 'method',
    detail: '(other) → boolean',
    info: 'True if this is the same as or later than other.',
    snippet: 'isSameOrAfter(${other})'
  },
  {
    label: 'isToday',
    kind: 'method',
    detail: '() → boolean',
    info: 'True if this falls on the current local calendar day.',
    snippet: 'isToday()'
  },
  {
    label: 'isYesterday',
    kind: 'method',
    detail: '() → boolean',
    info: 'True if this falls on yesterday.',
    snippet: 'isYesterday()'
  },
  {
    label: 'isTomorrow',
    kind: 'method',
    detail: '() → boolean',
    info: 'True if this falls on tomorrow.',
    snippet: 'isTomorrow()'
  },
  {
    label: 'diff',
    kind: 'method',
    detail: '(other, unit?) → number',
    info: 'Signed whole units from other to this. Default unit is day.',
    snippet: 'diff(${other}, "${unit}")'
  },
  {
    label: 'format',
    kind: 'method',
    detail: '(pattern?) → string',
    info: 'Format with tokens like YYYY, MMMM, dddd, HH, mm, ss. Default is ISO-like.',
    snippet: 'format("${pattern}")'
  },
  {
    label: 'toISO',
    kind: 'method',
    detail: '() → string',
    info: 'ISO date (YYYY-MM-DD) or local ISO date-time.',
    snippet: 'toISO()'
  },
  {
    label: 'toJSON',
    kind: 'method',
    detail: '() → string',
    info: 'Same as toISO(), used by JSON.stringify.',
    snippet: 'toJSON()'
  },
  {
    label: 'toString',
    kind: 'method',
    detail: '() → string',
    info: 'Readable local date or date-time. This is what console.log prints.',
    snippet: 'toString()'
  },
  {
    label: 'valueOf',
    kind: 'method',
    detail: '() → number',
    info: 'Unix timestamp in milliseconds. Lets you compare with < and >.',
    snippet: 'valueOf()'
  },
  {
    label: 'kind',
    kind: 'property',
    detail: '"date" | "time"',
    info: 'Whether this is a calendar date or a date-time.'
  },
  { label: 'year', kind: 'property', detail: 'number', info: 'Full year, e.g. 2026.' },
  { label: 'month', kind: 'property', detail: 'number', info: 'Month from 1 to 12.' },
  { label: 'day', kind: 'property', detail: 'number', info: 'Day of the month, 1–31.' },
  {
    label: 'hour',
    kind: 'property',
    detail: 'number',
    info: 'Hour 0–23. Always 0 on a calendar date.'
  },
  {
    label: 'minute',
    kind: 'property',
    detail: 'number',
    info: 'Minute 0–59. Always 0 on a calendar date.'
  },
  {
    label: 'second',
    kind: 'property',
    detail: 'number',
    info: 'Second 0–59. Always 0 on a calendar date.'
  },
  {
    label: 'millisecond',
    kind: 'property',
    detail: 'number',
    info: 'Millisecond 0–999. Always 0 on a calendar date.'
  },
  {
    label: 'weekday',
    kind: 'property',
    detail: 'number',
    info: 'Day of week: 0 is Sunday, 6 is Saturday.'
  },
  {
    label: 'weekdayName',
    kind: 'property',
    detail: 'string',
    info: 'Full English weekday name, e.g. "Tuesday".'
  },
  {
    label: 'isoWeekday',
    kind: 'property',
    detail: 'number',
    info: 'ISO weekday: 1 is Monday, 7 is Sunday.'
  },
  {
    label: 'isWeekend',
    kind: 'property',
    detail: 'boolean',
    info: 'True for Saturday and Sunday.'
  },
  {
    label: 'isWeekday',
    kind: 'property',
    detail: 'boolean',
    info: 'True for Monday through Friday.'
  }
]

export const SECRET_ROOTS = ['$secret', '$secrets'] as const

export const SECRET_GLOBALS: HelperDoc[] = [
  {
    label: '$secret',
    kind: 'function',
    detail: '(name) → string',
    info: 'Read a sealed secret from this space. Values are never stored in the page.',
    snippet: '$secret("${name}")'
  },
  {
    label: '$secrets',
    kind: 'constant',
    detail: 'Record<string, string>',
    info: 'This space’s secrets as properties, e.g. $secrets.API_KEY. Logging the object only prints names.'
  }
]

export const TABLE_ROOTS = ['$csv', '$Table'] as const

export const CSV_GLOBALS: HelperDoc[] = [
  {
    label: '$csv',
    kind: 'function',
    detail: '(name) → $Table',
    info: 'Load a CSV page as a table of objects. Prefers a file in the same folder. Same as import name from "name".',
    snippet: '$csv("${name}")'
  },
  {
    label: '$Table',
    kind: 'class',
    detail: 'class',
    info: 'Array of row objects with pandas-style helpers. import orders from "orders" returns a $Table.'
  }
]

export const TABLE_MEMBERS: HelperDoc[] = [
  {
    label: 'head',
    kind: 'method',
    detail: '(n=5) → $Table',
    info: 'First n rows.',
    snippet: 'head(${n})'
  },
  {
    label: 'tail',
    kind: 'method',
    detail: '(n=5) → $Table',
    info: 'Last n rows.',
    snippet: 'tail(${n})'
  },
  {
    label: 'select',
    kind: 'method',
    detail: '(...cols) → $Table',
    info: 'Keep only these columns.',
    snippet: 'select("${col}")'
  },
  {
    label: 'drop',
    kind: 'method',
    detail: '(...cols) → $Table',
    info: 'Remove these columns.',
    snippet: 'drop("${col}")'
  },
  {
    label: 'rename',
    kind: 'method',
    detail: '(map) → $Table',
    info: 'Rename columns with { oldName: "newName" }.',
    snippet: 'rename({ ${old}: "${new}" })'
  },
  {
    label: 'where',
    kind: 'method',
    detail: '(pred) → $Table',
    info: 'Filter rows. where("region", "East"), where({ status: "paid" }), or where(row => ...).',
    snippet: 'where("${col}", ${value})'
  },
  {
    label: 'sort',
    kind: 'method',
    detail: '(col, dir?) → $Table',
    info: 'Sort by a column. Direction is "asc" or "desc".',
    snippet: 'sort("${col}")'
  },
  {
    label: 'unique',
    kind: 'method',
    detail: '(...cols?) → $Table',
    info: 'Drop duplicate rows. Pass columns to compare only those.',
    snippet: 'unique("${col}")'
  },
  {
    label: 'assign',
    kind: 'method',
    detail: '(cols) → $Table',
    info: 'Add or replace columns. Values can be constants or (row) => value.',
    snippet: 'assign({ ${col}: (row) => ${expr} })'
  },
  {
    label: 'fill',
    kind: 'method',
    detail: '(col, value) → $Table',
    info: 'Replace empty or null cells.',
    snippet: 'fill("${col}", ${value})'
  },
  {
    label: 'dropNull',
    kind: 'method',
    detail: '(...cols?) → $Table',
    info: 'Drop rows with empty values in the given columns (or any column).',
    snippet: 'dropNull()'
  },
  {
    label: 'sample',
    kind: 'method',
    detail: '(n) → $Table',
    info: 'Random sample of n rows.',
    snippet: 'sample(${n})'
  },
  {
    label: 'groupBy',
    kind: 'method',
    detail: '(...cols) → $Grouped',
    info: 'Group rows. Chain .agg({ sales: "sum" }), .count(), .sum("qty"), or .mean("price").',
    snippet: 'groupBy("${col}")'
  },
  {
    label: 'sum',
    kind: 'method',
    detail: '(col) → number',
    info: 'Sum a numeric column. Non-numeric cells are skipped.',
    snippet: 'sum("${col}")'
  },
  {
    label: 'mean',
    kind: 'method',
    detail: '(col) → number',
    info: 'Average of a numeric column.',
    snippet: 'mean("${col}")'
  },
  {
    label: 'min',
    kind: 'method',
    detail: '(col) → value',
    info: 'Smallest value in a column.',
    snippet: 'min("${col}")'
  },
  {
    label: 'max',
    kind: 'method',
    detail: '(col) → value',
    info: 'Largest value in a column.',
    snippet: 'max("${col}")'
  },
  {
    label: 'median',
    kind: 'method',
    detail: '(col) → number',
    info: 'Median of a numeric column.',
    snippet: 'median("${col}")'
  },
  {
    label: 'count',
    kind: 'method',
    detail: '() → number',
    info: 'Number of rows. Same as .length.',
    snippet: 'count()'
  },
  {
    label: 'innerJoin',
    kind: 'method',
    detail: '(other, on) → $Table',
    info: 'Inner join. on is a shared column name or { left, right }.',
    snippet: 'innerJoin(${other}, "${on}")'
  },
  {
    label: 'leftJoin',
    kind: 'method',
    detail: '(other, on) → $Table',
    info: 'Left join. Keeps every row from this table.',
    snippet: 'leftJoin(${other}, "${on}")'
  },
  {
    label: 'concat',
    kind: 'method',
    detail: '(other) → $Table',
    info: 'Stack another table (or array of rows) underneath.',
    snippet: 'concat(${other})'
  },
  {
    label: 'toObjects',
    kind: 'method',
    detail: '() → object[]',
    info: 'Plain array of row objects.',
    snippet: 'toObjects()'
  },
  {
    label: 'toCsv',
    kind: 'method',
    detail: '() → string',
    info: 'Serialize back to CSV text.',
    snippet: 'toCsv()'
  },
  {
    label: 'columns',
    kind: 'property',
    detail: 'string[]',
    info: 'Column names, in first-seen order.'
  },
  {
    label: 'shape',
    kind: 'property',
    detail: '[rows, cols]',
    info: 'Row count and column count.'
  },
  {
    label: 'length',
    kind: 'property',
    detail: 'number',
    info: 'Number of rows. $Table is an Array.'
  }
]
