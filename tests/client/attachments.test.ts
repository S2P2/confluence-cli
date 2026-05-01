import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { DefaultAttachmentsClient } from '../../src/client/attachments'
import type { PaginatedResponse, RawAttachmentResponse } from '../../src/client/types'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// Minimal mock HttpClient matching the interface used by DefaultAttachmentsClient
class MockHttpClient {
  private getHandler: ((url: string, params?: Record<string, unknown>) => Promise<unknown>) | null = null
  public siteUrl: string | undefined

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

  isCloud(): boolean {
    return true
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

// Raw attachment fixture — simulates a real Confluence API response
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

// Helper to capture the axios.get URL by monkey-patching
async function withCapturedDownload<T>(
  fn: (captured: { url: string }) => Promise<T>,
): Promise<{ result: T; url: string }> {
  const captured = { url: '' }
  const { Readable } = await import('node:stream')
  const axiosMod = await import('axios')
  const origGet = axiosMod.default.get
  axiosMod.default.get = async (url: string) => {
    captured.url = url
    return { data: Readable.from([Buffer.from('mock content')]), status: 200 }
  }
  try {
    const result = await fn(captured)
    return { result, url: captured.url }
  } finally {
    axiosMod.default.get = origGet
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
      mockHttp.setListResponse({ results: [raw], start: 0, limit: 25, size: 1 })

      const { url } = await withCapturedDownload(async () => {
        await client.download('2916353', 'att-42', path.join(tempDir, 'test-file.txt'))
      })

      expect(url).toContain('/download/attachments/2916353/test-file.txt')
      expect(url).toContain('https://test.atlassian.net')
    })

    test('resolves attachment by title and attempts download', async () => {
      const raw = makeRawAttachment()
      mockHttp.setListResponse({ results: [raw], start: 0, limit: 25, size: 1 })

      const { url } = await withCapturedDownload(async () => {
        await client.download('2916353', 'test-file.txt', path.join(tempDir, 'test-file.txt'))
      })

      expect(url).toContain('/download/attachments/2916353/test-file.txt')
    })

    test('throws when relative URL path is passed instead of ID or title', async () => {
      const raw = makeRawAttachment()
      mockHttp.setListResponse({ results: [raw], start: 0, limit: 25, size: 1 })

      const relativeUrl =
        '/download/attachments/2916353/test-file.txt?version=1&modificationDate=1777598987633&cacheVersion=1&api=v2'

      await expect(client.download('2916353', relativeUrl, path.join(tempDir, 'out.txt'))).rejects.toThrow(
        /Attachment ".*" not found on page 2916353/,
      )
    })

    test('throws when attachment ID does not exist', async () => {
      mockHttp.setListResponse({ results: [], start: 0, limit: 25, size: 0 })

      await expect(
        client.download('2916353', 'nonexistent-id', path.join(tempDir, 'out.txt')),
      ).rejects.toThrow(/Attachment "nonexistent-id" not found on page 2916353/)
    })

    test('uses site URL when _links.base is missing (gateway mode)', async () => {
      // Simulates api.atlassian.com gateway response where _links.base is undefined
      const raw: RawAttachmentResponse = {
        id: 'att-42',
        title: 'gateway-file.txt',
        version: { number: 1 },
        extensions: {
          mediaType: 'text/plain',
          fileSize: 100,
        },
        _links: {
          download: '/download/attachments/426070/gateway-file.txt?version=1&api=v2',
          // No base! This is what api.atlassian.com gateway returns
        },
      }

      mockHttp.setListResponse({ results: [raw], start: 0, limit: 25, size: 1 })
      mockHttp.siteUrl = 'https://jos2p2.atlassian.net'

      const { url } = await withCapturedDownload(async () => {
        await client.download('426070', 'att-42', path.join(tempDir, 'gateway-file.txt'))
      })

      // The download URL must go to the site domain with /wiki prefix for Cloud, NOT api.atlassian.com
      expect(url).toContain('https://jos2p2.atlassian.net/wiki/download/attachments/426070/gateway-file.txt')
      expect(url).not.toContain('api.atlassian.com')
    })
  })
})
