import { describe, expect, test } from 'bun:test'
import { parseNextStart, parsePaginationOptions } from '../../src/utils/pagination'

describe('pagination utilities', () => {
  describe('parseNextStart', () => {
    test('returns undefined when next link is missing', () => {
      expect(parseNextStart(undefined)).toBeUndefined()
      expect(parseNextStart({})).toBeUndefined()
    })

    test('parses start from a relative next link query string', () => {
      expect(parseNextStart({ next: '/rest/api/content/123/child/comment?limit=25&start=50' })).toBe(50)
    })

    test('parses start when it is the first query parameter', () => {
      expect(parseNextStart({ next: '/rest/api/content/123/property?start=25&limit=25' })).toBe(25)
    })

    test('returns undefined when next link has no start parameter', () => {
      expect(parseNextStart({ next: '/rest/api/content/123/property?limit=25' })).toBeUndefined()
    })
  })

  describe('parsePaginationOptions', () => {
    test('defaults to no limit and a zero start index', () => {
      expect(parsePaginationOptions({})).toEqual({ limit: undefined, start: 0 })
    })

    test('parses positive limit and non-negative start strings', () => {
      expect(parsePaginationOptions({ limit: '10', start: '20' })).toEqual({ limit: 10, start: 20 })
    })

    test('rejects invalid limits', () => {
      expect(() => parsePaginationOptions({ limit: '0' })).toThrow('Limit must be a positive number.')
      expect(() => parsePaginationOptions({ limit: '-1' })).toThrow('Limit must be a positive number.')
      expect(() => parsePaginationOptions({ limit: 'not-a-number' })).toThrow('Limit must be a positive number.')
    })

    test('rejects invalid starts', () => {
      expect(() => parsePaginationOptions({ start: '-1' })).toThrow('Start must be a non-negative number.')
      expect(() => parsePaginationOptions({ start: 'not-a-number' })).toThrow('Start must be a non-negative number.')
    })
  })
})
