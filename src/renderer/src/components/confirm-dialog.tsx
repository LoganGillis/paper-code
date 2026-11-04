import { useCallback, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { ConfirmContext, type ConfirmRequest } from '@/lib/confirm'

/** Hosts the one AlertDialog used to confirm every destructive action. */
export function ConfirmProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const finish = useCallback((ok: boolean) => {
    resolveRef.current?.(ok)
    resolveRef.current = null
    setRequest(null)
  }, [])

  const confirm = useCallback(
    (next: ConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current?.(false)
        resolveRef.current = resolve
        setRequest(next)
      }),
    []
  )

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={request != null} onOpenChange={(open) => (open ? null : finish(false))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            <AlertDialogDescription>{request?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => finish(true)}>
              {request?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}
