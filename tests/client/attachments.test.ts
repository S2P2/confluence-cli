import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { DefaultAttachmentsClient } from '../../src/client/attachments'
import type { PaginatedResponse, RawAttachmentResponse } from '../../src/client/types'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// Minimal mock HttpClient matching the interface used by DefaultAttachmentsClient
class MockHttpClient {
  private listResponse: PaginatedResponse<RawAttachmentResponse> = {
    results: [],
    start: 0,
    limit: 25,
    size: 0,
  }

  setListResponse(response: PaginatedResponse<RawAttachmentResponse>) {
    this.listResponse = response
  }

  extractPageId(input: string): string {
    return input.replace(/[^\d]/g, '') || '123'
  }

  buildUrl(urlPath: string): string {
    if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) return urlPath
    return `https://test.atlassian.net${urlPath}`
  }

  buildAuthHeaders(): Record<string, string> {
    return { Authorization: 'Bearer test-token' }
  }

  async get<T>(url: string, _params?: Record<string, unknown>): Promise<T> {
    return this.listResponse as T
  }

  async post<T>(): Promise<T> {
    return {} as T
  }

  async put<T>(): Promise<T> {
    return {} as T
  }

  async delete<T>(): Promise<T> {
    return {} as T
  }
}

// Raw attachment fixture
function makeRawAttachment(overrides: Partial<RawAttachmentResponse> = {}): RawAttachmentResponse {
  return {
    id: 'att-42',
    title: 'test-file.txt',
    version: { number: 1 },
    extensions: {
      mediaType: 'text/plain',
      fileSize: 1024,
      downloadLink: '',
    },
    _links: {
      download: '/download/attachments/2916353/test-file.txt?version=1&modificationDate=123&cacheVersion=1&api=v2',
      base: 'https://test.atlassian.net',
    },
    ...overrides,
  }
}

describe('DefaultAttachmentsClient', () => {
  let client: DefaultAttachmentsClient
  let mockHttp: MockHttpClient
  let tempDir: string

  beforeEach(() => {
    mockHttp = new MockHttpClient()
    client = new DefaultAttachmentsClient(mockHttp as any)
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'confluence-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('normalizeAttachment', () => {
    test('builds full download URL from relative _links.download + base', () => {
      const raw = makeRawAttachment()
      const result = client.normalizeAttachment(raw)
      expect(result.downloadLink).toBe(
        'https://test.atlassian.net/download/attachments/2916353/test-file.txt?version=1&modificationDate=123&cacheVersion=1&api=v2',
      )
    })

    test('keeps full download URL as-is when already absolute', () => {
      const raw = makeRawAttachment({
        _links: {
          download: 'https://cdn.atlassian.net/some/file.pdf',
          base: 'https://test.atlassian.net',
        },
      })
      const result = client.normalizeAttachment(raw)
      expect(result.downloadLink).toBe('https://cdn.atlassian.net/some/file.pdf')
    })

    test('falls back to extensions.downloadLink when _links.download is missing', () => {
      const raw = makeRawAttachment({
        _links: { base: 'https://test.atlassian.net' },
        extensions: {
          mediaType: 'image/png',
          fileSize: 2048,
          downloadLink: '/download/attachments/999/img.png?version=2',
        },
      })
      const result = client.normalizeAttachment(raw)
      expect(result.downloadLink).toBe('https://test.atlassian.net/download/attachments/999/img.png?version=2')
    })
  })

  describe('download', () => {
    test('resolves attachment by ID and attempts download with resolved URL', async () => {
      const raw = makeRawAttachment()
      mockHttp.setListResponse({
        results: [raw],
        start: 0,
        limit: 25,
        size: 1,
      })

      // The ID resolves successfully, so the error should be a network error
      // (not "Attachment not found") — proving ID resolution works
      try {
        await client.download('2916353', 'att-42', path.join(tempDir, 'out.txt'))
      } catch (err) {
        // Should NOT be the "not found" error — proving ID resolution succeeded
        expect((err as Error).message).not.toContain('not found')
        // Any other error (network, HTTP 403, etc.) means ID was resolved and download was attempted
        expect((err as Error).message).toBeTruthy()
      }
    })

    test('resolves attachment by title and attempts download', async () => {
      const raw = makeRawAttachment()
      mockHttp.setListResponse({
        results: [raw],
        start: 0,
        limit: 25,
        size: 1,
      })

      try {
        await client.download('2916353', 'test-file.txt', path.join(tempDir, 'out.txt'))
      } catch (err) {
        expect((err as Error).message).not.toContain('not found')
      }
    })

    test('throws when relative URL path is passed instead of ID or title', async () => {
      const raw = makeRawAttachment()
      mockHttp.setListResponse({
        results: [raw],
        start: 0,
        limit: 25,
        size: 1,
      })

      // This is exactly what the bug in attachments.ts line 90 does:
      // passes att.downloadLink (relative URL) instead of att.id
      const relativeUrl =
        '/download/attachments/2916353/test-file.txt?version=1&modificationDate=1777598987633&cacheVersion=1&api=v2'

      await expect(client.download('2916353', relativeUrl, path.join(tempDir, 'out.txt'))).rejects.toThrow(
        /Attachment ".*" not found on page 2916353/,
      )
    })

    test('throws when attachment ID does not exist', async () => {
      mockHttp.setListResponse({
        results: [],
        start: 0,
        limit: 25,
        size: 0,
      })

      await expect(
        client.download('2916353', 'nonexistent-id', path.join(tempDir, 'out.txt')),
      ).rejects.toThrow(/Attachment "nonexistent-id" not found on page 2916353/)
    })
  })
})
