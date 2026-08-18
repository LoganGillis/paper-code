import { useEffect, useRef } from 'react'

const LAYERS = [
  { amp: 0.2, cycles: 1.15, speed: 0.31, wobble: 0.09, alpha: 0.055, base: 0.42 },
  { amp: 0.15, cycles: 1.85, speed: -0.23, wobble: 0.13, alpha: 0.08, base: 0.54 },
  { amp: 0.09, cycles: 2.7, speed: 0.47, wobble: 0.18, alpha: 0.05, base: 0.66 }
]

function paintWaves(ctx: CanvasRenderingContext2D, t: number): void {
  const { width: w, height: h } = ctx.canvas
  ctx.clearRect(0, 0, w, h)
  const step = Math.max(3, Math.round(w / 220))

  for (const layer of LAYERS) {
    const wander = Math.sin(t * layer.wobble + layer.cycles) * 0.22
    const amp = h * layer.amp * (1 + wander)
    const mid = h * layer.base + Math.sin(t * layer.wobble * 0.6) * h * 0.04
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += step) {
      const nx = x / w
      const y =
        mid +
        Math.sin(nx * Math.PI * 2 * layer.cycles + t * layer.speed) * amp +
        Math.sin(nx * Math.PI * 2 * layer.cycles * 1.65 + t * layer.speed * 0.55 + 1.1) *
          amp *
          0.38
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.globalAlpha = layer.alpha
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export function DeskAtmosphere({ active = true }: { active?: boolean }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let running = true
    const origin = performance.now()

    const syncSize = (): void => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const nextW = Math.max(1, Math.floor(rect.width * dpr))
      const nextH = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW
        canvas.height = nextH
      }
      ctx.fillStyle = getComputedStyle(canvas).color
    }

    const tick = (now: number): void => {
      if (!running) return
      paintWaves(ctx, (now - origin) / 1000)
      if (!reduce && active && document.visibilityState === 'visible') {
        frame = requestAnimationFrame(tick)
      }
    }

    syncSize()
    frame = requestAnimationFrame(tick)
    const ro = new ResizeObserver(() => {
      syncSize()
      if (reduce || !active) paintWaves(ctx, 0)
    })
    ro.observe(canvas)

    const onVis = (): void => {
      if (document.visibilityState === 'visible' && active && !reduce) {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [active])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="desk-dots absolute inset-0 opacity-80" />
      <div className="desk-rules absolute inset-0 opacity-70" />
      <div className="absolute -top-24 -right-16 size-72 rounded-full border border-foreground/6 opacity-50">
        <div className="desk-spin-slow absolute inset-6 rounded-full border border-dashed border-foreground/8" />
      </div>
      <canvas
        ref={canvasRef}
        className="absolute inset-x-0 bottom-0 h-40 w-full text-foreground"
      />
    </div>
  )
}
