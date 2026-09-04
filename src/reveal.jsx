import React, { useCallback, useEffect, useRef, useState } from 'react'
import HeartCanvas from './heartCanvas.jsx'
import Backdrop, { hasPhotos, PHOTO_COUNT } from './backdrop.jsx'
import Celebration from './celebration.jsx'
import { chime, thump, isMuted, setMuted } from './audio.js'

/* Change this one line if the start date is different. Months are 0-indexed. */
export const TOGETHER_SINCE = new Date(2025, 8, 5, 0, 0, 0)
/* The span this page measures: the first year. */
const YEAR_ENDS = new Date(2026, 8, 5, 0, 0, 0)
const MONTHS = 12

const fmt = (d) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

function useElapsed(from) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const ms = Math.max(0, now - from.getTime())
  const s = Math.floor(ms / 1000)
  return {
    now,
    days: Math.floor(s / 86400),
    hours: Math.floor(s / 3600) % 24,
    minutes: Math.floor(s / 60) % 60,
    seconds: s % 60,
  }
}

const pad = (n) => String(n).padStart(2, '0')

export default function Reveal({ reduced }) {
  const heartRef = useRef(null)
  const partyRef = useRef(null)
  const backdropRef = useRef(null)
  const [found, setFound] = useState(0)
  const [quiet, setQuiet] = useState(isMuted())
  const elapsed = useElapsed(TOGETHER_SINCE)

  const total = hasPhotos ? PHOTO_COUNT : 0
  const done = hasPhotos && found >= total
  const hint = !hasPhotos
    ? '↑ touch the heart ↑'
    : found === 0
      ? '↑ touch the heart ↑'
      : done
        ? 'that is all of them ❤️'
        : `again — ${found} of ${total}`

  const onFormed = useCallback(() => {
    chime()
    partyRef.current?.burst()
  }, [])

  const touch = () => {
    heartRef.current?.pulse()
    heartRef.current?.excite()
    partyRef.current?.burst(16)
    thump()
    backdropRef.current?.revealNext()
  }

  const toggleSound = () => {
    const next = !quiet
    setQuiet(next)
    setMuted(next)
    if (!next) chime() // turning it back on should be audible straight away
  }

  return (
    <section className="reveal">
      <Backdrop ref={backdropRef} onReveal={setFound} />
      {hasPhotos && <div className="veil" aria-hidden="true" />}
      <div className="sky" aria-hidden="true" />
      <div className="glow" aria-hidden="true" />

      <Celebration ref={partyRef} reduced={reduced} />

      <button className="sound" onClick={toggleSound} aria-pressed={quiet}>
        {quiet ? 'sound off' : 'sound on'}
      </button>

      <div className="stage">
        <button className="heart-stage fade" style={{ animationDelay: '0.1s' }} onClick={touch}
                aria-label="Touch the heart">
          <HeartCanvas ref={heartRef} onFormed={onFormed} reduced={reduced} />
        </button>

        <p className={`hint fade ${done ? 'gone' : ''}`} style={{ animationDelay: '3.4s' }}>
          <span>{hint}</span>
        </p>

        <h1 className="fade" style={{ animationDelay: '2.7s' }}>
          Happy Anniversary,<br /><span>Hayati ❤️</span>
        </h1>

        <p className="names fade" style={{ animationDelay: '3.2s' }}>Faizan &nbsp;+&nbsp; Unsab</p>

        <YearSpan elapsed={elapsed} />

        <div className="letter">
          {[
            'You are the best thing the world has ever given me.',
            'I longed for you for years, and when I finally found you, you were exactly what I had prayed for — and somehow, even more.',
            'Now that I have you, after all those years of yearning, I promise I will always remember to cherish you. I never want to take a single moment with you for granted.',
            'I promise to take care of you, to pour all my love into you, and to keep choosing you — in the big moments, the ordinary ones, and every little moment in between.',
          ].map((text, i) => (
            <p key={i} className="fade" style={{ animationDelay: `${4.4 + i * 0.55}s` }}>{text}</p>
          ))}
          <p className="closer fade" style={{ animationDelay: '6.8s' }}>
            Of all the things I've ever built, <em>us</em> will always be my favourite.
          </p>
        </div>

      </div>
    </section>
  )
}

/* The page exists for one day, so the span is always shown closed. There is no
   countdown state: "4 days to go" is a thing only its author would ever see. */
function YearSpan({ elapsed }) {
  return (
    <section className="year fade" style={{ animationDelay: '3.6s' }} aria-label="One year together">
      <div className="year-dates">
        <span>{fmt(TOGETHER_SINCE)}</span>
        <span>{fmt(YEAR_ENDS)}</span>
      </div>

      <div className="year-rule">
        <i className="year-line" />
        <i className="year-fill" style={{ width: '100%' }} />
        {Array.from({ length: MONTHS + 1 }, (_, i) => (
          <i
            key={i}
            className={`year-tick ${i === 0 || i === MONTHS ? 'end' : ''}`}
            style={{ left: `${(i / MONTHS) * 100}%` }}
          />
        ))}
        <i className="year-now done" style={{ left: '100%' }} />
      </div>

      <p className="year-label done">one year</p>
      <p className="year-vow">down, and forever to go</p>
      <p className="year-clock">
        {elapsed.days} days · {pad(elapsed.hours)}:{pad(elapsed.minutes)}:{pad(elapsed.seconds)}
      </p>
    </section>
  )
}

