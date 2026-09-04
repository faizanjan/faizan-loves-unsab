import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

/* Every photo in ./photos, picked up at build time. */
const files = import.meta.glob('./photos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const PHOTOS = Object.keys(files).sort().map(k => files[k])

export const hasPhotos = PHOTOS.length > 0
export const PHOTO_COUNT = PHOTOS.length

/* The bitmap has to match the screen's *device* pixels, not its CSS pixels. */
const MIN_PX = 1_600_000
const MAX_PX = 3_600_000

const FADE_MS = 900
/* If she stops tapping, the rest arrive on their own — the photos matter more
   than the mechanic, and four taps should not cost her seventeen memories. */
const IDLE_MS = 14_000
const IDLE_EVERY_MS = 2200

function gridFor(count, aspect) {
  const cols = Math.max(2, Math.min(6, Math.round(Math.sqrt(count * aspect))))
  return { cols, rows: Math.ceil(count / cols) }
}

function shuffled(n) {
  const a = [...Array(n).keys()]
  let seed = 9301
  for (let i = n - 1; i > 0; i--) {
    seed = (seed * 49297 + 233280) % 233280
    const j = seed % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const load = (src) =>
  new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

const easeOut = (t) => 1 - Math.pow(1 - t, 3)

const Backdrop = forwardRef(function Backdrop({ onReveal }, ref) {
  const canvasRef = useRef(null)
  const api = useRef({ revealNext: () => {}, revealAll: () => {} })

  useImperativeHandle(ref, () => ({
    revealNext: () => api.current.revealNext(),
    revealAll: () => api.current.revealAll(),
  }), [])

  useEffect(() => {
    if (!hasPhotos) return
    const canvas = canvasRef.current
    if (!canvas) return
    let alive = true
    let images = []
    let finished = null          // the whole wall, blurred and tinted, ready to copy from
    let cells = []               // {sx, sy, w, h, shownAt}
    let order = []
    let revealOrder = []   // which cell surfaces next — scattered, not left-to-right
    let nextUp = 0
    let raf = 0
    let lastTouch = performance.now()
    let lastIdle = performance.now()

    function build() {
      /* A hidden or mid-resize pane can report a zero viewport, which makes
         aspect NaN, W NaN, and canvas.width silently 0 — the mosaic then throws
         on drawImage and the backdrop stays blank forever. Wait for a real
         size instead. */
      const vw = window.innerWidth || document.documentElement.clientWidth || 0
      const vh = window.innerHeight || document.documentElement.clientHeight || 0
      if (vw < 2 || vh < 2) return false

      const aspect = vw / vh
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      const target = Math.min(MAX_PX, Math.max(MIN_PX, vw * vh * dpr * dpr))
      const W = Math.round(Math.sqrt(target * aspect))
      const H = Math.round(W / aspect)
      if (!Number.isFinite(W) || !Number.isFinite(H) || W < 2 || H < 2) return false
      const { cols, rows } = gridFor(images.length, aspect)
      const cw = W / cols
      const ch = H / rows

      const sharp = document.createElement('canvas')
      sharp.width = W
      sharp.height = H
      const sc = sharp.getContext('2d')

      order = shuffled(images.length)
      const next = []
      for (let i = 0; i < cols * rows; i++) {
        const img = images[order[i % images.length]]
        const x = (i % cols) * cw
        const y = Math.floor(i / cols) * ch
        const scale = Math.max(cw / img.width, ch / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        sc.save()
        sc.beginPath()
        sc.rect(x, y, cw, ch)
        sc.clip()
        sc.drawImage(img, x + (cw - dw) / 2, y + (ch - dh) / 2, dw, dh)
        sc.restore()
        next.push({ sx: x, sy: y, w: cw, h: ch, shownAt: 0 })
      }

      finished = document.createElement('canvas')
      finished.width = W
      finished.height = H
      const fc = finished.getContext('2d')
      fc.filter = 'blur(0.6px) saturate(1.05) brightness(0.92)'
      fc.drawImage(sharp, -3, -3, W + 6, H + 6)
      fc.filter = 'none'
      fc.globalAlpha = 0.18
      fc.globalCompositeOperation = 'color'
      fc.fillStyle = '#5a2350'
      fc.fillRect(0, 0, W, H)
      fc.globalCompositeOperation = 'source-over'
      fc.globalAlpha = 1
      sharp.width = sharp.height = 0

      // keep anything already uncovered uncovered across a resize
      const keep = cells.filter(c => c.shownAt).length
      cells = next
      revealOrder = shuffled(cells.length)
      for (let i = 0; i < keep && i < cells.length; i++) cells[revealOrder[i]].shownAt = 1

      canvas.width = W
      canvas.height = H
      canvas.classList.add('ready')
      return true
    }

    function reveal() {
      if (nextUp >= cells.length) return false
      cells[revealOrder[nextUp]].shownAt = performance.now()
      nextUp += 1
      onReveal?.(Math.min(nextUp, images.length), images.length)
      return true
    }

    api.current.revealNext = () => {
      lastTouch = performance.now()
      return reveal()
    }
    api.current.revealAll = () => { while (reveal()) {} }

    function frame(now) {
      if (!alive) return

      // gentle safety net: if she stops, the rest come out on their own
      if (nextUp > 0 && nextUp < cells.length &&
          now - lastTouch > IDLE_MS && now - lastIdle > IDLE_EVERY_MS) {
        lastIdle = now
        reveal()
      }

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const c of cells) {
        if (!c.shownAt) continue
        const t = c.shownAt === 1 ? 1 : Math.min(1, (now - c.shownAt) / FADE_MS)
        ctx.globalAlpha = easeOut(t)
        ctx.drawImage(finished, c.sx, c.sy, c.w, c.h, c.sx, c.sy, c.w, c.h)
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }

    ;(async () => {
      images = (await Promise.all(PHOTOS.map(load))).filter(Boolean)
      if (!alive || !images.length || !canvasRef.current) return
      // keep trying until the viewport reports a usable size
      const attempt = () => {
        if (!alive) return
        if (build()) raf = requestAnimationFrame(frame)
        else raf = requestAnimationFrame(attempt)
      }
      attempt()
    })()

    let timer = 0
    let lastAspect = window.innerWidth / window.innerHeight
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const vw = window.innerWidth, vh = window.innerHeight
        if (vw < 2 || vh < 2) return
        const aspect = vw / vh
        if (Math.abs(aspect - lastAspect) / lastAspect > 0.15) {
          lastAspect = aspect
          build()
        }
      }, 250)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      alive = false
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [onReveal])

  if (!hasPhotos) return null
  return <canvas ref={canvasRef} className="backdrop" aria-hidden="true" />
})

export default Backdrop
