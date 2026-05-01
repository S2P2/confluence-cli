import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { DefaultAttachmentsClient } from '../../src/client/attachments'
import type { PaginatedResponse, RawAttachmentResponse } from '../../src/client/types'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// Minimal mock HttpClient matching the interface used by DefaultAttachmentsClient
class MockHttpClient {
  private getHandler: ((url: string, params?: Record<string, unknown>) => Promise<unknown>) | null = null

  /** Set a custom handler for GET requests (for download URL assertion) */
  onGet(handler: (url: string, params?: Record<string, unknown>) => Promise<unknown>) {
    this.getHandler = handler
  }

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

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    if (this.getHandler) return (await this.getHandler(url, params)) as T
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

      // Track the URL that axios.get would be called with by intercepting
      // the second GET (first is the list call, second is the download call)
      let capturedDownloadUrl: string | undefined
      const { Readable } = await import('node:stream')
      mockHttp.onGet(async (url: string) => {
        if (url.includes('/child/attachment')) {
          return mockHttp['listResponse']
        }
        // This is the download call — capture the URL and return a mock stream
        capturedDownloadUrl = url
        return { data: Readable.from([Buffer.from('file content')]), status: 200 }
      })

      // Mock axios at module level to prevent real HTTP
      const axiosMod = await import('axios')
      const origGet = axiosMod.default.get
      axiosMod.default.get = async (url: string) => {
        capturedDownloadUrl = url
        return { data: Readable.from([Buffer.from('file content')]), status: 200 }
      }

      try {
        const destPath = path.join(tempDir, 'test-file.txt')
        await client.download('2916353', 'att-42', destPath)

        // Verify the download URL was the resolved attachment link (not the ID)
        expect(capturedDownloadUrl).toContain('/download/attachments/2916353/test-file.txt')
        expect(fs.existsSync(destPath)).toBe(true)
        expect(fs.readFileSync(destPath, 'utf-8')).toBe('file content')
      } finally {
        axiosMod.default.get = origGet
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

      let capturedDownloadUrl: string | undefined
      const { Readable } = await import('node:stream')
      const axiosMod = await import('axios')
      const origGet = axiosMod.default.get
      axiosMod.default.get = async (url: string) => {
        capturedDownloadUrl = url
        return { data: Readable.from([Buffer.from('title content')]), status: 200 }
      }

      try {
        const destPath = path.join(tempDir, 'test-file.txt')
        await client.download('2916353', 'test-file.txt', destPath)

        expect(capturedDownloadUrl).toContain('/download/attachments/2916353/test-file.txt')
        expect(fs.existsSync(destPath)).toBe(true)
      } finally {
        axiosMod.default.get = origGet
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
