// Deterministic, no-browser checks for theme application (stubbed DOM/storage).
//
//   node scripts/theme-check.mjs
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./ai-eval-loader.mjs', import.meta.url)
const { applyStoredTheme, applyTheme, setTheme } = await import('@/lib/theme.js')

const classes = new Set()
const meta = { content: '', setAttribute(name, value) { this.content = value } }
globalThis.document = {
  documentElement: {
    classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), contains: (name) => classes.has(name) },
    style: {},
  },
  querySelector: (selector) => (selector === 'meta[name="theme-color"]' ? meta : null),
}
let stored = {}
let storageBroken = false
globalThis.localStorage = {
  getItem: (key) => { if (storageBroken) throw new Error('blocked'); return stored[key] ?? null },
  setItem: (key, value) => { if (storageBroken) throw new Error('blocked'); stored[key] = value },
}
let systemDark = false
globalThis.window = { matchMedia: () => ({ matches: systemDark }) }

const root = document.documentElement
const reset = () => { classes.clear(); root.style.colorScheme = ''; stored = {}; storageBroken = false; systemDark = false }
let passed = 0
const check = (name, fn) => { reset(); fn(); passed += 1; console.log(`ok - ${name}`) }

check('applyTheme sets class, color-scheme and theme-color, without persisting', () => {
  applyTheme('dark')
  assert.equal(root.classList.contains('dark'), true)
  assert.equal(root.style.colorScheme, 'dark')
  assert.equal(meta.content, '#111827')
  assert.deepEqual(stored, {})
  applyTheme('light')
  assert.equal(root.classList.contains('dark'), false)
  assert.equal(root.style.colorScheme, 'light')
  assert.equal(meta.content, '#ffffff')
})

check('setTheme still persists the choice', () => {
  setTheme('dark')
  assert.equal(stored.theme, 'dark')
  assert.equal(root.classList.contains('dark'), true)
})

check('applyStoredTheme restores a stored dark theme after the class was stripped', () => {
  stored.theme = 'dark'
  applyStoredTheme()
  assert.equal(root.classList.contains('dark'), true)
  classes.clear() // React clearing <html> attributes
  root.style.colorScheme = ''
  applyStoredTheme()
  assert.equal(root.classList.contains('dark'), true)
  assert.equal(root.style.colorScheme, 'dark')
})

check('a stored light theme wins over a dark system preference', () => {
  stored.theme = 'light'
  systemDark = true
  applyStoredTheme()
  assert.equal(root.classList.contains('dark'), false)
})

check('no (or invalid) stored value falls back to the system preference', () => {
  systemDark = true
  applyStoredTheme()
  assert.equal(root.classList.contains('dark'), true)
  classes.clear(); stored.theme = 'purple'; systemDark = false
  applyStoredTheme()
  assert.equal(root.classList.contains('dark'), false)
})

check('blocked storage does not throw (system preference, setTheme still applies)', () => {
  storageBroken = true
  systemDark = true
  assert.doesNotThrow(() => applyStoredTheme())
  assert.equal(root.classList.contains('dark'), true)
  assert.doesNotThrow(() => setTheme('light'))
  assert.equal(root.classList.contains('dark'), false)
})

console.log(`\n${passed} checks passed`)
