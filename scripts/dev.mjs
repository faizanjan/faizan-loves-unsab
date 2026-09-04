#!/usr/bin/env node
/*
 * Starts Vite on a Node new enough to run it.
 *
 * Vite 7 needs Node ^20.19 || >=22.12 — it calls crypto.hash(), which older
 * releases do not have, so it dies at startup with a confusing
 * "crypto.hash is not a function". The default node here is 20.11, which meant
 * `npm run dev` failed while `npm run build` worked fine.
 *
 * Rather than pin Vite back a major version, or expect everyone to remember to
 * switch Node first, this finds a suitable interpreter and re-execs into it.
 */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

const satisfies = (v) => {
  const [maj, min] = v.replace(/^v/, '').split('.').map(Number)
  if (maj === 20) return min >= 19
  if (maj === 21) return false          // 21 is EOL and predates crypto.hash
  return maj >= 22
}

const versionOf = (bin) => {
  try {
    return execFileSync(bin, ['-v'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

function findNode() {
  if (satisfies(process.version)) return { bin: process.execPath, v: process.version }

  const candidates = [
    '/opt/homebrew/opt/node/bin/node',
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
  ]

  const nvm = join(homedir(), '.nvm', 'versions', 'node')
  if (existsSync(nvm)) {
    // newest first
    for (const dir of readdirSync(nvm).sort().reverse()) {
      candidates.push(join(nvm, dir, 'bin', 'node'))
    }
  }

  for (const bin of candidates) {
    if (!existsSync(bin)) continue
    const v = versionOf(bin)
    if (v && satisfies(v)) return { bin, v }
  }
  return null
}

const found = findNode()

if (!found) {
  console.error(
    `\nVite needs Node 20.19+ or 22.12+, and no such version was found.\n` +
    `This machine's default is ${process.version}.\n\n` +
    `Install one with either:\n` +
    `  nvm install 22 && nvm use 22\n` +
    `  brew install node\n`
  )
  process.exit(1)
}

if (found.bin !== process.execPath) {
  console.log(`(default node ${process.version} is too old for Vite — using ${found.v})`)
}

const child = spawn(found.bin, [VITE, ...process.argv.slice(2)], { stdio: 'inherit' })
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0))
