import { useCallback, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  JsonPreviewContext,
  type JsonPreviewChoice,
  type JsonPreviewRequest
} from '@/lib/json-preview'

const PREVIEW_LINES = 40

/** Hosts the dialog that previews JSON a paste or format would change. */
export function JsonPreviewProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [request, setRequest] = useState<JsonPreviewRequest | null>(null)
  const resolveRef = useRef<((choice: JsonPreviewChoice) => void) | null>(null)

  const finish = useCallback((choice: JsonPreviewChoice) => {
    resolveRef.current?.(choice)
    resolveRef.current = null
    setRequest(null)
  }, [])

  const preview = useCallback(
    (next: JsonPreviewRequest) =>
      new Promise<JsonPreviewChoice>((resolve) => {
        resolveRef.current?.(null)
        resolveRef.current = resolve
        setRequest(next)
      }),
    []
  )

  const lines = request?.result.value.split('\n') ?? []
  const shown = lines.slice(0, PREVIEW_LINES).join('\n')

  return (
    <JsonPreviewContext.Provider value={preview}>
      {children}
      <AlertDialog open={request != null} onOpenChange={(open) => (open ? null : finish(null))}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            {request?.description ? (
              <AlertDialogDescription>{request.description}</AlertDialogDescription>
            ) : (
              <AlertDialogDescription asChild>
                <ul className="list-disc space-y-1 pl-5">
                  {request?.result.warnings.map((warning) => (
                    <li key={warning.code}>{warning.message}</li>
                  ))}
                </ul>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <pre
            aria-label={request?.tableLabel ? 'Table preview' : 'JSON preview'}
            className="max-h-72 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[12px]"
          >
            {shown}
            {lines.length > PREVIEW_LINES ? '\n…' : ''}
          </pre>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={() => finish('text')}>
              {request?.textLabel}
            </Button>
            {request?.jsonLabel ? (
              <Button autoFocus={!request.tableLabel} onClick={() => finish('json')}>
                {request.jsonLabel}
              </Button>
            ) : null}
            {request?.tableLabel ? (
              <Button autoFocus onClick={() => finish('table')}>
                {request.tableLabel}
              </Button>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </JsonPreviewContext.Provider>
  )
}
