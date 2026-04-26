export type ContentKind = 'page' | 'blogpost' | 'comment' | 'attachment'

export type ContentFormat = 'storage' | 'html' | 'markdown' | 'text'

export type SearchType = 'page' | 'blog' | 'comment' | 'attachment'

export interface SpaceSummary {
  id: string
  key: string
  name: string
  type: string
  status: string
  _links?: { webui?: string; base?: string }
}

export interface PageInfo {
  id: string
  title: string
  type: ContentKind
  status: string
  space: { key: string; name: string; id?: string }
  version: { number: number; by?: UserInfo; when?: string }
  ancestors?: Array<{ id: string; title: string }>
  _links?: { webui?: string; base?: string; tinyui?: string; self?: string }
}

export interface PageContent extends PageInfo {
  body: {
    storage?: { value: string }
    view?: { value: string }
    export_view?: { value: string }
    anonymous_export_view?: { value: string }
  }
}

export interface ChildPage {
  id: string
  title: string
  type: ContentKind
  status: string
  space?: { key: string }
  parentId?: string
  version?: number
  url?: string
  depth?: number
  ancestors?: Array<{ id: string; title: string }>
}

export interface SearchResult {
  id: string
  title: string
  excerpt?: string
  kind: ContentKind
  space_key: string
  web_url: string
}

export interface CommentInfo {
  id: string
  body: string
  parentId?: string
  location?: string
  author?: UserInfo
  createdAt?: string
  status?: string
  version?: number
  resolution?: string
  inlineProperties?: Record<string, string>
  children?: CommentInfo[]
}

export interface UserInfo {
  displayName: string
  username?: string
  accountId?: string
  email?: string
}

export interface AttachmentInfo {
  id: string
  title: string
  mediaType?: string
  fileSize?: number
  version: number
  downloadLink: string
}

export interface LabelInfo {
  id: string
  name: string
  prefix: string
}

export interface ContentProperty {
  key: string
  value: unknown
  version: { number: number }
}

export interface PaginatedResponse<T> {
  results: T[]
  start: number
  limit: number
  size: number
  _links?: { next?: string }
}

export interface CreatePageResult {
  id: string
  title: string
  status: string
  version: { number: number }
  space: { key: string; name: string }
  _links?: { webui?: string }
}

export interface CopyTreeResult {
  rootPage: CreatePageResult & { _links?: { webui?: string } }
  totalCopied: number
  failures: Array<{ id: string; title: string; status?: string }>
}

// Raw Confluence API response shapes (before normalization)

export interface RawPageResponse {
  id: string
  title: string
  type?: string
  status?: string
  space?: { key?: string; name?: string; id?: string }
  version?: { number?: number; by?: UserInfo; when?: string }
  ancestors?: Array<{ id: string; title: string }>
  body?: {
    storage?: { value: string }
    view?: { value: string }
    export_view?: { value: string }
    anonymous_export_view?: { value: string }
  }
  _links?: { webui?: string; base?: string; tinyui?: string }
}

export interface RawChildPageResponse {
  id: string
  title: string
  type?: string
  status?: string
  space?: { key?: string }
  parentId?: string
  version?: number
  url?: string
  depth?: number
  ancestors?: Array<{ id: string; title: string }>
}

export interface RawBlogPostResponse {
  id: string
  title: string
  type?: string
  status?: string
  space?: { key: string; name: string }
  version?: { number: number }
  body?: { storage?: { value: string }; view?: { value: string } }
  _links?: { webui?: string; base?: string; self?: string }
}

export interface RawLabelResponse {
  id: string
  name: string
  prefix?: string
}

export interface RawCommentResponse {
  id: string | number
  body?: { storage?: { value: string } }
  ancestors?: Array<{ id: string | number }>
  extensions?: {
    location?: string
    resolution?: { status?: string }
    inlineProperties?: Record<string, string>
  }
  history?: {
    createdBy?: { displayName?: string; username?: string; accountId?: string }
    createdDate?: string
  }
  status?: string
  version?: { number?: number }
}

export interface RawAttachmentResponse {
  id: string | number
  title: string
  extensions?: { mediaType?: string; fileSize?: number; downloadLink?: string }
  metadata?: { mediaType?: string; fileSize?: number }
  version?: { number?: number }
  _links?: { download?: string; base?: string }
}

export interface RawPropertyResponse {
  key: string
  value: unknown
  version?: { number: number }
}

export interface RawSearchResultResponse {
  id: string | number
  title: string
  excerpt?: string
  type?: string
  space?: { key?: string }
  _links?: { webui?: string; base?: string }
}

export interface RawSpaceResponse {
  id?: string | number
  key: string
  name: string
  type?: string
  status?: string | { name?: string }
  _links?: { webui?: string; base?: string }
}
