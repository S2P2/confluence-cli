/**
 * Parse the `start` query parameter from a Confluence pagination "next" link.
 * Returns undefined if no next link or no start parameter found.
 */
export function parseNextStart(links: { next?: string } | undefined): number | undefined {
  if (!links?.next) return undefined
  const url = typeof links.next === 'string' ? links.next : ''
  const match = url.match(/[?&]start=(\d+)/)
  return match?.[1] ? Number(match[1]) : undefined
}

/**
 * Validate and parse pagination limit/start options from CLI string inputs.
 * Throws descriptive errors for invalid values.
 */
export function parsePaginationOptions(options: { limit?: string; start?: string }): {
  limit: number | undefined
  start: number
} {
  const limit = options.limit ? Number.parseInt(options.limit, 10) : undefined
  if (options.limit && (Number.isNaN(limit) || limit! <= 0)) {
    throw new Error('Limit must be a positive number.')
  }

  const start = options.start ? Number.parseInt(options.start, 10) : 0
  if (options.start && (Number.isNaN(start) || start < 0)) {
    throw new Error('Start must be a non-negative number.')
  }

  return { limit, start }
}
