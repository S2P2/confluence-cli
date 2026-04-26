import { htmlToMarkdown, htmlToPlainText } from '../utils/convert.js'
import type { HttpClient } from './http.js'
import type { CommentInfo, ContentFormat, PaginatedResponse, RawCommentResponse } from './types.js'

export interface CommentsClient {
  list(
    pageId: string,
    options?: { limit?: number; start?: number; location?: string; depth?: string },
  ): Promise<PaginatedResponse<CommentInfo>>
  getAll(pageId: string, options?: { maxResults?: number; location?: string; depth?: string }): Promise<CommentInfo[]>
  create(
    pageId: string,
    content: string,
    format: ContentFormat,
    options?: { parentId?: string; location?: string; inlineProperties?: Record<string, string> },
  ): Promise<CommentInfo>
  delete(commentId: string): Promise<void>
  formatCommentBody(storage: string, format: ContentFormat): string
  normalizeComment(raw: RawCommentResponse): CommentInfo
  parseNextStart(links: { next?: string } | undefined): number | undefined
}

export class DefaultCommentsClient implements CommentsClient {
  constructor(private readonly httpClient: HttpClient) {}

  public async list(
    pageId: string,
    options?: { limit?: number; start?: number; location?: string; depth?: string },
  ): Promise<PaginatedResponse<CommentInfo>> {
    const extractedId = this.httpClient.extractPageId(pageId)
    const params: Record<string, unknown> = {
      expand: 'body.storage,history,extensions',
    }
    if (options?.limit !== undefined) params.limit = options.limit
    if (options?.start !== undefined) params.start = options.start
    if (options?.location) params.location = options.location
    if (options?.depth) params.depth = options.depth

    const response = await this.httpClient.get<PaginatedResponse<RawCommentResponse>>(
      `/content/${extractedId}/child/comment`,
      params,
    )

    return {
      ...response,
      results: (response.results ?? []).map((r) => this.normalizeComment(r)),
    }
  }

  public async getAll(
    pageId: string,
    options?: { maxResults?: number; location?: string; depth?: string },
  ): Promise<CommentInfo[]> {
    const maxResults = options?.maxResults ?? Infinity
    const allComments: CommentInfo[] = []
    let start = 0
    const limit = 25

    while (allComments.length < maxResults) {
      const page = await this.list(pageId, {
        limit,
        start,
        location: options?.location,
        depth: options?.depth,
      })

      allComments.push(...page.results)

      const nextStart = this.parseNextStart(page._links)
      if (nextStart === undefined || page.results.length === 0) break
      start = nextStart
    }

    return maxResults === Infinity ? allComments : allComments.slice(0, maxResults)
  }

  public async create(
    pageId: string,
    content: string,
    _format: ContentFormat,
    options?: { parentId?: string; location?: string; inlineProperties?: Record<string, string> },
  ): Promise<CommentInfo> {
    const extractedId = this.httpClient.extractPageId(pageId)
    const body: Record<string, unknown> = {
      type: 'comment',
      container: { id: extractedId, type: 'page' },
      body: { storage: { value: content, representation: 'storage' } },
    }

    if (options?.parentId) {
      body.ancestors = [{ id: options.parentId }]
    }
    if (options?.location) {
      body.extension = { location: options.location }
    }
    if (options?.inlineProperties) {
      body.extension = {
        ...(body.extension as Record<string, unknown>),
        inlineProperties: options.inlineProperties,
      }
    }

    const result = await this.httpClient.post<RawCommentResponse>('/content', body)
    return this.normalizeComment(result)
  }

  public async delete(commentId: string): Promise<void> {
    await this.httpClient.delete(`/content/${commentId}`)
  }

  public formatCommentBody(storage: string, format: ContentFormat): string {
    if (format === 'storage' || format === 'html') return storage
    if (format === 'markdown') return htmlToMarkdown(storage)
    return htmlToPlainText(storage)
  }

  public normalizeComment(raw: RawCommentResponse): CommentInfo {
    const storageBody = raw.body?.storage?.value ?? ''
    return {
      id: String(raw.id),
      body: storageBody,
      parentId: raw.ancestors?.[0]?.id ? String(raw.ancestors[0].id) : undefined,
      location: raw.extensions?.location,
      author: raw.history?.createdBy
        ? {
            displayName: raw.history.createdBy.displayName ?? '',
            username: raw.history.createdBy.username,
            accountId: raw.history.createdBy.accountId,
          }
        : undefined,
      createdAt: raw.history?.createdDate,
      status: raw.status,
      version: raw.version?.number,
      resolution: raw.extensions?.resolution?.status,
      inlineProperties: raw.extensions?.inlineProperties,
    }
  }

  public parseNextStart(links: { next?: string } | undefined): number | undefined {
    if (!links?.next) return undefined
    const url = typeof links.next === 'string' ? links.next : ''
    const match = url.match(/[?&]start=(\d+)/)
    return match?.[1] ? Number(match[1]) : undefined
  }
}
