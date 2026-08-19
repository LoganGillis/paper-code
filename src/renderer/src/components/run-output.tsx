import type { RunLog, RunResult } from '@shared/api'
import { CsvEditor } from '@/components/csv-editor'
import { serializeCsv } from '@shared/csv'
import { cn } from '@/lib/utils'

function ObjectView({ value }: { value: unknown }): React.JSX.Element {
  return (
    <pre className="overflow-x-auto font-mono text-[12.5px] leading-6 text-ink-soft whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function LogLine({ line }: { line: RunLog }): React.JSX.Element {
  if (line.kind === 'table' && line.table && line.table.length > 0) {
    return (
      <div className="my-1 max-h-56 overflow-auto rounded-md border border-border/60">
        <CsvEditor content={serializeCsv(line.table)} onChange={() => undefined} readOnly />
      </div>
    )
  }
  if (line.kind === 'object' && line.object !== undefined) {
    return <ObjectView value={line.object} />
  }
  return (
    <p
      className={cn(
        'font-mono text-[12.5px] leading-6',
        line.level === 'error' && 'text-destructive',
        line.level === 'warn' && 'text-amber-800 dark:text-amber-200'
      )}
    >
      {line.message}
    </p>
  )
}

export function RunOutput({ run }: { run: RunResult }): React.JSX.Element {
  return (
    <div className="select-text px-3 py-2">
      {run.logs.map((line, index) => (
        <LogLine key={`${line.level}-${index}`} line={line} />
      ))}
      {run.resultKind === 'table' && run.resultTable ? (
        <div className="mt-1 max-h-64 overflow-auto rounded-md border border-border/60">
          <CsvEditor content={serializeCsv(run.resultTable)} onChange={() => undefined} readOnly />
        </div>
      ) : null}
      {run.resultKind === 'object' && run.resultObject !== undefined ? (
        <ObjectView value={run.resultObject} />
      ) : null}
      {run.result && run.resultKind !== 'table' && run.resultKind !== 'object' ? (
        <p className="font-mono text-[12.5px] leading-6 text-ink-soft">{run.result}</p>
      ) : null}
      {run.error ? <p className="font-mono text-[12.5px] text-destructive">{run.error}</p> : null}
    </div>
  )
}
