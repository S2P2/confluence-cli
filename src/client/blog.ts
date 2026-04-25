import { HttpClient } from './http'
import type { ContentFormat, PaginatedResponse } from './types'

export interface BlogPostInfo {
  id: string;
  title: string;
  type: 'blogpost';
  status: string;
  space: { key: string; name: string };
  version: { number: number };
  _links?: { webui?: string; base?: string };
}

export interface CreateBlogPostRequest {
  title: string;
  spaceKey: string;
  content: string;
  format?: ContentFormat;
}

export interface UpdateBlogPostRequest {
  content: string;
  format?: ContentFormat;
  title?: string;
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

    const response = await this.httpClient.get<PaginatedResponse<BlogPostInfo>>('/content', params)
    return response.results
  }

  async get(blogId: string): Promise<BlogPostInfo> {
    const params = {
      expand: 'space,version,body.storage',
    }

    const response = await this.httpClient.get<BlogPostInfo>(`/content/${blogId}`, params)
    return this.normalizeBlogPost(response)
  }

  async create(title: string, spaceKey: string, content: string, format: ContentFormat = 'storage'): Promise<BlogPostInfo> {
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

    const response = await this.httpClient.post<BlogPostInfo>('/content', data)
    return this.normalizeBlogPost(response)
  }

  async update(blogId: string, content: string, format: ContentFormat = 'storage', title?: string): Promise<BlogPostInfo> {
    // Get current post to get version number
    const current = await this.get(blogId)
    const newVersionNumber = current.version.number + 1

    const data: Record<string, unknown> = {
      id: blogId,
      type: 'blogpost',
      version: { number: newVersionNumber },
      body: {
        storage: {
          value: content,
          representation: format,
        },
      },
    }

    if (title) {
      data.title = title
    }

    const response = await this.httpClient.put<BlogPostInfo>(`/content/${blogId}`, data)
    return this.normalizeBlogPost(response)
  }

  async delete(blogId: string): Promise<void> {
    await this.httpClient.delete(`/content/${blogId}`)
  }

  private normalizeBlogPost(raw: any): BlogPostInfo {
    return {
      id: raw.id,
      title: raw.title,
      type: raw.type,
      status: raw.status,
      space: raw.space,
      version: raw.version,
      _links: raw._links,
    }
  }
}