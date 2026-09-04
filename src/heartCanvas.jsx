import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const TAU = Math.PI * 2

/* Classic heart curve, in its own raw units; y is up. */
function curve(t) {
  return [
    16 * Math.pow(Math.sin(t), 3),
    13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t),
  ]
}

/* One polygon of the outline, measured rather than assumed: the curve's extents
   are not symmetric, and guessing them clips the top of the heart. */
const STEPS = 720
const OUTLINE = []
for (let i = 0; i < STEPS; i++) OUTLINE.push(curve((i / STEPS) * TAU))

const BOUNDS = OUTLINE.reduce((b, [x, y]) => ({
  minX: Math.min(b.minX, x), maxX: Math.max(b.maxX, x),
  minY: Math.min(b.minY, y), maxY: Math.max(b.maxY, y),
}), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })

const MID_X = (BOUNDS.minX + BOUNDS.maxX) / 2
const MID_Y = (BOUNDS.minY + BOUNDS.maxY) / 2
const NORM = Math.max(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxY - BOUNDS.minY) / 2

/* Half-extents in normalised space, so the canvas can size the heart exactly. */
export const HALF_W = (BOUNDS.maxX - BOUNDS.minX) / 2 / NORM
export const HALF_H = (BOUNDS.maxY - BOUNDS.minY) / 2 / NORM

/* Centre the shape and flip to canvas coordinates (y down). */
const toLocal = ([x, y]) => [(x - MID_X) / NORM, -(y - MID_Y) / NORM]
const LOCAL = OUTLINE.map(toLocal)

/* Cumulative arc length, so outline particles space themselves evenly instead of
   bunching where the curve slows down (which shows up as bright seams). */
const ARC = [0]
for (let i = 1; i <= LOCAL.length; i++) {
  const a = LOCAL[i - 1], b = LOCAL[i % LOCAL.length]
  ARC.push(ARC[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
}
const PERIMETER = ARC[ARC.length - 1]

function outlinePoint(rand) {
  const s = rand() * PERIMETER
  let lo = 0, hi = ARC.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (ARC[mid] <= s) lo = mid; else hi = mid
  }
  const a = LOCAL[lo], b = LOCAL[(lo + 1) % LOCAL.length]
  const f = (s - ARC[lo]) / Math.max(1e-6, ARC[lo + 1] - ARC[lo])
  const drift = (rand() - 0.5) * 0.045
  return [a[0] + (b[0] - a[0]) * f + drift, a[1] + (b[1] - a[1]) * f + drift]
}

function inside(px, py) {
  let hit = false
  for (let i = 0, j = LOCAL.length - 1; i < LOCAL.length; j = i++) {
    const [xi, yi] = LOCAL[i], [xj, yj] = LOCAL[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

function fillPoint(rand) {
  for (let k = 0; k < 40; k++) {
    const x = (rand() * 2 - 1) * HALF_W
    const y = (rand() * 2 - 1) * HALF_H
    if (inside(x, y)) return [x, y]
  }
  return [0, 0]
}

/* Half hug the outline, half fill the body. */
function heartPoint(rand) {
  return rand() < 0.42 ? outlinePoint(rand) : fillPoint(rand)
}

const PALETTE = [
  [255, 62, 128, 0.42],
  [255, 132, 176, 0.30],
  [255, 206, 226, 0.20],
  [255, 246, 250, 0.08],
]

function makeSprite(rgb) {
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const h = size / 2
  const grad = g.createRadialGradient(h, h, 0, h, h, h)
  const [r, gg, b] = rgb
  grad.addColorStop(0, `rgba(${r},${gg},${b},1)`)
  grad.addColorStop(0.22, `rgba(${r},${gg},${b},0.55)`)
  grad.addColorStop(0.55, `rgba(${r},${gg},${b},0.13)`)
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

/* Two thumps per cycle, like an actual heartbeat rather than a sine wave. */
function beatEnvelope(phase) {
  const a = Math.exp(-Math.pow((phase - 0.02) / 0.055, 2))
  const b = 0.55 * Math.exp(-Math.pow((phase - 0.23) / 0.075, 2))
  return a + b
}

const ASSEMBLE_MS = 2600

const HeartCanvas = forwardRef(function HeartCanvas({ onFormed, reduced = false }, ref) {
  const canvasRef = useRef(null)
  const api = useRef({ pulse: () => {} })

  useImperativeHandle(ref, () => ({
    pulse: () => api.current.pulse(),
    excite: () => api.current.excite(),
  }), [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const sprites = PALETTE.map(p => makeSprite(p))

    let w = 0, h = 0, cx = 0, cy = 0, scale = 1
    let particles = []
    let sparks = []
    let raf = 0
    let startedAt = 0
    let last = 0
    /* Beat phase is accumulated rather than derived from elapsed time, so the
       rate can be pushed up on a touch and ease back on its own. */
    let beatPhase = 0
    let beatRate = 1
    let formed = false
    let disposed = false

    const rand = Math.random

    function layout() {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = w / 2
      cy = h / 2
      scale = Math.min(w / (2 * HALF_W), h / (2 * HALF_H)) * 0.9
    }

    function seed() {
      const target = Math.round(Math.min(1800, Math.max(650, (w * h) / 150)))
      const reach = Math.max(w, h)
      particles = new Array(target)
      for (let i = 0; i < target; i++) {
        const [hx, hy] = heartPoint(rand)
        const a1 = Math.atan2(hy, hx)
        const a0 = rand() * TAU
        // Shortest way round, plus a deliberate extra turn so they spiral in.
        let d = ((a0 - a1 + Math.PI) % TAU + TAU) % TAU - Math.PI
        d += (rand() < 0.5 ? -1 : 1) * (0.7 + rand() * 0.6)
        particles[i] = {
          hx, hy,
          x: cx + hx * scale, y: cy + hy * scale, vx: 0, vy: 0,
          r0: reach * (0.45 + rand() * 1.0),
          a1, da: d,
          delay: rand() * 0.42,
          size: 0.9 + rand() * 1.8,
          ci: pickColor(rand()),
          phase: rand() * TAU,
          wob: 1.2 + rand() * 2.2,
        }
      }
      sparks = []
    }

    function pickColor(u) {
      let acc = 0
      for (let i = 0; i < PALETTE.length; i++) {
        acc += PALETTE[i][3]
        if (u <= acc) return i
      }
      return PALETTE.length - 1
    }

    function spawnSpark(x, y, speed, life) {
      const a = rand() * TAU
      sparks.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 0.35,
        life, max: life,
        size: 0.8 + rand() * 1.6,
        ci: pickColor(rand()),
      })
    }

    api.current.excite = () => { beatRate = Math.min(2.6, beatRate + 0.6) }

    api.current.pulse = () => {
      for (const p of particles) {
        const dx = p.x - cx, dy = p.y - cy
        const d = Math.hypot(dx, dy) || 1
        const push = 7 + 9 * (1 - Math.min(1, d / (scale * 0.9)))
        p.vx += (dx / d) * push
        p.vy += (dy / d) * push
      }
      for (let i = 0; i < 46; i++) {
        const src = particles[(rand() * particles.length) | 0]
        if (src) spawnSpark(src.x, src.y, 1.5 + rand() * 4, 40 + rand() * 45)
      }
    }

    function frame(now) {
      if (disposed) return
      if (!startedAt) startedAt = now
      const elapsed = now - startedAt
      const dt = last ? Math.min(50, now - last) : 16
      last = now
      // settle back to a resting heartbeat
      beatRate += (1 - beatRate) * 0.010 * (dt / 16)
      beatPhase = (beatPhase + (dt / (1150 / beatRate))) % 1

      // Fade alpha rather than painting over it, so the page background shows through.
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.30)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      const assembling = !reduced && elapsed < ASSEMBLE_MS
      const u = reduced ? 1 : Math.min(1, elapsed / ASSEMBLE_MS)

      if (!assembling && !formed) {
        formed = true
        onFormed?.()
      }

      const beat = reduced ? 0 : beatEnvelope(beatPhase)
      const swell = 1 + 0.062 * beat

      for (const p of particles) {
        const tx = cx + p.hx * scale * swell
        const ty = cy + p.hy * scale * swell

        if (assembling) {
          const e = easeOutCubic(clamp01((u - p.delay) / (1 - p.delay)))
          const r1 = Math.hypot(tx - cx, ty - cy)
          const r = p.r0 + (r1 - p.r0) * e
          const a = p.a1 + p.da * (1 - e)
          p.x = cx + Math.cos(a) * r
          p.y = cy + Math.sin(a) * r
          p.alpha = 0.25 + 0.75 * e
        } else {
          const wx = Math.sin(elapsed * 0.0011 + p.phase) * p.wob
          const wy = Math.cos(elapsed * 0.0009 + p.phase * 1.7) * p.wob
          p.vx += (tx + wx - p.x) * 0.075
          p.vy += (ty + wy - p.y) * 0.075
          p.vx *= 0.855
          p.vy *= 0.855
          p.x += p.vx
          p.y += p.vy
          p.alpha = 1
        }

        const s = p.size * (5.2 + beat * 2.4)
        ctx.globalAlpha = p.alpha * (0.78 + 0.22 * beat)
        ctx.drawImage(sprites[p.ci], p.x - s / 2, p.y - s / 2, s, s)
      }

      // The odd particle drifting free, like heat off the surface.
      if (!assembling && !reduced && rand() < 0.07) {
        const src = particles[(rand() * particles.length) | 0]
        if (src) spawnSpark(src.x, src.y, 0.3 + rand() * 0.7, 70 + rand() * 60)
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.x += s.vx
        s.y += s.vy
        s.vx *= 0.972
        s.vy = s.vy * 0.972 - 0.022
        s.life -= 1
        if (s.life <= 0) { sparks.splice(i, 1); continue }
        const a = s.life / s.max
        const size = s.size * 5.5 * a
        ctx.globalAlpha = a * 0.9
        ctx.drawImage(sprites[s.ci], s.x - size / 2, s.y - size / 2, size, size)
      }

      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }

    layout()
    seed()
    raf = requestAnimationFrame(frame)

    /* Targets live in normalised coordinates, so a resize only needs a new
       scale. Re-seeding is reserved for a genuinely large change, and never
       replays the assembly — on phones the URL bar alone fires this constantly. */
    let resizeTimer = 0
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const before = w * h
        layout()
        const ratio = (w * h) / Math.max(1, before)
        if (ratio > 1.8 || ratio < 0.55) {
          seed()
          startedAt = performance.now() - ASSEMBLE_MS - 1
        }
      }, 150)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    return () => {
      disposed = true
      clearTimeout(resizeTimer)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [onFormed, reduced])

  return <canvas ref={canvasRef} className="heart-canvas" aria-hidden="true" />
})

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const easeOutCubic = (v) => 1 - Math.pow(1 - v, 3)

export default HeartCanvas
