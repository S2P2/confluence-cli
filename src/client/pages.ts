import type { HttpClient } from './http'
import type {
  PageInfo,
  PageContent,
  ChildPage,
  CreatePageResult,
  ContentKind,
  SearchType,
  PaginatedResponse
} from './types'

export class PagesClient {
  private readonly httpClient: HttpClient

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient
  }

  /**
   * Normalize raw API response to PageInfo type
   */
  public normalizePage(data: any): PageInfo {
    return {
      id: data.id,
      title: data.title,
      type: data.type || 'page',
      status: data.status || 'current',
      space: {
        key: data.space?.key || '',
        name: data.space?.name || '',
        id: data.space?.id
      },
      version: {
        number: data.version?.number || 1,
        by: data.version?.by,
        when: data.version?.when
      },
      ancestors: data.ancestors,
      _links: data._links
    }
  }

  /**
   * Normalize child page data
   */
  private normalizeChildPage(data: any): ChildPage {
    return {
      id: data.id,
      title: data.title,
      type: data.type || 'page',
      status: data.status || 'current',
      space: data.space,
      parentId: data.parentId,
      version: data.version,
      url: data.url,
      depth: data.depth,
      ancestors: data.ancestors
    }
  }

  /**
   * Get basic page information
   */
  public async getPageInfo(pageId: string): Promise<PageInfo> {
    const id = this.httpClient.extractPageId(pageId)
    const data = await this.httpClient.get<any>(`/content/${id}`)
    return this.normalizePage(data)
  }

  /**
   * Read page content with specified format
   */
  public async readPage(pageId: string, format: 'storage' | 'view' = 'storage'): Promise<PageContent> {
    const id = this.httpClient.extractPageId(pageId)
    const expand = format === 'storage' ? 'body.storage' : 'body.view'
    const data = await this.httpClient.get<any>(`/content/${id}`, { expand })

    const pageInfo = this.normalizePage(data)
    return {
      ...pageInfo,
      body: {
        storage: data.body?.storage,
        view: data.body?.view
      }
    }
  }

  /**
   * Create a new page
   */
  public async createPage(
    title: string,
    spaceKey: string,
    content: string,
    parentId?: string,
    format: ContentFormat = 'storage'
  ): Promise<CreatePageResult> {
    const payload: any = {
      type: 'page',
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: content,
          representation: format
        }
      }
    }

    if (parentId) {
      payload.ancestors = [{ id: this.httpClient.extractPageId(parentId) }]
    }

    const data = await this.httpClient.post<any>('/content', payload)
    return {
      id: data.id,
      title: data.title,
      status: data.status,
      version: data.version,
      space: data.space,
      _links: data._links
    }
  }

  /**
   * Create a child page
   */
  public async createChildPage(
    title: string,
    parentId: string,
    content: string,
    spaceKey: string,
    format: ContentFormat = 'storage'
  ): Promise<CreatePageResult> {
    return this.createPage(title, spaceKey, content, parentId, format)
  }

  /**
   * Update an existing page
   */
  public async updatePage(
    pageId: string,
    title?: string,
    content?: string,
    format: ContentFormat = 'storage'
  ): Promise<CreatePageResult> {
    const id = this.httpClient.extractPageId(pageId)

    // Get current page to get version
    const currentPage = await this.readPage(id, 'storage')
    const currentVersion = currentPage.version.number

    const payload: any = {
      type: 'page',
      title: title || currentPage.title,
      version: { number: currentVersion + 1 },
      body: {
        storage: {
          value: content || currentPage.body.storage?.value || '',
          representation: format
        }
      }
    }

    const data = await this.httpClient.put<any>(`/content/${id}`, payload)
    return {
      id: data.id,
      title: data.title,
      status: data.status,
      version: data.version,
      space: data.space,
      _links: data._links
    }
  }

  /**
   * Delete a page
   */
  public async deletePage(pageId: string): Promise<void> {
    const id = this.httpClient.extractPageId(pageId)
    await this.httpClient.delete(`/content/${id}`)
  }

  /**
   * Move a page to a new position/parent
   */
  public async movePage(pageId: string, newParentId?: string, position?: string): Promise<void> {
    const id = this.httpClient.extractPageId(pageId)
    const payload: any = {}

    if (newParentId) {
      payload.ancestors = [{ id: this.httpClient.extractPageId(newParentId) }]
    }

    if (position) {
      payload.position = position
    }

    await this.httpClient.put(`/content/${id}`, payload)
  }

  /**
   * Get direct child pages
   */
  public async getChildPages(pageId: string, limit: number = 500): Promise<ChildPage[]> {
    const id = this.httpClient.extractPageId(pageId)
    const data = await this.httpClient.get<PaginatedResponse<any>>(`/content/${id}/child/page`, {
      limit,
      expand: 'space,ancestors'
    })

    return data.results.map(item => this.normalizeChildPage(item))
  }

  /**
   * Get all descendant pages recursively
   */
  public async getAllDescendantPages(pageId: string): Promise<ChildPage[]> {
    const allPages: ChildPage[] = []

    const fetchChildren = async (parentId: string): Promise<void> => {
      const children = await this.getChildPages(parentId)

      for (const child of children) {
        allPages.push(child)
        await fetchChildren(child.id)
      }
    }

    await fetchChildren(pageId)
    return allPages
  }

  /**
   * List pages in a space
   */
  public async listPages(spaceKey: string, limit: number = 25): Promise<PageInfo[]> {
    const data = await this.httpClient.get<PaginatedResponse<any>>('/content', {
      type: 'page',
      spaceKey,
      limit,
      expand: 'space,version',
    });
    return data.results.map((item: any) => this.normalizePage(item));
  }

  /**
   * Find pages by title
   */
  public async findPageByTitle(
    title: string,
    spaceKey?: string,
    type: SearchType = 'page'
  ): Promise<PageInfo[]> {
    const params: Record<string, any> = {
      limit: 50,
      type,
      title
    }

    if (spaceKey) {
      params.spaceKey = spaceKey
    }

    const data = await this.httpClient.get<PaginatedResponse<any>>('/content', params)
    return data.results.map(item => this.normalizePage(item))
  }
}

export type ContentFormat = 'storage' | 'html' | 'markdown' | 'text'