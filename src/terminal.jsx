import React, { useCallback, useEffect, useRef, useState } from 'react'
import { unlock } from './audio.js'

const PROMPT = 'faizan@us:~$'
const wait = (ms) => new Promise(r => setTimeout(r, ms))
const clean = (s) => s.replace(/[<>]/g, '').slice(0, 48)

/* Slow enough to actually read. The bar has a 2x control for the impatient. */
const CHAR_MS = 30
const LINE_MS = 430

/* The source shown on screen, and the loop that actually draws the heart.
   These two must stay in step — the whole point is that she is watching the
   real thing run, not a picture of it. */
const HEART_SRC = [
  'for (let y = 1.2; y > -1; y -= 0.16) {',
  "  let row = ''",
  '  for (let x = -1.4; x <= 1.4; x += 0.1) {',
  '    const p = x * x + y * y - 1',
  "    row += p * p * p - x * x * y * y * y <= 0 ? '♥' : ' '",
  '  }',
  '  print(row)',
  '}',
]

function heartRows() {
  const out = []
  for (let y = 1.2; y > -1; y -= 0.16) {
    let row = ''
    for (let x = -1.4; x <= 1.4; x += 0.1) {
      const p = x * x + y * y - 1
      row += p * p * p - x * x * y * y * y <= 0 ? '♥' : ' '
    }
    out.push(row.replace(/\s+$/, ''))
  }
  return out
}

export default function Terminal({ onFinish, reduced }) {
  const [lines, setLines] = useState([])
  const [typing, setTyping] = useState(null)
  const [input, setInput] = useState('')
  const [awaiting, setAwaiting] = useState(null) // null | 'text' | 'enter'
  const [rate, setRate] = useState(1)

  const resolverRef = useRef(null)
  const rateRef = useRef(1)
  const skipRef = useRef(false)
  const rootRef = useRef(null)
  const bodyRef = useRef(null)
  const inputRef = useRef(null)
  const startedRef = useRef(false)

  const scroll = useCallback(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  useEffect(scroll, [lines, typing, awaiting, scroll])
  useEffect(() => { if (awaiting) inputRef.current?.focus() }, [awaiting])

  /* Keep the prompt above the on-screen keyboard on phones. */
  useEffect(() => {
    const vv = window.visualViewport
    const el = rootRef.current
    if (!vv || !el) return
    const sync = () => {
      el.style.setProperty('--vh', `${vv.height}px`)
      scroll()
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [scroll])

  const bumpRate = () => {
    const next = rateRef.current === 1 ? 2 : 1
    rateRef.current = next
    setRate(next)
  }
  const skipAll = () => { skipRef.current = true }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    let alive = true

    const push = (cls, text = '') => setLines(l => [...l, { cls, text }])
    const setTail = (text, cls) =>
      setLines(l => {
        if (!l.length) return l
        const next = l.slice()
        next[next.length - 1] = { ...next[next.length - 1], tail: text, tailCls: cls }
        return next
      })
    const replaceLast = (cls, text) =>
      setLines(l => (l.length ? [...l.slice(0, -1), { cls, text }] : [{ cls, text }]))

    const fast = () => skipRef.current || reduced
    const beat = (ms) => wait(fast() ? 0 : ms / rateRef.current)

    const line = async (text, cls = 'out', { speed = CHAR_MS, pause = LINE_MS } = {}) => {
      if (!alive) return
      if (!text) { push(cls, ''); await beat(180); return }
      if (fast()) { push(cls, text); await wait(26); return }
      for (let i = 1; i <= text.length; i++) {
        if (!alive || skipRef.current) break
        setTyping({ cls, text: text.slice(0, i) })
        const ch = text[i - 1]
        const extra = ch === ' ' ? 14 : /[.,;:—…?!]/.test(ch) ? 90 : 0
        await wait((speed + extra) / rateRef.current)
      }
      setTyping(null)
      push(cls, text)
      await beat(pause)
    }

    const blank = () => line('', 'out')

    const status = async (label, result, ok = true) => {
      const dots = '.'.repeat(Math.max(3, 32 - label.length))
      await line(`${label} ${dots}`, 'dim', { speed: 13, pause: 90 })
      await beat(420 + Math.random() * 320)
      setTail(`  ${result}`, ok ? 'good' : 'warn')
      await beat(360)
    }

    const bar = async (values) => {
      push('bar', '')
      for (const pct of values) {
        await beat(520 + Math.random() * 300)
        const filled = Math.round(pct / 5)
        replaceLast('bar', `[${'█'.repeat(filled)}${'·'.repeat(20 - filled)}] ${String(pct).padStart(3)}%`)
      }
    }

    const listen = async (kind) => {
      setAwaiting(kind)
      const raw = await new Promise(res => { resolverRef.current = res })
      setAwaiting(null)
      return raw
    }

    const ask = async (question) => {
      if (question) await line(question, 'ask', { pause: 120 })
      for (;;) {
        if (!alive) return ''
        const raw = await listen('text')
        const cmd = raw.trim().toLowerCase()
        if (cmd === 'help') {
          await line('available: help · whoami · ls · date · slow · fast · clear', 'dim')
          await line('everything else: just answer honestly.', 'dim')
          continue
        }
        if (cmd === 'whoami') { await line('the reason. (also: unsab)', 'good'); continue }
        if (cmd === 'ls') { await line('us/   memories/   3000_potatoes/   forever.lock', 'good'); continue }
        if (cmd === 'date') { await line('05 September — the only date this machine knows.', 'good'); continue }
        if (cmd === 'sudo love') { await line('permission granted. it always was.', 'good'); continue }
        if (cmd === 'fast') { rateRef.current = 2; setRate(2); await line('ok — double speed.', 'dim'); continue }
        if (cmd === 'slow') { rateRef.current = 1; setRate(1); await line('ok — taking my time.', 'dim'); continue }
        if (cmd === 'skip') { skipAll(); await line('fine, fine — skipping ahead.', 'dim'); continue }
        if (cmd === 'clear') { setLines([]); continue }
        return raw
      }
    }

    const YES = /^(y|yes|yeah|yep|yup|sure|ok|okay|please|ofc|obviously|duh|always)\b/
    const NO = /^(n|no|nope|nah|never|not really)\b/

    const confirm = async (question) => {
      let a = await ask(`${question}   [Y/n]`)
      for (;;) {
        if (!alive) return false
        const v = a.trim().toLowerCase()
        if (YES.test(v)) return true
        if (NO.test(v)) return false
        await line('y or n. i will wait. ❤️', 'dim', { pause: 120 })
        a = await ask('')
      }
    }

    /* A held beat the reader controls, so nothing important scrolls past. */
    const pressEnter = async (label) => {
      if (fast()) return
      push('hold', label)
      await listen('enter')
      setLines(l => l.filter(x => x.cls !== 'hold'))
    }

    ;(async () => {
      await line('ANNIVERSARY_OS  v2.0  ·  build 0509', 'sys', { speed: 46, pause: 620 })
      await line('(c) 2025 — forever.  all rights reserved to you.', 'dim', { speed: 15 })
      await blank()
      await status('loading memories', 'ok')
      await status('mounting /dev/heart', 'ok')
      await status('counting butterflies', '3000')
      await status('searching for someone better', 'none found', false)
      await blank()
      await line('1 process still running:', 'dim')
      await line('  us   [pid 1]   uptime 1 year   status: happy', 'good', { pause: 900 })
      await blank()
      await line('type START to continue.', 'ask', { pause: 120 })

      let go = await ask('')
      while (alive && !go.trim().toLowerCase().startsWith('start')) {
        await line(`command not found: ${clean(go.trim()) || '∅'}`, 'err')
        await line("hint: it's START. i believe in you. ❤️", 'dim', { pause: 120 })
        go = await ask('')
      }
      if (!alive) return

      await line('starting anniversary protocol...', 'dim', { pause: 700 })
      await blank()

      const name = await ask('who is the person that makes you happiest?')
      const meansHim = /faiz/i.test(name) || /\b(you|u|yourself|urself)\b/i.test(name)
      if (meansHim) {
        await line('authenticating…  ✔ access granted.', 'good')
        await line('i was very much hoping you would say that.', 'dim', { pause: 900 })
      } else {
        await line(`'${clean(name)}' is not in my records.`, 'err')
        await line("i'll allow it. the compiler was just really hoping for: Faizan 😌", 'dim', { pause: 900 })
      }
      await blank()

      const potatoes = await ask('how many potatoes do you have for me?')
      if (potatoes.replace(/\D/g, '') === '3000') {
        await line('3000 potatoes verified. 🥔 an entirely reasonable amount.', 'good', { pause: 900 })
      } else {
        await line('close. my records say exactly 3000. 🥔', 'err')
        await line('i counted twice.', 'dim', { pause: 900 })
      }
      await blank()

      const scale = await ask('on a scale of 1 to 10 — how much do you love me?')
      await line(`recorded: ${clean(scale) || '—'}`, 'dim')
      await line('mine overflowed the integer. storing as Infinity.', 'good', { pause: 1100 })
      await blank()

      await line('there is one more thing.', 'out', { speed: 36, pause: 900 })
      await line('i have been coding a heart for you.', 'out', { speed: 38, pause: 1200 })
      await blank()

      if (await confirm('do you wanna see it?')) {
        await line('good. give me a second.', 'dim', { pause: 800 })
      } else {
        await line('wrong answer. i am showing you anyway. ❤️', 'dim', { pause: 1000 })
      }
      await blank()

      await line('// heart.js', 'comment', { speed: 24, pause: 450 })
      for (const src of HEART_SRC) await line(src, 'code', { speed: 19, pause: 230 })
      await blank()

      await pressEnter('[ press enter to run it ]')

      await line(`${PROMPT} node heart.js`, 'echo', { speed: 26, pause: 800 })
      for (const row of heartRows()) {
        push('heart-row', row)
        await beat(150)
      }
      await beat(1600)
      await blank()
      await line('14 rows. 26 columns. one loop.', 'dim', { pause: 800 })
      await line('(that loop terminates. mine does not.)', 'dim', { speed: 36, pause: 1400 })
      await blank()

      if (await confirm('is that beautiful enough for you?')) {
        await line('it is. but it is not enough — not for you.', 'err', { pause: 1200 })
      } else {
        await line('exactly. you deserve more than 26 columns of text.', 'good', { pause: 1200 })
      }
      await blank()

      await line('so let me build you a better one.', 'out', { speed: 38, pause: 1100 })
      await blank()
      await line(`${PROMPT} gcc heart.c -o us -O∞`, 'echo', { speed: 26, pause: 600 })
      await line('compiling…', 'dim', { pause: 500 })
      await bar([8, 26, 49, 78])
      await line('warning: heart size exceeds MAX_HEART. raising the limit.', 'warn', { speed: 22, pause: 900 })
      await bar([84, 93, 100])
      await line('✔ compiled successfully in 365 days.', 'good', { pause: 1300 })
      await blank()
      await line('switching to the advanced renderer…', 'dim', { speed: 52, pause: 1600 })
      if (alive) onFinish()
    })()

    return () => { alive = false }
  }, [onFinish, reduced])

  const submit = (e) => {
    e.preventDefault()
    unlock() // genuine user gesture — warm the audio context up for the reveal
    const resolve = resolverRef.current
    if (!resolve) return
    const value = input.trim()
    if (awaiting === 'text' && !value) return
    setInput('')
    if (awaiting === 'text') setLines(l => [...l, { cls: 'echo', text: `${PROMPT} ${value}` }])
    resolverRef.current = null
    resolve(value)
  }

  return (
    <section className="terminal" ref={rootRef} onClick={() => awaiting && inputRef.current?.focus()}>
      <header className="term-bar">
        <span className="dot red" /><span className="dot amber" /><span className="dot green" />
        <span className="term-title">faizan@us — ~/anniversary</span>
        <span className="term-tools">
          <button type="button" className="pill" aria-label="Playback speed"
                  onClick={(e) => { e.stopPropagation(); bumpRate() }}>
            {rate}×
          </button>
        </span>
      </header>

      <div className="term-body" ref={bodyRef}>
        {lines.map((l, i) => (
          <pre key={i} className={`ln ${l.cls}`}>
            {l.text || ' '}
            {l.tail && <span className={l.tailCls}>{l.tail}</span>}
          </pre>
        ))}
        {typing && <pre className={`ln ${typing.cls}`}>{typing.text}<i className="caret" /></pre>}

        <form className={`term-input ${awaiting ? '' : 'idle'}`} onSubmit={submit}>
          <span className="ps1">{PROMPT}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={!awaiting}
            enterKeyHint="send"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            aria-label="Terminal input"
          />
          {awaiting && !input && <i className="caret" />}
        </form>
      </div>
    </section>
  )
}
