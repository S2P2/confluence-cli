import fs from 'node:fs'
import path from 'node:path'
import { sanitizeFilename } from './sanitize'

export function uniquePathFor(dir: string, filename: string): string {
  const safeFilename = sanitizeFilename(filename)
  const parsed = path.parse(safeFilename)
  let attempt = path.join(dir, safeFilename)
  let counter = 1
  while (fs.existsSync(attempt)) {
    const suffix = ` (${counter})`
    const nextName = `${parsed.name}${suffix}${parsed.ext}`
    attempt = path.join(dir, nextName)
    counter += 1
  }
  return attempt
}
