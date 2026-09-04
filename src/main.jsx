import React, { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Terminal from './terminal.jsx'
import Reveal from './reveal.jsx'
import { unlock } from './audio.js'
import './styles.css'

/* Dev affordance only — a deployed build never matches this. */
const LOCAL = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname)

function App() {
  const [scene, setScene] = useState(
    () => (LOCAL && new URLSearchParams(window.location.search).has('reveal') ? 'reveal' : 'terminal')
  )
  const [runId, setRunId] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const finish = useCallback(() => {
    setLeaving(true)
    setTimeout(() => setScene('reveal'), reduced ? 0 : 900)
  }, [reduced])

  const jumpToReveal = () => {
    unlock() // this click is the gesture that lets the reveal's chime play
    setLeaving(false)
    setScene('reveal')
  }
  const replayTerminal = () => {
    setLeaving(false)
    setRunId(n => n + 1)
    setScene('terminal')
  }

  return (
    <>
      <main className={leaving && scene === 'terminal' ? 'dissolving' : ''}>
        {scene === 'terminal'
          ? <Terminal key={runId} onFinish={finish} reduced={reduced} />
          : <Reveal key={runId} reduced={reduced} />}
      </main>

      {LOCAL && (
        <div className="devbar">
          <span className="devbar-tag">dev</span>
          {scene === 'terminal'
            ? <button onClick={jumpToReveal}>skip to the heart →</button>
            : <button onClick={replayTerminal}>↺ replay terminal</button>}
        </div>
      )}
    </>
  )
}

const container = document.getElementById('root')
/* Reuse the root across hot reloads instead of creating a second one. */
const root = (container.__root ||= createRoot(container))
root.render(<App />)
