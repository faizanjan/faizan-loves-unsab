import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const TAU = Math.PI * 2

/* Champagne and gilt first, rose second — gold is what reads as celebration.
   The page's pinks alone read romantic, which it already was. */
const COLORS = ['#f0c987', '#ffd98a', '#ffe9c2', '#ff8fb8', '#ffd7e6', '#fff6fa']

const Celebration = forwardRef(function Celebration({ reduced }, ref) {
  const canvasRef = useRef(null)
  const api = useRef({ burst: () => {} })
  useImperativeHandle(ref, () => ({ burst: (n) => api.current.burst(n) }), [])

  useEffect(() => {
    if (reduced) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rand = Math.random
    let w = 0, h = 0, raf = 0, dead = false
    let petals = []

    function layout() {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function petal(opts = {}) {
      const burst = opts.burst
      const a = rand() * TAU
      const speed = burst ? 4 + rand() * 9 : 0
      // spawn across a small disc, not a single point, or repeated taps pile
      // into a visible clump that hangs in mid-air
      const spread = burst ? 70 : 0
      return {
        x: burst ? opts.x + (rand() - 0.5) * spread * 2.4 : rand() * w,
        y: burst ? opts.y + (rand() - 0.5) * spread : -30 - rand() * h,
        vx: burst ? Math.cos(a) * speed : 0,
        vy: burst ? Math.sin(a) * speed - 2 : 0,
        sway: 0.4 + rand() * 1.1,
        fall: 0.35 + rand() * 0.75,
        size: 3.5 + rand() * 6,
        rot: rand() * TAU,
        spin: (rand() - 0.5) * 0.07,
        phase: rand() * TAU,
        color: COLORS[(rand() * COLORS.length) | 0],
        alpha: 0.30 + rand() * 0.45,
        life: burst ? 150 + rand() * 130 : Infinity,
        max: burst ? 280 : Infinity,
      }
    }

    function seed() {
      // Sparse on purpose. This falls behind a love letter, not a stadium.
      const n = Math.round(Math.min(80, Math.max(30, (w * h) / 19000)))
      petals = Array.from({ length: n }, () => petal())
    }

    /* The arrival deserves a real shower; a tap is a small flourish. Firing
       sixty every time turns twenty-one taps into a blizzard. */
    api.current.burst = (n = 60) => {
      const cx = w / 2
      const cy = h * 0.32
      for (let i = 0; i < n; i++) petals.push(petal({ burst: true, x: cx, y: cy }))
    }

    function frame(now) {
      if (dead) return
      ctx.clearRect(0, 0, w, h)

      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i]

        if (p.life !== Infinity) {
          p.life -= 1
          if (p.life <= 0) { petals.splice(i, 1); continue }
          p.vy += 0.09              // gravity settles the burst into the fall
          p.vx *= 0.985
          p.vy *= 0.985
          p.x += p.vx
          p.y += p.vy
        }

        p.y += p.fall
        p.x += Math.sin(now * 0.0009 + p.phase) * p.sway
        p.rot += p.spin

        if (p.y > h + 30 && p.life === Infinity) {
          p.y = -30
          p.x = rand() * w
        }

        const fade = p.life === Infinity ? 1 : Math.min(1, p.life / 90)
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = p.alpha * fade
        ctx.fillStyle = p.color
        ctx.beginPath()
        // a petal, not a square: an ellipse that flutters as it spins
        ctx.ellipse(0, 0, p.size, p.size * (0.32 + 0.34 * Math.abs(Math.cos(p.rot))), 0, 0, TAU)
        ctx.fill()
        ctx.restore()
      }

      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }

    layout()
    seed()
    raf = requestAnimationFrame(frame)

    let timer = 0
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { layout(); seed() }, 200)
    }
    window.addEventListener('resize', onResize)
    return () => {
      dead = true
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [reduced])

  if (reduced) return null
  return <canvas ref={canvasRef} className="celebration" aria-hidden="true" />
})

export default Celebration
