import { getPrisma } from './db'

const WELCOME_DOC = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Paper is a small place to keep notes and run JavaScript or TypeScript. Spaces hold folders; folders hold pages. This page is live Markdown — type naturally, like Notion.'
        }
      ]
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Try ' },
        { type: 'text', marks: [{ type: 'code' }], text: '/' },
        { type: 'text', text: ' at the start of a line for headings, lists, and quotes.' }
      ]
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Notes live as Markdown pages' }]
            }
          ]
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Snippets run in an isolated main-process VM' }]
            }
          ]
        }
      ]
    }
  ]
})

const HELLO_TS = `const greet = (name: string): string => {
  return \`Hello, \${name}\`
}

console.log(greet('Paper'))

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
sum([2, 3, 5])
`

const HELLO_JS = `const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  console.log('Running in the main process…')
  await wait(120)
  return { ok: true, at: new Date().toISOString() }
}

main()
`

export async function seedIfEmpty(): Promise<void> {
  const prisma = getPrisma()
  if ((await prisma.space.count()) > 0) return

  const space = await prisma.space.create({
    data: { name: 'Workshop', icon: 'BookOpen', iconColor: 'slate' }
  })

  const notes = await prisma.folder.create({
    data: { name: 'Notes', spaceId: space.id, sortOrder: 0 }
  })

  const snippets = await prisma.folder.create({
    data: { name: 'Snippets', spaceId: space.id, sortOrder: 1 }
  })

  await prisma.page.createMany({
    data: [
      {
        title: 'Welcome',
        type: 'markdown',
        content: WELCOME_DOC,
        icon: 'FileText',
        iconColor: 'slate',
        spaceId: space.id,
        folderId: notes.id,
        sortOrder: 0
      },
      {
        title: 'hello',
        type: 'typescript',
        content: HELLO_TS,
        description: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'A tiny typed greeting. Press Run to execute it.' }]
            }
          ]
        }),
        icon: 'FileCode2',
        iconColor: 'sky',
        spaceId: space.id,
        folderId: snippets.id,
        sortOrder: 0
      },
      {
        title: 'async',
        type: 'javascript',
        content: HELLO_JS,
        description: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Shows async work and a returned object in the output panel.'
                }
              ]
            }
          ]
        }),
        icon: 'FileCode',
        iconColor: 'peach',
        spaceId: space.id,
        folderId: snippets.id,
        sortOrder: 1
      }
    ]
  })
}
