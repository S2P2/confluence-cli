import { markdownToStorage } from '../utils/convert'
import type { HttpClient } from './http'
import type { ContentFormat, PaginatedResponse, RawBlogPostResponse } from './types'

export interface BlogPostInfo {
  id: string
  title: string
  type: 'blogpost'
  status: string
  space: { key: string; name: string }
  version: { number: number }
  _links?: { webui?: string; base?: string }
}

export interface CreateBlogPostRequest {
  title: string
  spaceKey: string
  content: string
  format?: ContentFormat
}

export interface UpdateBlogPostRequest {
  content: string
  format?: ContentFormat
  title?: string
}

export class BlogClient {
  constructor(private readonly httpClient: HttpClient) {}

  async list(spaceKey: string, limit?: number): Promise<BlogPostInfo[]> {
    const params = {
      type: 'blogpost' as const,
      spaceKey,
      expand: 'space,version',
      limit: limit ?? 50,
    }

    const response = await this.httpClient.get<PaginatedResponse<RawBlogPostResponse>>('/content', params)
    return response.results.map((item) => this.normalizeBlogPost(item))
  }

  async get(blogId: string): Promise<BlogPostInfo> {
    const params = {
      expand: 'space,version,body.storage',
    }

    const response = await this.httpClient.get<RawBlogPostResponse>(`/content/${blogId}`, params)
    return this.normalizeBlogPost(response)
  }

  async create(
    title: string,
    spaceKey: string,
    content: string,
    format: ContentFormat = 'storage',
  ): Promise<BlogPostInfo> {
    const data = {
      type: 'blogpost' as const,
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: content,
          representation: format,
        },
      },
    }

    const response = await this.httpClient.post<RawBlogPostResponse>('/content', data)
    return this.normalizeBlogPost(response)
  }

  async update(
    blogId: string,
    content: string,
    format: ContentFormat = 'storage',
    title?: string,
  ): Promise<BlogPostInfo> {
    // Get current post to get version number
    const current = await this.get(blogId)
    const newVersionNumber = current.version.number + 1

    const storageContent = format === 'markdown' ? markdownToStorage(content) : content

    const data: Record<string, unknown> = {
      id: blogId,
      type: 'blogpost',
      title: title ?? current.title,
      version: { number: newVersionNumber },
      body: {
        storage: {
          value: storageContent,
          representation: 'storage',
        },
      },
    }

    const response = await this.httpClient.put<RawBlogPostResponse>(`/content/${blogId}`, data)
    return this.normalizeBlogPost(response)
  }

  async delete(blogId: string): Promise<void> {
    await this.httpClient.delete(`/content/${blogId}`)
  }

  async readBody(
    blogId: string,
    format: 'storage' | 'view' = 'storage',
  ): Promise<{
    storage?: { value: string }
    view?: { value: string }
  }> {
    const expand = format === 'storage' ? 'body.storage' : 'body.view'
    const response = await this.httpClient.get<RawBlogPostResponse>(`/content/${blogId}`, { expand })
    return {
      storage: response.body?.storage,
      view: response.body?.view,
    }
  }

  private normalizeBlogPost(raw: RawBlogPostResponse): BlogPostInfo {
    return {
      id: raw.id,
      title: raw.title,
      type: (raw.type ?? 'blogpost') as 'blogpost',
      status: raw.status ?? 'current',
      space: raw.space ?? { key: '', name: '' },
      version: raw.version ?? { number: 1 },
      _links: raw._links,
    }
  }
}
