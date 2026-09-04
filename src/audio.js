/* Tiny WebAudio helpers. No assets, no autoplay surprises: nothing sounds
   until the visitor has already typed into the terminal. */

let ctx = null
let master = null
let muted = false

export const isMuted = () => muted

export function setMuted(v) {
  muted = v
  if (master) master.gain.value = v ? 0 : 1
}

function ac() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    try { ctx = new Ctor() } catch { return null }
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/* Called from the first real keypress in the terminal. A context created
   outside a user gesture can start suspended, and its currentTime stays frozen
   at 0 — anything scheduled against that clock is silently dropped. Opening it
   early means it is warm and ticking long before the reveal wants to play. */
export function unlock() {
  return ac()
}

function tone({ freq, to = freq, type = 'sine', gain = 0.05, dur = 0.6, at = 0 }) {
  const a = ac()
  if (!a || muted) return
  const t0 = a.currentTime + 0.03 + at // a little lead, so nothing lands in the past
  const osc = a.createOscillator()
  const amp = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  amp.gain.setValueAtTime(0, t0)
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0005, t0 + dur)
  osc.connect(amp).connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

/* Bell for the moment the heart finishes forming. Pitched where phone and
   laptop speakers are actually loudest — a 528Hz sine is inaudible on both. */
export function chime() {
  tone({ freq: 880, gain: 0.10, dur: 1.5 })
  tone({ freq: 1320, gain: 0.055, dur: 1.7, at: 0.09 })
  tone({ freq: 1760, gain: 0.032, dur: 1.9, at: 0.20 })
}

/* Lub-dub. Triangle, not sine: small speakers cannot reproduce the fundamental
   at all, but they render its harmonics, and the ear still hears a thump. */
export function thump() {
  tone({ freq: 170, to: 55, type: 'triangle', gain: 0.45, dur: 0.26 })
  tone({ freq: 150, to: 48, type: 'triangle', gain: 0.30, dur: 0.30, at: 0.19 })
}
