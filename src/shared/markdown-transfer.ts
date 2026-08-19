type DocNode = {
  type?: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  text?: string
  marks?: Array<{ type: string }>
}

function textOf(node: DocNode): string {
  if (node.text) {
    const marks = node.marks ?? []
    let value = node.text
    if (marks.some((mark) => mark.type === 'code')) value = `\`${value}\``
    if (marks.some((mark) => mark.type === 'bold')) value = `**${value}**`
    if (marks.some((mark) => mark.type === 'italic')) value = `*${value}*`
    return value
  }
  return (node.content ?? []).map(textOf).join('')
}

function inline(node: DocNode): string {
  return (node.content ?? []).map(textOf).join('')
}

export function docToMarkdown(content: string): string {
  let doc: DocNode
  try {
    doc = JSON.parse(content) as DocNode
  } catch {
    return content
  }
  const lines: string[] = []
  const blocks = doc.content ?? []
  for (const node of blocks) {
    if (node.type === 'heading') {
      const level = Math.min(3, Number(node.attrs?.level ?? 1))
      lines.push(`${'#'.repeat(level)} ${inline(node)}`, '')
      continue
    }
    if (node.type === 'paragraph') {
      const body = inline(node)
      lines.push(body, '')
      continue
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const ordered = node.type === 'orderedList'
      ;(node.content ?? []).forEach((item, index) => {
        const prefix = ordered ? `${index + 1}. ` : '- '
        const para = item.content?.[0]
        lines.push(`${prefix}${para ? inline(para) : ''}`)
      })
      lines.push('')
      continue
    }
    if (node.type === 'blockquote') {
      for (const child of node.content ?? []) {
        lines.push(`> ${inline(child)}`)
      }
      lines.push('')
      continue
    }
    if (node.type === 'horizontalRule') {
      lines.push('---', '')
      continue
    }
    if (node.type === 'codeBlock') {
      const lang = String(node.attrs?.language ?? '')
      lines.push('```' + lang, textOf(node), '```', '')
      continue
    }
    if (node.type === 'runnableCode') {
      const language = String(node.attrs?.language ?? 'javascript')
      const blockId = String(node.attrs?.blockId ?? '')
      lines.push(`:::paper-run{language=${language}${blockId ? ` id=${blockId}` : ''}}`)
      lines.push(textOf(node))
      lines.push(':::', '')
      continue
    }
    if (node.type === 'csvEmbed') {
      lines.push(`:::paper-csv{pageId=${String(node.attrs?.pageId ?? '')}}`, ':::', '')
      continue
    }
    if (node.type === 'chartEmbed') {
      const pageId = String(node.attrs?.pageId ?? '')
      const kind = String(node.attrs?.kind ?? 'bar')
      const x = String(node.attrs?.x ?? '')
      const y = String(node.attrs?.y ?? '')
      lines.push(`:::paper-chart{pageId=${pageId} kind=${kind} x=${x} y=${y}}`, ':::', '')
      continue
    }
    if (node.type === 'scriptRun') {
      lines.push(`:::paper-script{pageId=${String(node.attrs?.pageId ?? '')}}`, ':::', '')
      continue
    }
    if (node.type === 'pageLink') {
      lines.push(`[page](paper://${String(node.attrs?.pageId ?? '')})`, '')
    }
  }
  return lines.join('\n').trimEnd() + '\n'
}

function attrsFrom(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const matches = raw.matchAll(/([A-Za-z]+)=([^\s}]+)/g)
  for (const match of matches) attrs[match[1]] = match[2]
  return attrs
}

export function markdownToDoc(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const content: DocNode[] = []
  let index = 0

  const pushParagraph = (value: string): void => {
    content.push({
      type: 'paragraph',
      content: value ? [{ type: 'text', text: value }] : []
    })
  }

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trim() === '') {
      index += 1
      continue
    }
    const fence = line.match(/^```(\w*)$/)
    if (fence) {
      const collected: string[] = []
      index += 1
      while (index < lines.length && lines[index] !== '```') {
        collected.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length) index += 1
      content.push({
        type: 'codeBlock',
        attrs: { language: fence[1] || null },
        content: collected.length ? [{ type: 'text', text: collected.join('\n') }] : []
      })
      continue
    }
    const directive = line.match(/^:::paper-(run|csv|chart|script)\{([^}]*)\}\s*$/)
    if (directive) {
      const kind = directive[1]
      const attrs = attrsFrom(directive[2] ?? '')
      const body: string[] = []
      index += 1
      while (index < lines.length && lines[index] !== ':::') {
        body.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length) index += 1
      if (kind === 'run') {
        content.push({
          type: 'runnableCode',
          attrs: {
            language: attrs.language === 'typescript' ? 'typescript' : 'javascript',
            blockId: attrs.id ?? null
          },
          content: body.length ? [{ type: 'text', text: body.join('\n') }] : []
        })
      } else if (kind === 'csv') {
        content.push({ type: 'csvEmbed', attrs: { pageId: attrs.pageId ?? '' } })
      } else if (kind === 'script') {
        content.push({ type: 'scriptRun', attrs: { pageId: attrs.pageId ?? '' } })
      } else {
        content.push({
          type: 'chartEmbed',
          attrs: {
            pageId: attrs.pageId ?? '',
            kind: attrs.kind ?? 'bar',
            x: attrs.x ?? '',
            y: attrs.y ?? ''
          }
        })
      }
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      content.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        content: heading[2] ? [{ type: 'text', text: heading[2] }] : []
      })
      index += 1
      continue
    }
    if (line === '---') {
      content.push({ type: 'horizontalRule' })
      index += 1
      continue
    }
    const pageLink = line.match(/^\[page\]\(paper:\/\/([^)]+)\)$/)
    if (pageLink) {
      content.push({ type: 'pageLink', attrs: { pageId: pageLink[1] } })
      index += 1
      continue
    }
    if (line.startsWith('- ')) {
      const items: DocNode[] = []
      while (index < lines.length && (lines[index] ?? '').startsWith('- ')) {
        const text = (lines[index] ?? '').slice(2)
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }]
        })
        index += 1
      }
      content.push({ type: 'bulletList', content: items })
      continue
    }
    if (/^\d+\.\s/.test(line)) {
      const items: DocNode[] = []
      while (index < lines.length && /^\d+\.\s/.test(lines[index] ?? '')) {
        const text = (lines[index] ?? '').replace(/^\d+\.\s/, '')
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }]
        })
        index += 1
      }
      content.push({ type: 'orderedList', content: items })
      continue
    }
    if (line.startsWith('> ')) {
      const quotes: DocNode[] = []
      while (index < lines.length && (lines[index] ?? '').startsWith('> ')) {
        quotes.push({
          type: 'paragraph',
          content: [{ type: 'text', text: (lines[index] ?? '').slice(2) }]
        })
        index += 1
      }
      content.push({ type: 'blockquote', content: quotes })
      continue
    }
    pushParagraph(line)
    index += 1
  }

  return JSON.stringify({ type: 'doc', content })
}
