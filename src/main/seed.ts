import type { PrismaClient } from '../generated/prisma/client'

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

function doc(...content: DocNode[]): string {
  return JSON.stringify({ type: 'doc', content })
}

function note(value: string): string {
  return doc(paragraph(value))
}

const HELLO_TS = `const greet = (name: string): string => {
  return \`Hello, \${name}\`
}

console.log(greet('Paper'))

const total = [2, 3, 5].reduce((sum, value) => sum + value, 0)
console.log('2 + 3 + 5 =', total)
`

const TODAY_JS = `console.log($today, $today.weekdayName)
console.log($yesterday, '→', $tomorrow)
console.log('week', $startOfWeek, 'to', $endOfWeek)
console.log('next Friday', $today.next('friday'))
console.log('nine thirty', $today.at(9, 30))
console.log($today.subDays(1).isSame($yesterday))
`

const SALES_JS = `import orders from 'orders'
import products from 'products'

console.log(orders)
console.log('columns', orders.columns)

const paid = orders.where('status', 'paid')
console.log('paid rows', paid.length, 'qty', paid.sum('qty'))
console.log(paid.groupBy('region').agg({ qty: 'sum' }))

const priced = orders.leftJoin(products, 'sku').assign({
  revenue: (row) => row.qty * row.unit_price
})
console.log(priced.select('customer', 'product', 'qty', 'revenue').head(4))
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

function welcomeDoc(ids: { hello: string; today: string; sales: string; orders: string }): string {
  return doc(
    heading(1, 'Welcome to Paper'),
    paragraph(
      'A notebook for notes, tables, and scripts. The House tab is your desk. The book in the sidebar is the guide — it cannot be edited, but you can run the examples.'
    ),
    heading(2, 'Find your way'),
    bullet(
      'Spaces hold folders and pages. This one is Workshop.',
      'Type / in a note for headings, lists, scripts, tables, and charts.',
      'Type [[ to link another page.',
      'On a script, press ⌘↵ (or Ctrl+Enter) to run. Use console.log — a leftover value at the end of a file will error.'
    ),
    heading(2, 'Try these'),
    paragraph(
      'A typed hello: ',
      { type: 'pageLink', attrs: { pageId: ids.hello } },
      '. Dates you can chain: ',
      { type: 'pageLink', attrs: { pageId: ids.today } },
      '. Tables like a tiny pandas: ',
      { type: 'pageLink', attrs: { pageId: ids.sales } },
      '.'
    ),
    heading(2, 'A table and a chart'),
    paragraph('The sample orders table, and the same data as a chart:'),
    { type: 'csvEmbed', attrs: { pageId: ids.orders } },
    {
      type: 'chartEmbed',
      attrs: { pageId: ids.orders, kind: 'bar', x: 'region', y: 'qty' }
    },
    paragraph(
      'Open ',
      { type: 'pageLink', attrs: { pageId: ids.orders } },
      ' and switch to Chart to change the axes. Secrets live on the space menu, not in Settings.'
    )
  )
}

export async function seedExamples(prisma: PrismaClient): Promise<void> {
  const space = await prisma.space.create({
    data: { name: 'Workshop', icon: 'BookOpen', iconColor: 'slate' }
  })

  const notes = await prisma.folder.create({
    data: {
      name: 'Notes',
      icon: 'Folder',
      iconColor: 'slate',
      spaceId: space.id,
      sortOrder: 0
    }
  })
  const scripts = await prisma.folder.create({
    data: {
      name: 'Scripts',
      icon: 'Code',
      iconColor: 'sky',
      spaceId: space.id,
      sortOrder: 1
    }
  })
  const data = await prisma.folder.create({
    data: {
      name: 'Data',
      icon: 'Table2',
      iconColor: 'sage',
      spaceId: space.id,
      sortOrder: 2
    }
  })

  const hello = await prisma.page.create({
    data: {
      title: 'hello',
      type: 'typescript',
      content: HELLO_TS,
      description: note(
        'A tiny typed greeting. Press Run — output goes below, not as a leftover value.'
      ),
      icon: 'FileCode2',
      iconColor: 'sky',
      spaceId: space.id,
      folderId: scripts.id,
      sortOrder: 0
    }
  })
  const today = await prisma.page.create({
    data: {
      title: 'today',
      type: 'javascript',
      content: TODAY_JS,
      description: note(
        '$today, week bounds, and chainable $Date values. Each read hits the clock.'
      ),
      icon: 'Calendar',
      iconColor: 'peach',
      spaceId: space.id,
      folderId: scripts.id,
      sortOrder: 1
    }
  })
  const sales = await prisma.page.create({
    data: {
      title: 'sales',
      type: 'javascript',
      content: SALES_JS,
      description: note(
        'Load orders with import, filter, group, and join products. Log what you want to see.'
      ),
      icon: 'Table2',
      iconColor: 'sage',
      spaceId: space.id,
      folderId: scripts.id,
      sortOrder: 2
    }
  })
  const orders = await prisma.page.create({
    data: {
      title: 'orders',
      type: 'csv',
      content: ORDERS_CSV,
      description: note(
        'Mock shop orders. Open Chart to plot qty by region, or import this from a script.'
      ),
      icon: 'ShoppingBag',
      iconColor: 'sage',
      spaceId: space.id,
      folderId: data.id,
      sortOrder: 0
    }
  })
  await prisma.page.create({
    data: {
      title: 'products',
      type: 'csv',
      content: PRODUCTS_CSV,
      description: note('Catalog with prices. Join to orders on sku.'),
      icon: 'Package',
      iconColor: 'mint',
      spaceId: space.id,
      folderId: data.id,
      sortOrder: 1
    }
  })
  await prisma.page.create({
    data: {
      title: 'employees',
      type: 'csv',
      content: EMPLOYEES_CSV,
      description: note('A small people table. Try Chart on salary by department.'),
      icon: 'Users',
      iconColor: 'indigo',
      spaceId: space.id,
      folderId: data.id,
      sortOrder: 2
    }
  })
  await prisma.page.create({
    data: {
      title: 'Scratch',
      type: 'markdown',
      content: doc(paragraph('A blank note. Type / for commands, or [[ to link a page.')),
      icon: 'StickyNote',
      iconColor: 'amber',
      spaceId: space.id,
      folderId: notes.id,
      sortOrder: 0
    }
  })
  await prisma.page.create({
    data: {
      title: 'Welcome',
      type: 'markdown',
      content: welcomeDoc({
        hello: hello.id,
        today: today.id,
        sales: sales.id,
        orders: orders.id
      }),
      icon: 'Sparkles',
      iconColor: 'slate',
      spaceId: space.id,
      folderId: null,
      sortOrder: 0
    }
  })
}

let seededThisLaunch = false

export function didSeedThisLaunch(): boolean {
  return seededThisLaunch
}

export async function seedIfEmpty(prisma: PrismaClient): Promise<boolean> {
  if ((await prisma.space.count()) > 0) {
    seededThisLaunch = false
    return false
  }
  await seedExamples(prisma)
  seededThisLaunch = true
  return true
}
