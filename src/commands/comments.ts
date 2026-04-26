import fs from 'node:fs'
import chalk from 'chalk'
import type { Command } from 'commander'
import inquirer from 'inquirer'
import { Analytics } from '../analytics.js'
import { DefaultCommentsClient } from '../client/comments.js'
import { HttpClient } from '../client/http.js'
import { getConfig } from '../config/loader.js'
import { assertWritable, handleCommandError } from './helpers.js'

function buildCommentsClient(config: ReturnType<typeof getConfig>): DefaultCommentsClient {
  const http = new HttpClient(config)
  return new DefaultCommentsClient(http)
}

function parseLocationOptions(raw: string | undefined): string[] {
  if (!raw) return []
  return String(raw)
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
}

function buildCommentTree(
  comments: Array<{
    id: string
    parentId?: string
    body: string
    author?: { displayName: string }
    location?: string
    createdAt?: string
    status?: string
    version?: number
    resolution?: string
    inlineProperties?: Record<string, string>
    children?: Array<(typeof comments)[number]>
  }>,
): Array<(typeof comments)[number] & { children: Array<(typeof comments)[number]> }> {
  const nodes = comments.map((comment, index) => ({
    ...comment,
    _order: index,
    children: [] as Array<(typeof comments)[number]>,
  }))
  const byId = new Map(nodes.map((node) => [String(node.id), node]))
  const roots: typeof nodes = []

  for (const node of nodes) {
    const parentId = node.parentId ? String(node.parentId) : null
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)?.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (list: typeof nodes) => {
    list.sort((a, b) => (a as { _order: number })._order - (b as { _order: number })._order)
    for (const child of list) {
      sortNodes(child.children as typeof nodes)
    }
  }

  sortNodes(roots)
  return roots
}

function formatBodyBlock(text: string, indent = ''): string {
  return text
    .split('\n')
    .map((line) => `${indent}${chalk.white(line)}`)
    .join('\n')
}

async function handleCommentsList(
  pageId: string,
  options: {
    format?: string
    limit?: string
    start?: string
    location?: string
    depth?: string
    all?: boolean
  },
  analytics: Analytics,
): Promise<void> {
  const config = getConfig()
  const client = buildCommentsClient(config)

  const format = (options.format ?? 'text').toLowerCase()
  if (!['text', 'markdown', 'json'].includes(format)) {
    throw new Error('Format must be one of: text, markdown, json')
  }

  const limit = options.limit ? Number.parseInt(options.limit, 10) : undefined
  if (options.limit && (Number.isNaN(limit) || limit! <= 0)) {
    throw new Error('Limit must be a positive number.')
  }

  const start = options.start ? Number.parseInt(options.start, 10) : 0
  if (options.start && (Number.isNaN(start) || start < 0)) {
    throw new Error('Start must be a non-negative number.')
  }

  const locationValues = parseLocationOptions(options.location)
  const invalidLocations = locationValues.filter((v) => !['inline', 'footer', 'resolved'].includes(v))
  if (invalidLocations.length > 0) {
    throw new Error(`Invalid location value(s): ${invalidLocations.join(', ')}`)
  }
  const locationParam =
    locationValues.length === 0 ? undefined : locationValues.length === 1 ? locationValues[0] : locationValues.join(',')

  let comments: import('../client/types.js').CommentInfo[]
  let nextStart: number | undefined

  if (options.all) {
    comments = await client.getAll(pageId, {
      maxResults: limit,
      location: locationParam,
      depth: options.depth,
    })
  } else {
    const response = await client.list(pageId, {
      limit,
      start,
      location: locationParam,
      depth: options.depth,
    })
    comments = response.results
    nextStart = client.parseNextStart(response._links)
  }

  if (comments.length === 0) {
    console.log(chalk.yellow('No comments found.'))
    analytics.track('comments', true)
    return
  }

  if (format === 'json') {
    const output = {
      pageId,
      commentCount: comments.length,
      comments: comments.map((c: import('../client/types.js').CommentInfo) => ({
        ...c,
        bodyStorage: c.body,
        bodyText: client.formatCommentBody(c.body, 'text'),
      })),
    }
    if (!options.all) {
      ;(output as { nextStart?: number }).nextStart = nextStart
    }
    console.log(JSON.stringify(output, null, 2))
    analytics.track('comments', true)
    return
  }

  const commentTree = buildCommentTree(comments)
  console.log(chalk.blue(`Found ${comments.length} comment(s):`))

  const renderComments = (nodes: Array<(typeof commentTree)[number]>, path: number[] = []) => {
    for (let i = 0; i < nodes.length; i++) {
      const comment = nodes[i]!
      const currentPath = [...path, i + 1]
      const level = currentPath.length - 1
      const indent = '  '.repeat(level)
      const branchGlyph = level > 0 ? (i === nodes.length - 1 ? '\u2514\u2500 ' : '\u251C\u2500 ') : ''
      const headerPrefix = `${indent}${chalk.dim(branchGlyph)}`
      const bodyIndent = level === 0 ? '   ' : `${indent}${' '.repeat(branchGlyph.length)}`

      const isReply = Boolean(comment.parentId)
      const location = comment.location ?? 'footer'
      const author = comment.author?.displayName ?? 'Unknown'
      const createdAt = comment.createdAt ?? 'unknown date'
      const metaParts = [`Created: ${createdAt}`]
      if (comment.status) metaParts.push(`Status: ${comment.status}`)
      if (comment.version) metaParts.push(`Version: ${comment.version}`)
      if (!isReply && comment.resolution) {
        metaParts.push(`Resolution: ${comment.resolution}`)
      }

      const label = isReply ? chalk.gray('[reply]') : chalk.cyan(`[${location}]`)
      console.log(
        `${headerPrefix}${currentPath.join('.')}. ${chalk.green(author)} ${chalk.gray(`(ID: ${comment.id})`)} ${label}`,
      )
      console.log(chalk.dim(`${bodyIndent}${metaParts.join(' \u2022 ')}`))

      if (!isReply && comment.inlineProperties) {
        const selectionText = comment.inlineProperties.selection ?? comment.inlineProperties.originalSelection
        if (selectionText) {
          const selectionLabel = comment.inlineProperties.selection ? 'Highlight' : 'Highlight (original)'
          console.log(chalk.dim(`${bodyIndent}${selectionLabel}: ${selectionText}`))
        }
        if (comment.inlineProperties.markerRef) {
          console.log(chalk.dim(`${bodyIndent}Marker ref: ${comment.inlineProperties.markerRef}`))
        }
      }

      const body = client.formatCommentBody(comment.body, format as 'storage' | 'html' | 'markdown' | 'text')
      if (body) {
        console.log(`${bodyIndent}${chalk.yellowBright('Body:')}`)
        console.log(formatBodyBlock(body, `${bodyIndent}  `))
      }

      if (comment.children?.length) {
        renderComments(comment.children as Array<(typeof commentTree)[number]>, currentPath)
      }
    }
  }

  renderComments(commentTree)

  if (!options.all && nextStart != null) {
    console.log(chalk.gray(`Next start: ${nextStart}`))
  }

  analytics.track('comments', true)
}

async function handleCommentCreate(
  pageId: string,
  options: {
    file?: string
    content?: string
    format?: string
    parent?: string
    location?: string
    inlineSelection?: string
  },
  analytics: Analytics,
): Promise<void> {
  const config = getConfig()
  assertWritable(config)
  const client = buildCommentsClient(config)

  let content = ''
  if (options.file) {
    if (!fs.existsSync(options.file)) throw new Error(`File not found: ${options.file}`)
    content = fs.readFileSync(options.file, 'utf8')
  } else if (options.content) {
    content = options.content
  } else {
    throw new Error('Either --file or --content option is required')
  }

  const location = (options.location ?? 'footer').toLowerCase()
  if (!['inline', 'footer'].includes(location)) {
    throw new Error('Location must be either "inline" or "footer".')
  }

  const inlineProperties: Record<string, string> = {}
  if (options.inlineSelection) {
    inlineProperties.selection = options.inlineSelection
    inlineProperties.originalSelection = options.inlineSelection
  }
  if (location === 'inline' && !options.inlineSelection && !options.parent) {
    throw new Error('Inline comments require --inline-selection when starting a new inline thread.')
  }

  const result = await client.create(
    pageId,
    content,
    (options.format ?? 'storage') as 'storage' | 'html' | 'markdown' | 'text',
    {
      parentId: options.parent,
      location,
      inlineProperties: Object.keys(inlineProperties).length > 0 ? inlineProperties : undefined,
    },
  )

  console.log(chalk.green('Comment created successfully!'))
  console.log(`ID: ${chalk.blue(result.id)}`)
  analytics.track('comment_create', true)
}

async function handleCommentDelete(commentId: string, options: { yes?: boolean }, analytics: Analytics): Promise<void> {
  const config = getConfig()
  assertWritable(config)
  const client = buildCommentsClient(config)

  if (!options.yes) {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        default: false,
        message: `Delete comment ${commentId}?`,
      },
    ])
    if (!confirmed) {
      console.log(chalk.yellow('Cancelled.'))
      analytics.track('comment_delete_cancel', true)
      return
    }
  }

  await client.delete(commentId)
  console.log(chalk.green('Comment deleted successfully!'))
  console.log(`ID: ${chalk.blue(commentId)}`)
  analytics.track('comment_delete', true)
}

export function registerCommentCommands(program: Command): void {
  // comments - list
  program
    .command('comments <pageId>')
    .description('List comments for a page by ID or URL')
    .option('-f, --format <format>', 'Output format (text, markdown, json)', 'text')
    .option('-l, --limit <limit>', 'Maximum number of comments to fetch (default: 25)')
    .option('--start <start>', 'Start index for results (default: 0)', '0')
    .option('--location <location>', 'Filter by location (inline, footer, resolved). Comma-separated')
    .option('--depth <depth>', 'Comment depth ("" for root only, "all")')
    .option('--all', 'Fetch all comments (ignores pagination)')
    .action(
      async (
        pageId: string,
        options: {
          format?: string
          limit?: string
          start?: string
          location?: string
          depth?: string
          all?: boolean
        },
      ) => {
        const analytics = new Analytics()
        try {
          await handleCommentsList(pageId, options, analytics)
        } catch (error) {
          handleCommandError(analytics, 'comments', error)
        }
      },
    )

  // comment-delete
  program
    .command('comment-delete <commentId>')
    .description('Delete a comment by ID')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (commentId: string, options: { yes?: boolean }) => {
      const analytics = new Analytics()
      try {
        await handleCommentDelete(commentId, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'comment_delete', error)
      }
    })

  // --- Grouped subcommands (Rust CLI convention) ---

  const comment = program.command('comment').description('Comment operations (grouped)')

  comment
    .command('list <pageId>')
    .description('List comments for a page (alias: comments)')
    .option('-f, --format <format>', 'Output format (text, markdown, json)', 'text')
    .option('-l, --limit <limit>', 'Maximum number of comments to fetch (default: 25)')
    .option('--start <start>', 'Start index for results (default: 0)', '0')
    .option('--location <location>', 'Filter by location (inline, footer, resolved). Comma-separated')
    .option('--depth <depth>', 'Comment depth ("" for root only, "all")')
    .option('--all', 'Fetch all comments (ignores pagination)')
    .action(
      async (
        pageId: string,
        options: {
          format?: string
          limit?: string
          start?: string
          location?: string
          depth?: string
          all?: boolean
        },
      ) => {
        const analytics = new Analytics()
        try {
          await handleCommentsList(pageId, options, analytics)
        } catch (error) {
          handleCommandError(analytics, 'comment_list', error)
        }
      },
    )

  comment
    .command('add <pageId>')
    .description('Create a comment on a page (alias: comment)')
    .option('-f, --file <file>', 'Read content from file')
    .option('-c, --content <content>', 'Comment content as string')
    .option('--format <format>', 'Content format (storage, html, markdown)', 'storage')
    .option('--parent <commentId>', 'Reply to a comment by ID')
    .option('--location <location>', 'Comment location (inline or footer)', 'footer')
    .option('--inline-selection <text>', 'Inline selection text')
    .action(
      async (
        pageId: string,
        options: {
          file?: string
          content?: string
          format?: string
          parent?: string
          location?: string
          inlineSelection?: string
        },
      ) => {
        const analytics = new Analytics()
        try {
          await handleCommentCreate(pageId, options, analytics)
        } catch (error) {
          handleCommandError(analytics, 'comment_add', error)
        }
      },
    )

  comment
    .command('delete <commentId>')
    .description('Delete a comment by ID (alias: comment-delete)')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (commentId: string, options: { yes?: boolean }) => {
      const analytics = new Analytics()
      try {
        await handleCommentDelete(commentId, options, analytics)
      } catch (error) {
        handleCommandError(analytics, 'comment_group_delete', error)
      }
    })
}
