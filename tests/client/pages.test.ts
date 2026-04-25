import { describe, expect, test, beforeEach } from 'bun:test'
import { DefaultPagesClient } from '../../src/client/pages'
import type { PagesClient } from '../../src/client/pages'
import type { HttpClient } from '../../src/client/http'
import type { PageInfo, ChildPage } from '../../src/client/types'

// Mock HttpClient
class MockHttpClient {
  private mockGetResponse: any
  private mockPostResponse: any
  private mockPutResponse: any
  private mockDeleteResponse: any

  constructor() {
    this.mockGetResponse = {}
    this.mockPostResponse = {}
    this.mockPutResponse = {}
    this.mockDeleteResponse = {}
  }

  setGetResponse(response: any) {
    this.mockGetResponse = response
  }

  setPostResponse(response: any) {
    this.mockPostResponse = response
  }

  setPutResponse(response: any) {
    this.mockPutResponse = response
  }

  setDeleteResponse(response: any) {
    this.mockDeleteResponse = response
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    // Simulate different responses based on URL
    if (url === '/content/123' || url === '/content/456' || url === '/content/789' || url === '/content/999') {
      return this.mockGetResponse as T
    } else if (url.includes('/child/page')) {
      return this.mockGetResponse as T
    } else if (url === '/content') {
      return this.mockGetResponse as T
    }
    throw new Error(`Unexpected GET request to ${url}`)
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    return this.mockPostResponse as T
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    return this.mockPutResponse as T
  }

  async delete<T>(url: string): Promise<T> {
    return this.mockDeleteResponse as T
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    return this.mockPutResponse as T
  }

  extractPageId(input: string): string {
    return input.replace(/[^\d]/g, '') || '123'
  }
}

describe('PagesClient', () => {
  let pagesClient: PagesClient
  let mockHttpClient: MockHttpClient

  beforeEach(() => {
    mockHttpClient = new MockHttpClient()
    pagesClient = new DefaultPagesClient(mockHttpClient as any)
  })

  describe('normalizePage', () => {
    test('should normalize page with full data', () => {
      const mockData = {
        id: '123',
        title: 'Test Page',
        type: 'page' as const,
        status: 'current',
        space: { key: 'TEST', name: 'Test Space', id: '456' },
        version: { number: 5, by: { displayName: 'John Doe' }, when: '2023-01-01' },
        ancestors: [{ id: '999', title: 'Parent Page' }],
        _links: { webui: 'https://test.atlassian.net/wiki/display/TEST/Test+Page' }
      }

      const result = pagesClient.normalizePage(mockData)

      expect(result).toEqual({
        id: '123',
        title: 'Test Page',
        type: 'page',
        status: 'current',
        space: { key: 'TEST', name: 'Test Space', id: '456' },
        version: { number: 5, by: { displayName: 'John Doe' }, when: '2023-01-01' },
        ancestors: [{ id: '999', title: 'Parent Page' }],
        _links: { webui: 'https://test.atlassian.net/wiki/display/TEST/Test+Page' }
      })
    })

    test('should normalize page with missing version (defaults to 1)', () => {
      const mockData = {
        id: '456',
        title: 'Page Without Version',
        type: 'page' as const,
        status: 'current',
        space: { key: 'TEST', name: 'Test Space' }
      }

      const result = pagesClient.normalizePage(mockData)

      expect(result).toEqual({
        id: '456',
        title: 'Page Without Version',
        type: 'page',
        status: 'current',
        space: { key: 'TEST', name: 'Test Space', id: undefined },
        version: { number: 1 },
        ancestors: undefined,
        _links: undefined
      })
    })

    test('should normalize page with missing space info', () => {
      const mockData = {
        id: '789',
        title: 'Page Without Space',
        type: 'page' as const,
        status: 'current'
      }

      const result = pagesClient.normalizePage(mockData)

      expect(result).toEqual({
        id: '789',
        title: 'Page Without Space',
        type: 'page',
        status: 'current',
        space: { key: '', name: '', id: undefined },
        version: { number: 1 },
        ancestors: undefined,
        _links: undefined
      })
    })
  })

  describe('getPageInfo', () => {
    test('should get page information', async () => {
      const mockData = {
        id: '123',
        title: 'Test Page',
        type: 'page' as const,
        status: 'current',
        space: { key: 'TEST', name: 'Test Space' }
      }

      mockHttpClient.setGetResponse(mockData)

      const result = await pagesClient.getPageInfo('123')

      expect(result).toEqual({
        id: '123',
        title: 'Test Page',
        type: 'page',
        status: 'current',
        space: { key: 'TEST', name: 'Test Space', id: undefined },
        version: { number: 1 },
        ancestors: undefined,
        _links: undefined
      })
    })

    test('should extract page ID from URL', async () => {
      const mockData = {
        id: '456',
        title: 'URL Page',
        type: 'page' as const,
        status: 'current',
        space: { key: 'TEST', name: 'Test Space' }
      }

      mockHttpClient.setGetResponse(mockData)

      const result = await pagesClient.getPageInfo('https://example.com/pages/456')

      expect(result).toEqual({
        id: '456',
        title: 'URL Page',
        type: 'page',
        status: 'current',
        space: { key: 'TEST', name: 'Test Space', id: undefined },
        version: { number: 1 },
        ancestors: undefined,
        _links: undefined
      })
    })
  })

  describe('createPage', () => {
    test('should create page without parent', async () => {
      const mockResponse = {
        id: '123',
        title: 'New Page',
        status: 'current',
        version: { number: 1 },
        space: { key: 'TEST', name: 'Test Space' }
      }

      mockHttpClient.setPostResponse(mockResponse)

      const result = await pagesClient.createPage(
        'New Page',
        'TEST',
        'Page content',
        undefined,
        'storage'
      )

      expect(result).toEqual(mockResponse)

      // Verify the call was made with correct data
      // (Note: We can't easily spy on the mock, but we can test the result)
    })

    test('should create page with parent', async () => {
      const mockResponse = {
        id: '123',
        title: 'Child Page',
        status: 'current',
        version: { number: 1 },
        space: { key: 'TEST', name: 'Test Space' }
      }

      mockHttpClient.setPostResponse(mockResponse)

      const result = await pagesClient.createChildPage(
        'Child Page',
        'parent-123',
        'Child content',
        'TEST',
        'storage'
      )

      expect(result).toEqual(mockResponse)
    })
  })

  describe('updatePage', () => {
    test('should update page with new title and content', async () => {
      const existingPage = {
        id: '123',
        title: 'Original Title',
        type: 'page' as const,
        status: 'current',
        space: { key: 'TEST', name: 'Test Space' },
        body: {
          storage: { value: 'Original content', representation: 'storage' }
        },
        version: { number: 3 }
      }

      const updateResponse = {
        id: '123',
        title: 'Updated Title',
        status: 'current',
        version: { number: 4 },
        space: { key: 'TEST', name: 'Test Space' }
      }

      mockHttpClient.setGetResponse(existingPage)
      mockHttpClient.setPutResponse(updateResponse)

      const result = await pagesClient.updatePage(
        '123',
        'Updated Title',
        'Updated content',
        'storage'
      )

      expect(result).toEqual(updateResponse)
    })

    test('should update page with only content', async () => {
      const existingPage = {
        id: '123',
        title: 'Same Title',
        type: 'page' as const,
        status: 'current',
        space: { key: 'TEST', name: 'Test Space' },
        body: {
          storage: { value: 'Original content', representation: 'storage' }
        },
        version: { number: 3 }
      }

      const updateResponse = {
        id: '123',
        title: 'Same Title',
        status: 'current',
        version: { number: 4 },
        space: { key: 'TEST', name: 'Test Space' }
      }

      mockHttpClient.setGetResponse(existingPage)
      mockHttpClient.setPutResponse(updateResponse)

      const result = await pagesClient.updatePage('123', undefined, 'Updated content', 'storage')

      expect(result).toEqual(updateResponse)
    })
  })

  describe('getChildPages', () => {
    test('should get child pages', async () => {
      const mockResponse = {
        results: [
          {
            id: '456',
            title: 'Child Page 1',
            type: 'page' as const,
            status: 'current',
            space: { key: 'TEST' }
          },
          {
            id: '789',
            title: 'Child Page 2',
            type: 'page' as const,
            status: 'current',
            space: { key: 'TEST' }
          }
        ],
        start: 0,
        limit: 500,
        size: 2
      }

      mockHttpClient.setGetResponse(mockResponse)

      const result = await pagesClient.getChildPages('123', 500)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: '456',
        title: 'Child Page 1',
        type: 'page',
        status: 'current',
        space: { key: 'TEST' },
        parentId: undefined,
        version: undefined,
        url: undefined,
        depth: undefined,
        ancestors: undefined
      })
      expect(result[1]).toEqual({
        id: '789',
        title: 'Child Page 2',
        type: 'page',
        status: 'current',
        space: { key: 'TEST' },
        parentId: undefined,
        version: undefined,
        url: undefined,
        depth: undefined,
        ancestors: undefined
      })
    })
  })

  describe('findPageByTitle', () => {
    test('should find pages by title', async () => {
      const mockResponse = {
        results: [
          {
            id: '456',
            title: 'Test Page',
            type: 'page' as const,
            status: 'current',
            space: { key: 'TEST', name: 'Test Space' }
          },
          {
            id: '789',
            title: 'Another Test Page',
            type: 'page' as const,
            status: 'current',
            space: { key: 'TEST', name: 'Test Space' }
          }
        ],
        start: 0,
        limit: 50,
        size: 2
      }

      mockHttpClient.setGetResponse(mockResponse)

      const result = await pagesClient.findPageByTitle('Test Page', 'TEST')

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: '456',
        title: 'Test Page',
        type: 'page',
        status: 'current',
        space: { key: 'TEST', name: 'Test Space', id: undefined },
        version: { number: 1 },
        ancestors: undefined,
        _links: undefined
      })
    })

    test('should find pages by title without space filter', async () => {
      const mockResponse = {
        results: [
          {
            id: '456',
            title: 'Test Page',
            type: 'page' as const,
            status: 'current',
            space: { key: 'TEST', name: 'Test Space' }
          }
        ],
        start: 0,
        limit: 50,
        size: 1
      }

      mockHttpClient.setGetResponse(mockResponse)

      const result = await pagesClient.findPageByTitle('Test Page')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: '456',
        title: 'Test Page',
        type: 'page',
        status: 'current',
        space: { key: 'TEST', name: 'Test Space', id: undefined },
        version: { number: 1 },
        ancestors: undefined,
        _links: undefined
      })
    })
  })

  describe('deletePage', () => {
    test('should delete page', async () => {
      mockHttpClient.setDeleteResponse({})

      await expect(pagesClient.deletePage('123')).resolves.toBeUndefined()
    })
  })

  describe('movePage', () => {
    test('should move page to new parent', async () => {
      mockHttpClient.setPutResponse({})

      await expect(pagesClient.movePage('123', '456')).resolves.toBeUndefined()
    })

    test('should move page without new parent', async () => {
      mockHttpClient.setPutResponse({})

      await expect(pagesClient.movePage('123')).resolves.toBeUndefined()
    })
  })
})