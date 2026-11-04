import { createContext, useContext } from 'react'

export type ConfirmRequest = {
  title: string
  description: string
  /** Label of the destructive button, e.g. "Delete space". */
  confirmLabel: string
}

export type Confirm = (request: ConfirmRequest) => Promise<boolean>

export const ConfirmContext = createContext<Confirm | null>(null)

/** Asks the user to confirm a destructive action; resolves true only when they confirm. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider')
  return confirm
}
