// Node module-resolution hook for scripts/ai-eval.mjs: resolves the "@/" alias and the
// extensionless relative imports used by the Next.js source. Not used by the app itself.
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))
const SRC_ROOT = `${REPO_ROOT}src/`
const isFile = (path) => existsSync(path) && statSync(path).isFile()

export async function resolve(specifier, context, nextResolve) {
  let base = null
  if (specifier.startsWith('@/')) {
    base = SRC_ROOT + specifier.slice(2)
  } else if (specifier.startsWith('.') && context.parentURL?.startsWith(pathToFileURL(SRC_ROOT).href)) {
    base = fileURLToPath(new URL(specifier, context.parentURL))
  }
  if (base) {
    for (const suffix of ['', '.js', '.ts', '/index.js']) {
      if (isFile(base + suffix)) return nextResolve(pathToFileURL(base + suffix).href, context)
    }
  }
  return nextResolve(specifier, context)
}
