import { describe, expect, it } from 'bun:test'
import { BlogClient, type BlogPostInfo } from '../../src/client/blog'
import { HttpClient } from '../../src/client/http'
import type { ResolvedConfig } from '../../src/config/types'

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

describe('BlogClient', () => {
  function createMockHttpClient() {
    const mockHttpClient = {
      baseUrl: 'https://test.atlassian.net/wiki/rest/api',
      get: () => {},
      post: () => {},
      put: () => {},
      delete: () => {},
      isCloud: () => false,
      buildAuthHeaders: () => ({}),
      buildUrl: (path: string) => `https://test.atlassian.net${path}`,
      extractPageId: (id: string) => id,
    }
    return mockHttpClient
  }

  describe('normalizeBlogPost', () => {
    it('correctly maps raw API response', () => {
      const raw = {
        id: '1',
        title: 'Test Blog Post',
        type: 'blogpost' as const,
        status: 'current',
        space: { key: 'TEST', name: 'Test Space' },
        version: { number: 5 },
        _links: { webui: 'https://test.atlassian.net/wiki/display/TEST/Test+Blog+Post' },
      }

      const blogClient = new BlogClient(createMockHttpClient())
      const result = (blogClient as any).normalizeBlogPost(raw)

      expect(result).toEqual({
        id: '1',
        title: 'Test Blog Post',
        type: 'blogpost',
        status: 'current',
        space: { key: 'TEST', name: 'Test Space' },
        version: { number: 5 },
        _links: { webui: 'https://test.atlassian.net/wiki/display/TEST/Test+Blog+Post' },
      })
    })

    it('handles minimal response', () => {
      const raw = {
        id: '1',
        title: 'Minimal Post',
        type: 'blogpost' as const,
        status: 'current',
        space: { key: 'TEST', name: 'Test Space' },
        version: { number: 1 },
      }

      const blogClient = new BlogClient(createMockHttpClient())
      const result = (blogClient as any).normalizeBlogPost(raw)

      expect(result).toEqual({
        id: '1',
        title: 'Minimal Post',
        type: 'blogpost',
        status: 'current',
        space: { key: 'TEST', name: 'Test Space' },
        version: { number: 1 },
      })
    })
  })

  describe('constructor', () => {
    it('accepts HttpClient instance', () => {
      const mockHttpClient = createMockHttpClient()
      const blogClient = new BlogClient(mockHttpClient)
      expect(blogClient).toBeInstanceOf(BlogClient)
    })
  })
})