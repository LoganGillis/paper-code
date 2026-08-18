import { parseCsv } from '@shared/csv'
import { cn } from '@/lib/utils'

export function CsvViewer({ content }: { content: string }): React.JSX.Element {
  const rows = parseCsv(content)

  if (rows.length === 0) {
    return <p className="px-6 py-10 text-sm text-muted-foreground">This CSV is empty.</p>
  }

  const [header, ...body] = rows
  const columns = header.length > 0 ? header : rows[0]

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-sidebar">
          <tr>
            {columns.map((cell, index) => (
              <th
                key={`h-${index}`}
                className="border-b border-r border-border/70 px-3 py-2 text-left font-medium whitespace-nowrap"
              >
                {cell || `Column ${index + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(header.length > 0 ? body : rows).map((row, rowIndex) => (
            <tr key={`r-${rowIndex}`} className={cn(rowIndex % 2 === 1 && 'bg-sidebar/50')}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`c-${rowIndex}-${cellIndex}`}
                  className="border-b border-r border-border/50 px-3 py-1.5 align-top whitespace-nowrap"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
