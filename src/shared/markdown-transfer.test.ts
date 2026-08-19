import assert from 'node:assert/strict'
import { test } from 'node:test'
import { docToMarkdown, markdownToDoc } from './markdown-transfer'

function doc(content: unknown[]): string {
  return JSON.stringify({ type: 'doc', content })
}

test('docToMarkdown writes headings, lists, and paper blocks', () => {
  const markdown = docToMarkdown(
    doc([
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hello' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Body', marks: [{ type: 'bold' }] }] },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }]
          }
        ]
      },
      {
        type: 'runnableCode',
        attrs: { language: 'typescript', blockId: 'guide-today' },
        content: [{ type: 'text', text: 'console.log($today)' }]
      },
      { type: 'csvEmbed', attrs: { pageId: 'page-orders' } },
      {
        type: 'chartEmbed',
        attrs: { pageId: 'page-orders', kind: 'line', x: 'date', y: 'total' }
      },
      { type: 'pageLink', attrs: { pageId: 'page-welcome' } }
    ])
  )

  assert.match(markdown, /^## Hello$/m)
  assert.match(markdown, /^\*\*Body\*\*$/m)
  assert.match(markdown, /^- One$/m)
  assert.match(markdown, /:::paper-run\{language=typescript id=guide-today\}/)
  assert.match(markdown, /console\.log\(\$today\)/)
  assert.match(markdown, /:::paper-csv\{pageId=page-orders\}/)
  assert.match(markdown, /:::paper-chart\{pageId=page-orders kind=line x=date y=total\}/)
  assert.match(markdown, /\[page\]\(paper:\/\/page-welcome\)/)
})

test('markdownToDoc restores paper nodes and round-trips', () => {
  const source = [
    '# Title',
    '',
    'Hello',
    '',
    '- Alpha',
    '- Beta',
    '',
    '1. First',
    '',
    ':::paper-run{language=javascript id=block-1}',
    'console.log(1)',
    ':::',
    '',
    ':::paper-csv{pageId=csv-1}',
    ':::',
    '',
    ':::paper-chart{pageId=csv-1 kind=bar x=name y=qty}',
    ':::',
    '',
    '[page](paper://page-1)',
    ''
  ].join('\n')

  const parsed = JSON.parse(markdownToDoc(source)) as {
    type: string
    content: Array<{ type?: string; attrs?: Record<string, unknown> }>
  }
  const types = parsed.content.map((node) => node.type)
  assert.deepEqual(types, [
    'heading',
    'paragraph',
    'bulletList',
    'orderedList',
    'runnableCode',
    'csvEmbed',
    'chartEmbed',
    'pageLink'
  ])

  const run = parsed.content.find((node) => node.type === 'runnableCode')
  assert.equal(run?.attrs?.language, 'javascript')
  assert.equal(run?.attrs?.blockId, 'block-1')

  const chart = parsed.content.find((node) => node.type === 'chartEmbed')
  assert.equal(chart?.attrs?.pageId, 'csv-1')
  assert.equal(chart?.attrs?.kind, 'bar')

  const again = markdownToDoc(docToMarkdown(markdownToDoc(source)))
  assert.equal(again, markdownToDoc(source))
})

test('docToMarkdown returns non-JSON content unchanged', () => {
  assert.equal(docToMarkdown('not json'), 'not json')
})
