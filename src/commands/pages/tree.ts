import chalk from 'chalk'
import type { Analytics } from '../../analytics.js'
import type { HttpClient } from '../../client/http.js'
import type { PagesClient } from '../../client/pages.js'
import { getConfig } from '../../config/loader.js'
import { buildClient } from './crud.js'

export interface TreeNode {
  id: string
  title: string
  children: TreeNode[]
  space?: { key: string }
  [key: string]: unknown
}

export function shouldExcludePage(title: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    if (new RegExp(`^${regexStr}$`, 'i').test(title)) return true
  }
  return false
}

export function buildTree(
  pages: Array<{ id: string; title: string; parentId?: string; space?: { key: string } }>,
  rootId: string,
): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const tree: TreeNode[] = []

  for (const page of pages) {
    map.set(page.id, { ...page, children: [] })
  }

  for (const page of pages) {
    const node = map.get(page.id)!
    const parentId = page.parentId ?? rootId
    if (parentId === rootId) {
      tree.push(node)
    } else {
      const parent = map.get(parentId)
      if (parent) parent.children.push(node)
    }
  }

  return tree
}

function printTreeNodes(
  nodes: TreeNode[],
  http: HttpClient,
  config: ReturnType<typeof getConfig>,
  options: { showId?: boolean; showUrl?: boolean; baseUrl?: string },
  depth: number,
): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    const isLast = i === nodes.length - 1
    const indent = '  '.repeat(depth - 1)
    const prefix = isLast ? '└── ' : '├── '
    const hasChildren = node.children?.length > 0
    const icon = hasChildren ? '📁' : '📄'

    let output = `${indent}${prefix}${icon} ${chalk.green(node.title)}`
    if (options.showId) output += ` ${chalk.gray(`(ID: ${node.id})`)}`
    if (options.showUrl && options.baseUrl && node.space?.key) {
      const url = `${options.baseUrl}/spaces/${node.space.key}/pages/${node.id}`
      output += `\n${indent}${isLast ? '    ' : '│   '}${chalk.gray(url)}`
    }
    console.log(output)

    if (node.children?.length) {
      printTreeNodes(node.children, http, config, options, depth + 1)
    }
  }
}

export interface CopyTreeResult {
  rootPage: { id: string; title: string }
  totalCopied: number
  failures: Array<{ id: string; title: string; status?: string }>
}

export async function copyPageTree(
  pages: PagesClient,
  sourceId: string,
  targetParentId: string,
  newTitle: string | undefined,
  opts: {
    maxDepth: number
    excludePatterns: string[]
    delayMs: number
    copySuffix: string
    quiet: boolean
  },
): Promise<CopyTreeResult> {
  const sourceInfo = await pages.getPageInfo(sourceId)
  const rootTitle = newTitle ?? `${sourceInfo.title}${opts.copySuffix}`

  const rootResult = await pages.createPage(rootTitle, sourceInfo.space.key, '', targetParentId)
  if (!opts.quiet) {
    console.log(`Created root: ${chalk.blue(rootResult.title)} (ID: ${rootResult.id})`)
  }

  let totalCopied = 1
  const failures: CopyTreeResult['failures'] = []

  const descendants = await pages.getAllDescendantPages(sourceId)
  const filtered =
    opts.excludePatterns.length > 0
      ? descendants.filter((p) => !shouldExcludePage(p.title, opts.excludePatterns))
      : descendants

  const tree = buildTree(filtered, sourceId)

  async function copyLevel(nodes: TreeNode[], parentId: string, depth: number): Promise<void> {
    if (depth >= opts.maxDepth) return
    for (const node of nodes) {
      try {
        const sourceContent = await pages.readPage(node.id, 'storage')
        const content = sourceContent.body.storage?.value ?? ''
        const result = await pages.createPage(node.title, sourceInfo.space.key, content, parentId)
        totalCopied++
        if (!opts.quiet) {
          console.log(`  Created: ${chalk.blue(node.title)} (ID: ${result.id})`)
        }
        if (node.children?.length) {
          await copyLevel(node.children, result.id, depth + 1)
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        failures.push({ id: node.id, title: node.title, status: msg })
        if (!opts.quiet) {
          console.error(chalk.red(`  Failed: ${node.title} - ${msg}`))
        }
      }
      if (opts.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, opts.delayMs))
      }
    }
  }

  await copyLevel(tree, rootResult.id, 0)

  return {
    rootPage: { id: rootResult.id, title: rootResult.title },
    totalCopied,
    failures,
  }
}

export async function handleChildren(
  pageId: string,
  options: {
    recursive?: boolean
    maxDepth?: string
    format?: string
    showUrl?: boolean
    showId?: boolean
  },
  analytics: Analytics,
): Promise<void> {
  const config = getConfig()
  const { pages, http } = buildClient(config)
  const format = (options.format ?? 'list').toLowerCase()

  const children = options.recursive ? await pages.getAllDescendantPages(pageId) : await pages.getChildPages(pageId)

  if (children.length === 0) {
    if (format === 'json') {
      console.log(JSON.stringify({ pageId, childCount: 0, children: [] }, null, 2))
    } else {
      console.log(chalk.yellow('No child pages found.'))
    }
    analytics.track('children', true)
    return
  }

  if (format === 'json') {
    console.log(
      JSON.stringify(
        {
          pageId,
          childCount: children.length,
          children: children.map((p) => ({
            id: p.id,
            title: p.title,
            type: p.type,
            status: p.status,
            spaceKey: p.space?.key ?? null,
            parentId: p.parentId ?? pageId,
          })),
        },
        null,
        2,
      ),
    )
  } else if (format === 'tree' && options.recursive) {
    const pageInfo = await pages.getPageInfo(pageId)
    const baseUrl = pageInfo._links?.base ?? pageInfo._links?.self?.replace(/\/rest\/api.*$/, '') ?? ''
    console.log(chalk.blue(`📁 ${pageInfo.title}`))
    const tree = buildTree(children, pageId)
    printTreeNodes(tree, http, config, { ...options, baseUrl }, 1)
    console.log('')
    console.log(chalk.gray(`Total: ${children.length} child page(s)`))
  } else {
    const pageInfo = await pages.getPageInfo(pageId)
    const baseUrl = pageInfo._links?.base ?? pageInfo._links?.self?.replace(/\/rest\/api.*$/, '') ?? ''
    console.log(chalk.blue('Child pages:'))
    console.log('')
    for (let i = 0; i < children.length; i++) {
      const page = children[i]!
      let output = `${i + 1}. ${chalk.green(page.title)}`
      if (options.showId) output += ` ${chalk.gray(`(ID: ${page.id})`)}`
      if (options.showUrl && page.space?.key) {
        const url = `${baseUrl}/spaces/${page.space.key}/pages/${page.id}`
        output += `\n   ${chalk.gray(url)}`
      }
      if (options.recursive && page.parentId && page.parentId !== pageId) {
        output += ` ${chalk.dim('(nested)')}`
      }
      console.log(output)
    }
    console.log('')
    console.log(chalk.gray(`Total: ${children.length} child page(s)`))
  }

  analytics.track('children', true)
}
