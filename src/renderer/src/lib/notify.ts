import { toast } from 'sonner'

const ERROR_TOAST_ID = 'paper-error'

/** The message of a thrown value, or `fallback` when it has none. */
export function errorText(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

/**
 * Shows an error toast that stays until it is closed or the next action succeeds. Only one
 * shows at a time, so a newer error replaces an older one.
 */
export function showError(message: string): void {
  toast.error(message, { id: ERROR_TOAST_ID, duration: Infinity, closeButton: true })
}

/** Clears the error toast after an action succeeds. */
export function clearError(): void {
  toast.dismiss(ERROR_TOAST_ID)
}

/** Shows a short confirmation with an Undo button. */
export function showUndo(message: string, undo: () => void | Promise<void>): void {
  toast(message, {
    action: {
      label: 'Undo',
      onClick: () => {
        void Promise.resolve()
          .then(undo)
          .catch((cause) => showError(errorText(cause, 'Could not undo')))
      }
    }
  })
}
