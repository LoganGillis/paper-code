import { useEffect, useState } from 'react'

export function useNow(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = (): void => setNow(new Date())
    const id = window.setInterval(tick, intervalMs)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])

  return now
}
