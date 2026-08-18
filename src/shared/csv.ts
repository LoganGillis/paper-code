export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  const pushCell = (): void => {
    row.push(cell)
    cell = ''
  }

  const pushRow = (): void => {
    pushCell()
    if (row.some((value) => value.length > 0)) {
      rows.push(row)
    }
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',' || char === '\t') {
      pushCell()
    } else if (char === '\n') {
      pushRow()
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell.length > 0 || row.length > 0) {
    pushRow()
  }

  const width = rows.reduce((max, current) => Math.max(max, current.length), 0)
  return rows.map((current) => {
    const next = [...current]
    while (next.length < width) next.push('')
    return next
  })
}

export function serializeCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (/[",\n\r]/.test(cell)) {
            return `"${cell.replaceAll('"', '""')}"`
          }
          return cell
        })
        .join(',')
    )
    .join('\n')
}

export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const [header, ...body] = rows
  return body.map((row) => {
    const record: Record<string, string> = {}
    header.forEach((key, index) => {
      record[key || `col${index + 1}`] = row[index] ?? ''
    })
    return record
  })
}
