import { getPrisma } from './db'

function note(text: string): string {
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }]
      }
    ]
  })
}

const DATES_SCRIPT = `const checks = []

function check(label, actual, expected) {
  const ok =
    actual && typeof actual.isSame === 'function' && expected && typeof expected.isSame === 'function'
      ? actual.isSame(expected)
      : actual === expected
  checks.push({ label, ok, actual: String(actual), expected: String(expected) })
  if (ok) console.log('ok  ' + label)
  else console.log('FAIL ' + label + '  got ' + actual + '  want ' + expected)
}

console.log('today      ', $today, $today.weekdayName)
console.log('yesterday  ', $yesterday)
console.log('tomorrow   ', $tomorrow)
console.log('now        ', $now)
console.log('week       ', $startOfWeek, '→', $endOfWeek)
console.log('month      ', $startOfMonth, '→', $endOfMonth)
console.log('year       ', $startOfYear, '→', $endOfYear)
console.log('weekdays   ', $monday, $tuesday, $wednesday, $thursday, $friday, $saturday, $sunday)

check('$today - 1 day is $yesterday', $today.subDays(1), $yesterday)
check('$today + 1 day is $tomorrow', $today.addDays(1), $tomorrow)
check('$now.toDate() is $today', $now.toDate(), $today)
check('$startOfWeek is $monday', $startOfWeek, $monday)
check('$endOfWeek is $sunday', $endOfWeek, $sunday)
check('weekdays are consecutive', $tuesday.subDays(1), $monday)
check('$wednesday is 2 days after $monday', $monday.addDays(2), $wednesday)
check('$today.startOfWeek() is $monday', $today.startOfWeek(), $monday)
check('$date() is $today', $date(), $today)
check('$date(iso) round-trips', $date($today.toISO()), $today)
check('$today instanceof $Date', $today instanceof $Date, true)
check('$now.kind is time', $now.kind, 'time')
check('$today.kind is date', $today.kind, 'date')
check('$today.at(9, 30).kind is time', $today.at(9, 30).kind, 'time')
check('$now > $today midnight', $now.valueOf() >= $today.valueOf(), true)
check('$yesterday < $today', $yesterday < $today, true)
check('$tomorrow > $today', $tomorrow > $today, true)
check('addMonths clamps Jan 31', $date(2026, 1, 31).addMonths(1), $date(2026, 2, 28))
check('next Friday skips today if Friday', $today.next('friday').weekdayName === 'Friday', true)
check('$today.next("monday") is after today', $today.next('monday') > $today, true)

const failed = checks.filter((item) => !item.ok)
console.log('')
console.log(checks.length - failed.length + '/' + checks.length + ' checks passed')
if (failed.length) throw new Error(failed.length + ' date helper checks failed')
{ passed: checks.length - failed.length, failed: failed.length, today: $today.toString(), now: $now.toString() }
`

const DATE_EDGES_SCRIPT = `console.log('format     ', $today.format('dddd, MMMM D, YYYY'))
console.log('iso        ', $today.toISO(), $now.toISO())
console.log('start/end day', $now.startOfDay(), $now.endOfDay())
console.log('start hour ', $now.startOf('hour'))
console.log('subHours   ', $now.subHours(5))
console.log('addWeeks   ', $today.addWeeks(2))
console.log('previous mon', $today.previous('monday'))
console.log('next mon   ', $today.next('monday'))
console.log('diff days  ', $tomorrow.diff($yesterday, 'day'))
console.log('weekend?   ', $saturday.isWeekend, $monday.isWeekday)
console.log('same month ', $today.isSame($startOfMonth, 'month'))
console.log('native     ', $today.toNative().toDateString())

const parsed = $time($now.format('YYYY-MM-DD HH:mm:ss'))
console.log('parse time ', parsed, parsed.isSame($now, 'second'))

if ($tomorrow.diff($yesterday, 'day') !== 2) throw new Error('diff days should be 2')
if (!$saturday.isWeekend) throw new Error('Saturday should be a weekend')
if (!$monday.isWeekday) throw new Error('Monday should be a weekday')
if ($today.previous('monday') >= $today && $today.weekdayName !== 'Monday') {
  throw new Error('previous monday should be before today unless today is Monday')
}

{ ok: true, formatted: $today.format('dddd, MMMM D, YYYY') }
`

const ORDERS_CSV = `order_id,date,customer,region,sku,qty,status
1001,2026-03-02,Northwind,East,SKU-TEA,3,paid
1002,2026-03-02,Contoso,West,SKU-MUG,2,paid
1003,2026-03-03,Adventure,East,SKU-TEA,1,pending
1004,2026-03-04,Fabrikam,South,SKU-BAG,1,paid
1005,2026-03-04,Northwind,East,SKU-MUG,4,paid
1006,2026-03-05,Contoso,West,SKU-LMP,1,refunded
1007,2026-03-06,Adventure,East,SKU-BAG,2,paid
1008,2026-03-07,Wide World,North,SKU-TEA,6,paid
1009,2026-03-08,Fabrikam,South,SKU-NTB,1,pending
1010,2026-03-08,Northwind,East,SKU-TEA,2,paid
1011,2026-03-09,Contoso,West,SKU-MUG,1,paid
1012,2026-03-10,Wide World,North,SKU-BAG,3,paid
`

const PRODUCTS_CSV = `sku,product,category,unit_price,in_stock
SKU-TEA,Cedar tea,Grocery,8.5,true
SKU-MUG,Stoneware mug,Home,14,true
SKU-BAG,Canvas tote,Apparel,22,true
SKU-LMP,Desk lamp,Home,48,false
SKU-NTB,Lined notebook,Stationery,6.25,true
SKU-PEN,Fountain pen,Stationery,18,true
`

const EMPLOYEES_CSV = `id,name,department,title,region,salary,hired
1,Mina Park,Sales,Account lead,East,92000,2021-04-12
2,Jonah Ellis,Sales,Rep,West,68000,2023-01-09
3,Priya Shah,Ops,Coordinator,East,61000,2022-08-22
4,Leo Hart,Ops,Manager,North,88000,2019-11-03
5,Ava Chen,Product,Designer,West,99000,2020-06-15
6,Samir Cole,Product,Engineer,East,115000,2018-02-01
7,Ruth Okoye,Finance,Analyst,South,74000,2024-03-18
8,Eli Navarro,Sales,Rep,South,64000,2025-09-30
`

const CSV_SCRIPT = `import orders from 'orders'
import products from 'products'

const also = $csv('orders')
const checks = []

function check(label, actual, expected) {
  const ok = actual === expected
  checks.push({ label, ok, actual, expected })
  if (ok) console.log('ok  ' + label)
  else console.log('FAIL ' + label + '  got ' + actual + '  want ' + expected)
}

console.log(orders)
console.log('columns', orders.columns)
console.log('shape  ', orders.shape)

check('import is $Table', orders instanceof $Table, true)
check('$csv matches import length', also.length, orders.length)
check('qty is numeric', typeof orders[0].qty, 'number')
check('paid rows', orders.where('status', 'paid').length, 9)
check('east paid', orders.where({ region: 'East', status: 'paid' }).length, 4)
check('select keeps 3 cols', orders.select('order_id', 'customer', 'qty').columns.length, 3)
check('unique customers', orders.unique('customer').length, 5)
check('sum qty', orders.sum('qty'), 27)
check('max qty', orders.max('qty'), 6)
check('sort desc first qty', orders.sort('qty', 'desc')[0].qty, 6)

const byRegion = orders.groupBy('region').count()
console.log('by region', byRegion)
check('group rows', byRegion.length, 4)

const priced = orders.leftJoin(products, 'sku').assign({
  revenue: (row) => row.qty * row.unit_price
})
console.log('joined head', priced.head(3))
check('join kept all orders', priced.length, orders.length)
check('tea revenue', priced.where('sku', 'SKU-TEA').sum('revenue'), 8.5 * (3 + 1 + 6 + 2))

const failed = checks.filter((item) => !item.ok)
console.log('')
console.log(checks.length - failed.length + '/' + checks.length + ' checks passed')
if (failed.length) throw new Error(failed.length + ' csv helper checks failed')
{ passed: checks.length - failed.length, failed: failed.length, rows: orders.length }
`

const CSV_EDGES_SCRIPT = `import employees from 'employees'
import products from 'products'

const sales = $csv('employees').where('department', 'Sales')
console.log('sales', sales.select('name', 'region', 'salary'))
console.log('mean salary', employees.mean('salary'))
console.log('median salary', employees.median('salary'))
console.log('by dept', employees.groupBy('department').agg({ salary: 'mean', count: 'count' }))

const restock = products.where((row) => !row.in_stock)
console.log('out of stock', restock)

const renamed = employees.rename({ hired: 'start_date' }).drop('id')
console.log('renamed cols', renamed.columns)

const stacked = $csv('orders').head(2).concat($csv('orders').tail(2))
console.log('stacked', stacked.length, stacked.select('order_id', 'customer'))

if (sales.length !== 3) throw new Error('expected 3 sales people')
if (employees.min('salary') !== 61000) throw new Error('min salary')
if (employees.max('salary') !== 115000) throw new Error('max salary')
if (!renamed.columns.includes('start_date')) throw new Error('rename failed')
if (stacked.length !== 4) throw new Error('concat should stack 2+2')
if (restock.length !== 1 || restock[0].sku !== 'SKU-LMP') throw new Error('stock filter')

{ ok: true, employees: employees.length, products: products.length }
`

export async function ensureHelperDemos(): Promise<void> {
  const prisma = getPrisma()
  const space =
    (await prisma.space.findFirst({ where: { name: 'Workshop' } })) ??
    (await prisma.space.findFirst({ orderBy: { createdAt: 'asc' } }))
  if (!space) return

  let folder = await prisma.folder.findFirst({
    where: { spaceId: space.id, name: 'Helpers' }
  })
  if (!folder) {
    folder = await prisma.folder.create({
      data: {
        name: 'Helpers',
        icon: 'Sparkles',
        iconColor: 'lilac',
        spaceId: space.id,
        sortOrder: 20
      }
    })
  }

  let dataFolder = await prisma.folder.findFirst({
    where: { spaceId: space.id, name: 'Data' }
  })
  if (!dataFolder) {
    dataFolder = await prisma.folder.create({
      data: {
        name: 'Data',
        icon: 'Table2',
        iconColor: 'sage',
        spaceId: space.id,
        sortOrder: 15
      }
    })
  }

  const tables = [
    {
      title: 'orders',
      type: 'csv' as const,
      content: ORDERS_CSV,
      description: note('Mock shop orders. Join to products on sku.'),
      icon: 'ShoppingBag',
      iconColor: 'sage' as const,
      sortOrder: 0,
      folderId: dataFolder.id
    },
    {
      title: 'products',
      type: 'csv' as const,
      content: PRODUCTS_CSV,
      description: note('Catalog with prices and stock flags.'),
      icon: 'Package',
      iconColor: 'mint' as const,
      sortOrder: 1,
      folderId: dataFolder.id
    },
    {
      title: 'employees',
      type: 'csv' as const,
      content: EMPLOYEES_CSV,
      description: note('A small people table for grouping and stats.'),
      icon: 'Users',
      iconColor: 'indigo' as const,
      sortOrder: 2,
      folderId: dataFolder.id
    }
  ]

  const demos = [
    {
      title: 'dates',
      type: 'typescript' as const,
      content: DATES_SCRIPT,
      description: note(
        'Checks the $ date helpers: $today, weekdays, chainable add/sub, and lazy constants. Press Run.'
      ),
      icon: 'Calendar',
      iconColor: 'sky' as const,
      sortOrder: 0,
      folderId: folder.id
    },
    {
      title: 'date edges',
      type: 'javascript' as const,
      content: DATE_EDGES_SCRIPT,
      description: note(
        'Formatting, parsing, hour math, weekends, and diffs. Press Run after dates looks good.'
      ),
      icon: 'Clock',
      iconColor: 'peach' as const,
      sortOrder: 1,
      folderId: folder.id
    },
    {
      title: 'csv',
      type: 'typescript' as const,
      content: CSV_SCRIPT,
      description: note(
        'Import a CSV or load it with $csv("orders"). Filter, group, join, and assign columns. Press Run.'
      ),
      icon: 'Table2',
      iconColor: 'sage' as const,
      sortOrder: 2,
      folderId: folder.id
    },
    {
      title: 'csv edges',
      type: 'javascript' as const,
      content: CSV_EDGES_SCRIPT,
      description: note(
        'Aggregations, rename/drop, concat, and boolean filters. Press Run after csv.'
      ),
      icon: 'LineChart',
      iconColor: 'mint' as const,
      sortOrder: 3,
      folderId: folder.id
    }
  ]

  for (const demo of [...tables, ...demos]) {
    const existing = await prisma.page.findFirst({
      where: { spaceId: space.id, folderId: demo.folderId, title: demo.title }
    })
    if (existing) {
      await prisma.page.update({
        where: { id: existing.id },
        data: {
          content: demo.content,
          description: demo.description,
          type: demo.type,
          icon: demo.icon,
          iconColor: demo.iconColor
        }
      })
    } else {
      await prisma.page.create({
        data: {
          ...demo,
          spaceId: space.id
        }
      })
    }
  }
}
