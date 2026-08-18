# `$` helpers

Injected into every script and Markdown run block. Completions and the Guide should stay in sync with `src/shared/helpers/docs.ts`.

Weeks start **Monday**. `$Date` is not a native `Date`. `$Table` is not an `Array` subclass.

## Dates

Lazy: each read hits the clock.

| Name | Kind |
| --- | --- |
| `$today` `$yesterday` `$tomorrow` | calendar day |
| `$now` | date and time |
| `$startOfWeek` `$endOfWeek` `$startOfMonth` `$endOfMonth` `$startOfYear` `$endOfYear` | bounds |
| `$monday` … `$sunday` | this week |
| `$date(...)` | build a date: `()`, `"2026-08-18"`, or `(2026, 8, 18)` — month is 1-based |
| `$time(...)` / `$datetime(...)` | date-time (alias) |
| `$Date` | class; `instanceof $Date` |

Chain (copy, never mutate):

- Move: `addDays` / `subDays`, `addWeeks` / `subWeeks`, `addMonths` / `subMonths` (clamp day), `addYears` / `subYears`, hours/minutes/seconds/ms, `add(n, unit)` / `sub`
- Snap: `startOf` / `endOf`, `startOfDay` / `endOfDay`, week/month/year variants
- `next("friday")` / `previous("monday")` — never today
- `at(h, m?, s?)` — promotes a date to a date-time
- `toDate` / `toTime` / `toNative`
- Compare: `isSame` `isBefore` `isAfter` `isSameOrBefore` `isSameOrAfter` `isToday` `isYesterday` `isTomorrow` `diff(other, unit?)` — also `<` `>` via `valueOf`
- Format: `format("YYYY MMMM dddd HH:mm")`, `toISO`, `toJSON`, `toString` (what `console.log` prints)
- Fields: `kind` (`"date"` \| `"time"`), `year` `month` `day` `hour` `minute` `second` `millisecond`, `weekday` (0 = Sunday), `weekdayName`, `isoWeekday` (1 = Monday), `isWeekend` `isWeekday`

## Tables

A CSV page loads as a `$Table` of objects (numbers and booleans coerced).

```js
import orders from 'orders'
const also = $csv('orders')   // quotes autocomplete CSV titles
```

`$csv(name)` prefers a file in the same folder.

`$Table` / `$Table.fromCsv` / `$Table.fromRows`. Iterable, indexable (`table[0]`), not a real Array.

| | |
| --- | --- |
| Shape | `.columns` `.shape` `.length` `.head` `.tail` |
| Columns | `.select` `.drop` `.rename` `.assign` |
| Rows | `.where` `.sort` `.unique` `.fill` `.dropNull` `.sample` `.concat` |
| Numbers | `.sum` `.mean` `.min` `.max` `.median` `.count` |
| Groups | `.groupBy("region").agg({ qty: "sum" })` `.count()` `.sum` `.mean` |
| Joins | `.leftJoin(other, "sku")` `.innerJoin` — `on` is a name or `{ left, right }` |
| Out | `.toObjects()` `.toCsv()` |

`.where` accepts `("col", value)`, `({ col: value })`, or `(row) => boolean`.

## Secrets

```js
$secret("API_KEY")
$secrets.API_KEY
```

Missing name throws. `console.log($secrets)` prints names, not values. See product docs for sealing and expose.

## Intellisense notes

- Date members complete after a date root or an alias assigned from one.
- Table members complete after `$csv(...)` or `import x from "csvTitle"`.
- Do not put `$csv` / `$Table` / `$secret` in `DATE_ROOTS`.
