import type { Page, SpaceTree } from '@shared/api'
import { GUIDE_ORDERS_ID, GUIDE_PAGE_ID, GUIDE_PRODUCTS_ID } from '@shared/guide-data'

export { GUIDE_PAGE_ID, isGuidePageId } from '@shared/guide-data'

type DocNode = Record<string, unknown>

function text(value: string, marks?: object[]): DocNode {
  return marks ? { type: 'text', text: value, marks } : { type: 'text', text: value }
}

function paragraph(...chunks: Array<string | DocNode>): DocNode {
  return {
    type: 'paragraph',
    content: chunks.map((chunk) => (typeof chunk === 'string' ? text(chunk) : chunk))
  }
}

function heading(level: 1 | 2 | 3, value: string): DocNode {
  return { type: 'heading', attrs: { level }, content: [text(value)] }
}

function bullet(...items: string[]): DocNode {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [paragraph(item)]
    }))
  }
}

function code(language: 'javascript' | 'typescript', source: string, blockId: string): DocNode {
  return {
    type: 'runnableCode',
    attrs: { language, blockId },
    content: source ? [text(source)] : []
  }
}

function csvEmbed(pageId: string): DocNode {
  return { type: 'csvEmbed', attrs: { pageId } }
}

function codeMark(value: string): DocNode {
  return text(value, [{ type: 'code' }])
}

export function buildGuideDoc(_trees: Record<string, SpaceTree>): DocNode {
  const content: DocNode[] = [
    paragraph(
      'Paper is a notebook for notes, tables, and scripts. This page is the built-in guide — you can run the examples, but you cannot edit the text.'
    ),
    heading(2, '$ helpers'),
    paragraph(
      'Scripts (and runnable blocks like the ones below) get a small standard library. Every name starts with ',
      codeMark('$'),
      '. Dates are not native ',
      codeMark('Date'),
      ' objects — they are ',
      codeMark('$Date'),
      ' values you can chain. Tables are ',
      codeMark('$Table'),
      ' values: iterable rows with pandas-style methods.'
    ),
    heading(3, 'Dates'),
    paragraph(
      'These are lazy. Each time you read them they are computed from the clock. Weeks start on Monday.'
    ),
    bullet(
      '$today, $yesterday, $tomorrow — calendar days',
      '$now — date and time',
      '$startOfWeek, $endOfWeek, $startOfMonth, $endOfMonth, $startOfYear, $endOfYear',
      '$monday … $sunday — this week’s days',
      '$date(...) / $time(...) / $datetime(...) — build a value',
      '$Date — the class; use instanceof $Date'
    ),
    paragraph('Try this:'),
    code(
      'javascript',
      `console.log($today, $today.weekdayName)
console.log($yesterday, '→', $tomorrow)
console.log('week', $startOfWeek, 'to', $endOfWeek)
console.log($monday, $friday)
$today.subDays(1).isSame($yesterday)`,
      'guide-today'
    ),
    paragraph(
      'Move with ',
      codeMark('.addDays'),
      ', ',
      codeMark('.subWeeks'),
      ', ',
      codeMark('.addMonths'),
      ' (months clamp: Jan 31 + 1 month is Feb 28/29), ',
      codeMark('.next("friday")'),
      ', ',
      codeMark('.previous("monday")'),
      ', and ',
      codeMark('.at(9, 30)'),
      '.'
    ),
    code(
      'javascript',
      `const stamp = $date(2026, 1, 31).addMonths(1)
console.log(stamp, stamp.format('MMMM D, YYYY'))
console.log('next Friday', $today.next('friday'))
console.log('nine thirty', $today.at(9, 30))
$yesterday < $today`,
      'guide-dates'
    ),
    paragraph(
      'Compare with ',
      codeMark('.isSame'),
      ', ',
      codeMark('.isBefore'),
      ', ',
      codeMark('.diff(other, "day")'),
      '. Format with tokens like ',
      codeMark('YYYY'),
      ', ',
      codeMark('MMMM'),
      ', ',
      codeMark('dddd'),
      ', ',
      codeMark('HH:mm'),
      '.'
    ),
    heading(3, 'Tables'),
    paragraph(
      'A CSV page loads as a ',
      codeMark('$Table'),
      ' of objects. Numbers and booleans are coerced. Use a normal import, or ',
      codeMark('$csv("name")'),
      ' — the quotes autocomplete CSV titles.'
    )
  ]

  content.push(paragraph('A sample orders table that lives with the Guide:'), csvEmbed(GUIDE_ORDERS_ID))

  content.push(
    code(
      'javascript',
      `import orders from 'orders'

console.log(orders)
console.log(orders.columns, orders.shape)
const paid = orders.where('status', 'paid')
console.log('paid', paid.length, 'sum qty', paid.sum('qty'))
orders.groupBy('region').count()`,
      'guide-orders'
    ),
    paragraph(
      'Shape and columns: ',
      codeMark('.head'),
      ', ',
      codeMark('.tail'),
      ', ',
      codeMark('.select'),
      ', ',
      codeMark('.drop'),
      ', ',
      codeMark('.rename'),
      ', ',
      codeMark('.where'),
      ', ',
      codeMark('.sort'),
      ', ',
      codeMark('.unique'),
      ', ',
      codeMark('.assign'),
      ', ',
      codeMark('.fill'),
      ', ',
      codeMark('.dropNull'),
      ', ',
      codeMark('.sample'),
      ', ',
      codeMark('.concat'),
      '.'
    ),
    paragraph(
      'Numbers: ',
      codeMark('.sum'),
      ', ',
      codeMark('.mean'),
      ', ',
      codeMark('.min'),
      ', ',
      codeMark('.max'),
      ', ',
      codeMark('.median'),
      ', ',
      codeMark('.count'),
      '. Groups: ',
      codeMark('.groupBy("region").agg({ qty: "sum" })'),
      '. Joins: ',
      codeMark('.leftJoin(products, "sku")'),
      ' or ',
      codeMark('.innerJoin'),
      '.'
    ),
    code(
      'javascript',
      `import orders from 'orders'
import products from 'products'

const priced = orders.leftJoin(products, 'sku').assign({
  revenue: (row) => row.qty * row.unit_price
})
console.log(priced.select('customer', 'product', 'qty', 'revenue').head(4))
priced.groupBy('region').agg({ revenue: 'sum', qty: 'sum' })`,
      'guide-join'
    )
  )

  content.push(paragraph('The matching products table:'), csvEmbed(GUIDE_PRODUCTS_ID))

  content.push(
    paragraph(
      'More guide sections will land here later. For now this is the $ library — run the blocks, then go write your own scripts.'
    )
  )

  return { type: 'doc', content }
}

export function buildGuidePage(spaceId: string, trees: Record<string, SpaceTree>): Page {
  const now = new Date().toISOString()
  return {
    id: GUIDE_PAGE_ID,
    spaceId,
    folderId: null,
    title: 'Guide',
    type: 'markdown',
    content: JSON.stringify(buildGuideDoc(trees)),
    description: '',
    icon: 'BookOpen',
    iconColor: 'slate',
    sortOrder: 0,
    archived: false,
    createdAt: now,
    updatedAt: now
  }
}
