import { createContext, useCallback, useContext, useRef, useState } from 'react'

type SavedFlashContextValue = {
  visible: boolean
  flash: () => void
}

const SavedFlashContext = createContext<SavedFlashContextValue | null>(null)

export function SavedFlashProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = useCallback(() => {
    setVisible(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), 1400)
  }, [])

  return (
    <SavedFlashContext.Provider value={{ visible, flash }}>
      {children}
      {visible ? (
        <div className="paper-float pointer-events-none fixed top-14 right-4 z-50 px-3 py-1.5 text-[12px] text-muted-foreground">
          Saved
        </div>
      ) : null}
    </SavedFlashContext.Provider>
  )
}

export function useSavedFlash(): SavedFlashContextValue {
  const context = useContext(SavedFlashContext)
  if (!context) throw new Error('useSavedFlash must be used within SavedFlashProvider')
  return context
}
