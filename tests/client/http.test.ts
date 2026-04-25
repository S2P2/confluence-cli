import { describe, expect, it } from 'bun:test'
import type { ResolvedConfig } from '../../src/config/types'
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

describe('HttpClient', () => {
  it('builds correct base URL', () => {
    const client = new HttpClient(makeConfig())
    expect(client.baseUrl).toBe('https://test.atlassian.net/wiki/rest/api')
  })

  it('builds URL with api.atlassian.com gateway', () => {
    const client = new HttpClient(
      makeConfig({
        domain: 'api.atlassian.com',
        apiPath: '/ex/confluence/abc-123/wiki/rest/api',
      }),
    )
    expect(client.baseUrl).toBe('https://api.atlassian.com/ex/confluence/abc-123/wiki/rest/api')
  })

  it('detects cloud instances', () => {
    const cloud = new HttpClient(makeConfig())
    expect(cloud.isCloud()).toBe(true)
  })

  it('detects non-cloud instances', () => {
    const dc = new HttpClient(makeConfig({ domain: 'wiki.example.com' }))
    expect(dc.isCloud()).toBe(false)
  })

  it('detects cloud via forceCloud flag', () => {
    const forced = new HttpClient(makeConfig({ domain: 'wiki.example.com', forceCloud: true }))
    expect(forced.isCloud()).toBe(true)
  })

  it('builds auth headers for bearer', () => {
    const client = new HttpClient(makeConfig({ authType: 'bearer', token: 'tok123' }))
    const headers = client.buildAuthHeaders()
    expect(headers.Authorization).toBe('Bearer tok123')
  })

  it('builds auth headers for basic', () => {
    const client = new HttpClient(makeConfig({ authType: 'basic', email: 'u@e.com', token: 'tok123' }))
    const headers = client.buildAuthHeaders()
    expect(headers.Authorization).toMatch(/^Basic /)
  })

  it('builds auth headers for cookie', () => {
    const client = new HttpClient(makeConfig({ authType: 'cookie', cookie: 'sid=abc123' }))
    const headers = client.buildAuthHeaders()
    expect(headers.Cookie).toBe('sid=abc123')
  })

  it('builds auth headers for mtls without token', () => {
    const client = new HttpClient(makeConfig({ authType: 'mtls', token: undefined }))
    const headers = client.buildAuthHeaders()
    expect(headers.Authorization).toBeUndefined()
  })

  it('builds auth headers for mtls with token', () => {
    const client = new HttpClient(makeConfig({ authType: 'mtls', token: 'mtls-token' }))
    const headers = client.buildAuthHeaders()
    expect(headers.Authorization).toBe('Bearer mtls-token')
  })

  it('extracts page ID from numeric input', () => {
    const client = new HttpClient(makeConfig())
    expect(client.extractPageId('12345')).toBe('12345')
  })

  it('extracts page ID from URL', () => {
    const client = new HttpClient(makeConfig())
    expect(client.extractPageId('https://test.atlassian.net/wiki/spaces/DEV/pages/12345')).toBe('12345')
  })

  it('extracts page ID from query param', () => {
    const client = new HttpClient(makeConfig())
    expect(client.extractPageId('https://test.atlassian.net/pages/viewpage.action?pageId=98765')).toBe('98765')
  })

  it('extracts page ID from whitespace-padded input', () => {
    const client = new HttpClient(makeConfig())
    expect(client.extractPageId('  12345  ')).toBe('12345')
  })

  it('throws for unparseable input', () => {
    const client = new HttpClient(makeConfig())
    expect(() => client.extractPageId('not-a-page')).toThrow()
  })

  it('builds full URL from path', () => {
    const client = new HttpClient(makeConfig())
    expect(client.buildUrl('/wiki/spaces/DEV')).toBe('https://test.atlassian.net/wiki/spaces/DEV')
  })

  it('passes through absolute URLs', () => {
    const client = new HttpClient(makeConfig())
    expect(client.buildUrl('https://other.com/path')).toBe('https://other.com/path')
  })
})
