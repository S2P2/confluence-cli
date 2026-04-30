import fs from 'node:fs'
import chalk from 'chalk'
import inquirer from 'inquirer'
import type { Analytics } from '../../analytics.js'
import { DefaultAttachmentsClient } from '../../client/attachments.js'
import { HttpClient } from '../../client/http.js'
import { DefaultPagesClient } from '../../client/pages.js'
import { DefaultSearchClient } from '../../client/search.js'
import { getConfig } from '../../config/loader.js'
import { formatPageInfo } from '../../format/output.js'
import { htmlToMarkdown, htmlToPlainText } from '../../utils/convert.js'
import { assertWritable } from '../helpers.js'

export function buildClient(config: ReturnType<typeof getConfig>) {
  const http = new HttpClient(config)
  return {
    http,
    pages: new DefaultPagesClient(http),
    attachments: new DefaultAttachmentsClient(http),
    search: new DefaultSearchClient(http),
  }
}

export function resolveUrl(links: { base?: string; self?: string; webui?: string }): string {
  if (!links.webui) return ''
  if (links.webui.startsWith('http')) return links.webui
  const base = links.base ?? links.self?.replace(/\/rest\/api.*$/, '') ?? ''
  return `${base}${links.webui}`
}

export function pageUrl(config: ReturnType<typeof getConfig>, spaceKey: string, pageId: string): string {
  const siteDomain = config.siteUrl ? config.siteUrl.replace(/^https?:\/\//, '') : config.domain
  return `${config.protocol}://${siteDomain}/wiki${config.apiPath.replace('/rest/api', '')}/spaces/${spaceKey}/pages/${pageId}`
}

export async function handleRead(pageId: string, options: { format: string }, analytics: Analytics): Promise<void> {
  const config = getConfig()
  const { pages } = buildClient(config)

  const format = options.format.toLowerCase()
  const apiFormat: 'storage' | 'view' =
    format === 'html' || format === 'text' || format === 'markdown' ? 'view' : 'storage'

  const pageContent = await pages.readPage(pageId, apiFormat)

  let content: string
  const body = pageContent.body
  if (format === 'storage') {
    content = body.storage?.value ?? ''
  } else if (format === 'html') {
    content = body.view?.value ?? body.storage?.value ?? ''
  } else if (format === 'text') {
    const raw = body.view?.value ?? body.storage?.value ?? ''
    content = htmlToPlainText(raw)
  } else if (format === 'markdown') {
    const raw = body.view?.value ?? body.storage?.value ?? ''
    content = htmlToMarkdown(raw)
  } else {
    content = body.view?.value ?? body.storage?.value ?? ''
  }

  console.log(content)
  analytics.track('read', true)
}

export async function handleInfo(pageId: string, options: { format: string }, analytics: Analytics): Promise<void> {
  const config = getConfig()
  const { pages } = buildClient(config)
  const info = await pages.getPageInfo(pageId)

  if (options.format.toLowerCase() === 'json') {
    console.log(JSON.stringify(info, null, 2))
  } else {
    console.log(formatPageInfo(info))
  }
  analytics.track('info', true)
}

export async function handleCreate(
  title: string,
  space: string,
  options: {
    file?: string
    content?: string
    format?: string
  },
  analytics: Analytics,
): Promise<void> {
  const config = getConfig()
  assertWritable(config)
  const { pages } = buildClient(config)

  if (!title?.trim()) throw new Error('Title is required and cannot be empty.')
  if (!space?.trim()) throw new Error('Space code is required and cannot be empty.')

  let content = ''
  if (options.file) {
    if (!fs.existsSync(options.file)) throw new Error(`File not found: ${options.file}`)
    content = fs.readFileSync(options.file, 'utf8')
  } else if (options.content) {
    content = options.content
  } else {
    throw new Error('Either --file or --content option is required')
  }

  const result = await pages.createPage(
    title,
    space,
    content,
    undefined,
    (options.format ?? 'storage') as 'storage' | 'html' | 'markdown',
  )

  const url = result._links?.webui ? resolveUrl(result._links) : pageUrl(config, result.space.key, result.id)

  console.log(chalk.green('Page created successfully!'))
  console.log(`Title: ${chalk.blue(result.title)}`)
  console.log(`ID: ${chalk.blue(result.id)}`)
  console.log(`Space: ${chalk.blue(result.space.name)} (${result.space.key})`)
  console.log(`URL: ${chalk.gray(url)}`)
  analytics.track('create', true)
}

export async function handleCreateChild(
  title: string,
  parent: string,
  options: { file?: string; content?: string; format?: string },
  analytics: Analytics,
): Promise<void> {
  const config = getConfig()
  assertWritable(config)
  const { pages } = buildClient(config)

  if (!title?.trim()) throw new Error('Title is required and cannot be empty.')
  if (!parent?.trim()) throw new Error('Parent ID is required and cannot be empty.')

  const parentInfo = await pages.getPageInfo(parent)
  const spaceKey = parentInfo.space.key

  let content = ''
  if (options.file) {
    if (!fs.existsSync(options.file)) throw new Error(`File not found: ${options.file}`)
    content = fs.readFileSync(options.file, 'utf8')
  } else if (options.content) {
    content = options.content
  } else {
    throw new Error('Either --file or --content option is required')
  }

  const result = await pages.createChildPage(
    title,
    parent,
    content,
    spaceKey,
    (options.format ?? 'storage') as 'storage' | 'html' | 'markdown',
  )

  const url = result._links?.webui ? resolveUrl(result._links) : pageUrl(config, result.space.key, result.id)

  console.log(chalk.green('Child page created successfully!'))
  console.log(`Title: ${chalk.blue(result.title)}`)
  console.log(`ID: ${chalk.blue(result.id)}`)
  console.log(`Parent: ${chalk.blue(parentInfo.title)} (${parent})`)
  console.log(`Space: ${chalk.blue(result.space.name)} (${result.space.key})`)
  console.log(`URL: ${chalk.gray(url)}`)
  analytics.track('create_child', true)
}

export async function handleEdit(pageId: string, options: { output?: string }, analytics: Analytics): Promise<void> {
  const config = getConfig()
  assertWritable(config)
  const { pages } = buildClient(config)

  const pageData = await pages.readPage(pageId, 'storage')
  const content = pageData.body.storage?.value ?? ''

  console.log(chalk.blue('Page Information:'))
  console.log(`Title: ${chalk.green(pageData.title)}`)
  console.log(`ID: ${chalk.green(pageData.id)}`)
  console.log(`Version: ${chalk.green(pageData.version.number)}`)
  console.log(`Space: ${chalk.green(pageData.space.name)} (${pageData.space.key})`)
  console.log('')

  if (options.output) {
    fs.writeFileSync(options.output, content)
    console.log(chalk.green(`Content saved to: ${options.output}`))
    console.log(chalk.yellow('Edit the file and use "confluence update" to save changes'))
  } else {
    console.log(chalk.blue('Page Content:'))
    console.log(content)
  }

  analytics.track('edit', true)
}

export async function handleUpdate(
  pageId: string,
  options: {
    title?: string
    file?: string
    content?: string
    format?: string
  },
  analytics: Analytics,
): Promise<void> {
  if (!options.title && !options.file && !options.content) {
    throw new Error('At least one of --title, --file, or --content must be provided.')
  }
  if (options.title !== undefined && !options.title.trim()) {
    throw new Error('--title cannot be empty.')
  }

  const config = getConfig()
  assertWritable(config)
  const { pages } = buildClient(config)

  let content: string | undefined
  if (options.file) {
    if (!fs.existsSync(options.file)) throw new Error(`File not found: ${options.file}`)
    content = fs.readFileSync(options.file, 'utf8')
  } else if (options.content) {
    content = options.content
  }

  const result = await pages.updatePage(
    pageId,
    options.title,
    content,
    (options.format ?? 'storage') as 'storage' | 'html' | 'markdown',
  )

  const url = result._links?.webui ? resolveUrl(result._links) : pageUrl(config, result.space.key, result.id)

  console.log(chalk.green('Page updated successfully!'))
  console.log(`Title: ${chalk.blue(result.title)}`)
  console.log(`ID: ${chalk.blue(result.id)}`)
  console.log(`Version: ${chalk.blue(result.version.number)}`)
  console.log(`URL: ${chalk.gray(url)}`)
  analytics.track('update', true)
}

export async function handleDelete(pageId: string, options: { yes?: boolean }, analytics: Analytics): Promise<void> {
  const config = getConfig()
  assertWritable(config)
  const { pages } = buildClient(config)

  const pageInfo = await pages.getPageInfo(pageId)

  if (!options.yes) {
    const spaceLabel = pageInfo.space?.key ? ` (${pageInfo.space.key})` : ''
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        default: false,
        message: `Delete "${pageInfo.title}" (ID: ${pageInfo.id})${spaceLabel}?`,
      },
    ])
    if (!confirmed) {
      console.log(chalk.yellow('Cancelled.'))
      analytics.track('delete_cancel', true)
      return
    }
  }

  await pages.deletePage(pageInfo.id)
  console.log(chalk.green('Page deleted successfully!'))
  console.log(`Title: ${chalk.blue(pageInfo.title)}`)
  console.log(`ID: ${chalk.blue(pageInfo.id)}`)
  analytics.track('delete', true)
}

export async function handleMove(
  pageId: string,
  parent: string,
  options: { title?: string },
  analytics: Analytics,
): Promise<void> {
  const config = getConfig()
  assertWritable(config)
  const { pages } = buildClient(config)

  await pages.movePage(pageId, parent, options.title)
  const info = await pages.getPageInfo(pageId)

  console.log(chalk.green('Page moved successfully!'))
  console.log(`Title: ${chalk.blue(options.title ?? info.title)}`)
  console.log(`ID: ${chalk.blue(info.id)}`)
  console.log(`New Parent: ${chalk.blue(parent)}`)
  console.log(`Version: ${chalk.blue(info.version.number)}`)
  analytics.track('move', true)
}

export async function handlePageList(
  space: string,
  options: {
    limit?: string
    format?: string
  },
  analytics: Analytics,
): Promise<void> {
  const config = getConfig()
  const { pages } = buildClient(config)

  const limit = options.limit ? Number.parseInt(options.limit, 10) : 25
  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error('Limit must be a positive number.')
  }

  const format = (options.format ?? 'text').toLowerCase()
  if (!['text', 'json'].includes(format)) {
    throw new Error('Format must be one of: text, json')
  }

  const result = await pages.listPages(space, limit)

  if (result.length === 0) {
    console.log(chalk.yellow('No pages found.'))
    analytics.track('page_list', true)
    return
  }

  if (format === 'json') {
    console.log(JSON.stringify({ space, pageCount: result.length, pages: result }, null, 2))
  } else {
    console.log(chalk.blue(`Pages in space ${space} (${result.length}):`))
    for (let i = 0; i < result.length; i++) {
      const page = result[i]!
      console.log(`${i + 1}. ${chalk.green(page.title)} ${chalk.gray(`(ID: ${page.id})`)}`)
    }
  }

  analytics.track('page_list', true)
}
