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

function parseDelimited(text: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let atCellStart = true
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') quoted = false
      else cell += char
      continue
    }
    if (char === '"' && atCellStart) {
      quoted = true
      atCellStart = false
    } else if (char === delimiter) {
      row.push(cell)
      cell = ''
      atCellStart = true
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      atCellStart = true
    } else if (char !== '\r') {
      cell += char
      atCellStart = false
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/**
 * Splits pasted text into grid cells. Text with a tab is read as tab-separated (what
 * spreadsheets copy); otherwise commas separate cells. Quoted cells keep their delimiters.
 */
export function parseClipboardGrid(text: string): string[][] {
  const delimiter = text.includes('\t') ? '\t' : ','
  return parseDelimited(text.replace(/\r\n?/g, '\n').replace(/\n$/, ''), delimiter)
}

/**
 * True when text reads as a table: at least two lines, at least two columns, and the same
 * number of cells on every line.
 */
export function looksLikeCsv(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || /^[[{]/.test(trimmed)) return false
  const rows = parseClipboardGrid(trimmed).filter((row) => row.some((cell) => cell.trim()))
  if (rows.length < 2) return false
  const width = rows[0].length
  return width >= 2 && rows.every((row) => row.length === width)
}

/**
 * Clipboard text (comma- or tab-separated) as CSV for a new table page. Blank lines and the
 * whitespace around cells are dropped, so the first non-empty line becomes the header row, the
 * same way an opened CSV file reads.
 */
export function clipboardToCsv(text: string): string {
  const rows = parseClipboardGrid(text.trim())
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell))
  return `${serializeCsv(rows)}\n`
}
