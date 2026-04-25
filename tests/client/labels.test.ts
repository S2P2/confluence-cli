import { describe, expect, it } from 'bun:test'
import { vi } from 'vitest'
import type { ResolvedConfig } from '../../src/config/types'
import { DefaultLabelsClient } from '../../src/client/labels'
import { HttpClient } from '../../src/client/http'

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    domain: 'test.atlassian.net',
    protocol: 'https',
    apiPath: '/wiki/rest/api',
    authType: 'bearer',
    token: 'test-token',
    readOnly: false,
    forceCloud: false,
    linkStyle: 'auto',
    ...overrides,
  }
}

describe('LabelsClient', () => {

  describe('list', () => {
    it('extracts page ID and calls API', async () => {
      const extractPageId = vi.fn().mockReturnValue('12345')
      const get = vi.fn().mockResolvedValue({
        results: [
          { id: 'label1', name: 'bug', prefix: 'global' },
          { id: 'label2', name: 'feature', prefix: 'global' }
        ]
      })
      const mockHttpClient = { extractPageId, get }
      const labelsClient = new DefaultLabelsClient(mockHttpClient as HttpClient)

      const result = await labelsClient.list('12345')

      expect(extractPageId).toHaveBeenCalledWith('12345')
      expect(get).toHaveBeenCalledWith('/content/12345/label')
      expect(result).toEqual([
        { id: 'label1', name: 'bug', prefix: 'global' },
        { id: 'label2', name: 'feature', prefix: 'global' }
      ])
    })

    it('normalizes label responses', async () => {
      const extractPageId = vi.fn().mockReturnValue('12345')
      const get = vi.fn().mockResolvedValue({
        results: [
          { id: 'label1', name: 'bug', prefix: 'global' },
          { id: 'label2', name: 'feature', prefix: 'global' },
          { id: 'label3', name: 'critical', prefix: undefined }
        ]
      })
      const mockHttpClient = { extractPageId, get }
      const labelsClient = new DefaultLabelsClient(mockHttpClient as HttpClient)

      const result = await labelsClient.list('12345')

      expect(result).toEqual([
        { id: 'label1', name: 'bug', prefix: 'global' },
        { id: 'label2', name: 'feature', prefix: 'global' },
        { id: 'label3', name: 'critical', prefix: 'global' }
      ])
    })
  })

  describe('add', () => {
    it('extracts page ID and adds label', async () => {
      const extractPageId = vi.fn().mockReturnValue('12345')
      const post = vi.fn()
      const mockHttpClient = { extractPageId, post }
      const labelsClient = new DefaultLabelsClient(mockHttpClient as HttpClient)

      await labelsClient.add('12345', 'bug')

      expect(extractPageId).toHaveBeenCalledWith('12345')
      expect(post).toHaveBeenCalledWith(
        '/content/12345/label',
        [{ prefix: 'global', name: 'bug' }]
      )
    })
  })

  describe('remove', () => {
    it('extracts page ID and removes label with encoding', async () => {
      const extractPageId = vi.fn().mockReturnValue('12345')
      const delete_ = vi.fn()
      const mockHttpClient = { extractPageId, delete: delete_ }
      const labelsClient = new DefaultLabelsClient(mockHttpClient as HttpClient)

      await labelsClient.remove('12345', 'bug report')

      expect(extractPageId).toHaveBeenCalledWith('12345')
      expect(delete_).toHaveBeenCalledWith(
        '/content/12345/label?name=bug%20report'
      )
    })
  })

  describe('normalizeLabel', () => {
    it('maps raw response to LabelInfo', () => {
      const labelsClient = new DefaultLabelsClient({} as HttpClient)
      const raw = { id: 'label1', name: 'bug', prefix: 'global' }
      const result = labelsClient.normalizeLabel(raw)
      expect(result).toEqual({ id: 'label1', name: 'bug', prefix: 'global' })
    })

    it('defaults prefix to global when not provided', () => {
      const labelsClient = new DefaultLabelsClient({} as HttpClient)
      const raw = { id: 'label1', name: 'bug' }
      const result = labelsClient.normalizeLabel(raw)
      expect(result).toEqual({ id: 'label1', name: 'bug', prefix: 'global' })
    })

    it('keeps empty prefix when provided', () => {
      const labelsClient = new DefaultLabelsClient({} as HttpClient)
      const raw = { id: 'label1', name: 'bug', prefix: '' }
      const result = labelsClient.normalizeLabel(raw)
      expect(result).toEqual({ id: 'label1', name: 'bug', prefix: '' })
    })
  })
})