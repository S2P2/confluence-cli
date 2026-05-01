import fs from 'node:fs'
import chalk from 'chalk'
import type { Command } from 'commander'
import inquirer from 'inquirer'
import { Analytics } from '../analytics'
import { BlogClient } from '../client/blog'
import { HttpClient } from '../client/http'
import type { ContentFormat } from '../client/types'
import { getConfig } from '../config/loader'
import { formatJson } from '../format/output'
import { htmlToMarkdown, htmlToPlainText } from '../utils/convert'

export function registerBlogCommands(program: Command): void {
  const blog = program.command('blog').description('Blog post operations')

  blog
    .command('list <space>')
    .description('List blog posts in a space')
    .option('--limit <number>', 'Maximum number of posts to return', '50')
    .option('--json', 'Output as JSON')
    .action(async (space: string, options: { limit?: string; json?: boolean }) => {
      const analytics = new Analytics()
      try {
        const client = new BlogClient(new HttpClient(getConfig()))
        const limit = options.limit ? parseInt(options.limit, 10) : 50
        const posts = await client.list(space, limit)
        if (options.json) {
          console.log(formatJson(posts))
        } else {
          if (posts.length === 0) {
            console.log(chalk.yellow('No blog posts found.'))
            return
          }
          console.log(chalk.blue(`Blog posts in ${space} (${posts.length}):`))
          for (const post of posts) {
            console.log(
              `  ${chalk.green(post.id)} ${post.title} ` +
                `${chalk.gray(`v${post.version.number}`)} ` +
                `${chalk.gray(`[${post.status}]`)}`,
            )
          }
        }
        analytics.track('blog_list', true)
      } catch (error) {
        analytics.track('blog_list', false)
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      }
    })

  blog
    .command('get <id>')
    .description('Get blog post details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options: { json?: boolean }) => {
      const analytics = new Analytics()
      try {
        const client = new BlogClient(new HttpClient(getConfig()))
        const post = await client.get(id)
        if (options.json) {
          console.log(formatJson(post))
        } else {
          console.log(chalk.blue('Blog Post:'))
          console.log(`  Title:  ${chalk.green(post.title)}`)
          console.log(`  ID:     ${chalk.green(post.id)}`)
          console.log(`  Status: ${chalk.green(post.status)}`)
          console.log(`  Space:  ${chalk.green(`${post.space.name} (${post.space.key})`)}`)
          console.log(`  Version: ${chalk.green(String(post.version.number))}`)
          if (post._links?.webui) {
            const url = post._links.webui.startsWith('http')
              ? post._links.webui
              : `${post._links.base ?? post._links.self?.replace(/\/rest\/api.*$/, '') ?? ''}${post._links.webui}`
            console.log(`  URL:    ${chalk.cyan(url)}`)
          }
        }
        analytics.track('blog_get', true)
      } catch (error) {
        analytics.track('blog_get', false)
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      }
    })

  blog
    .command('read <id>')
    .description('Read blog post body content')
    .option('-f, --format <format>', 'Output format (storage, html, text, markdown)', 'storage')
    .action(async (id: string, options: { format?: string }) => {
      const analytics = new Analytics()
      try {
        const client = new BlogClient(new HttpClient(getConfig()))
        const format = (options.format ?? 'storage').toLowerCase()
        const apiFormat = format === 'html' || format === 'text' || format === 'markdown' ? 'view' : 'storage'
        const body = await client.readBody(id, apiFormat)

        let content: string
        if (format === 'storage') {
          content = body.storage?.value ?? ''
        } else if (format === 'html') {
          content = body.view?.value ?? body.storage?.value ?? ''
        } else if (format === 'text') {
          content = htmlToPlainText(body.view?.value ?? body.storage?.value ?? '')
        } else if (format === 'markdown') {
          content = htmlToMarkdown(body.view?.value ?? body.storage?.value ?? '')
        } else {
          content = body.view?.value ?? body.storage?.value ?? ''
        }

        console.log(content)
        analytics.track('blog_read', true)
      } catch (error) {
        analytics.track('blog_read', false)
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      }
    })

  blog
    .command('create <title> <space>')
    .description('Create a blog post')
    .option('--file <path>', 'Read content from file')
    .option('--content <text>', 'Inline content text')
    .option('--format <format>', 'Content format (storage, html, markdown, text)', 'storage')
    .action(async (title: string, space: string, options: { file?: string; content?: string; format?: string }) => {
      const analytics = new Analytics()
      try {
        const content = resolveContent(options)
        if (content === undefined) {
          console.error(chalk.red('Error:'), 'Provide content via --file <path> or --content <text>.')
          process.exit(1)
        }
        const client = new BlogClient(new HttpClient(getConfig()))
        const post = await client.create(title, space, content, options.format as ContentFormat)
        console.log(chalk.green('Blog post created:'))
        console.log(`  ID:     ${post.id}`)
        console.log(`  Title:  ${post.title}`)
        console.log(`  Status: ${post.status}`)
        analytics.track('blog_create', true)
      } catch (error) {
        analytics.track('blog_create', false)
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      }
    })

  blog
    .command('update <id>')
    .description('Update a blog post')
    .option('--title <title>', 'New title')
    .option('--file <path>', 'Read content from file')
    .option('--content <text>', 'Inline content text')
    .option('--format <format>', 'Content format (storage, html, markdown, text)', 'storage')
    .action(async (id: string, options: { title?: string; file?: string; content?: string; format?: string }) => {
      const analytics = new Analytics()
      try {
        const content = resolveContent(options)
        if (content === undefined) {
          console.error(chalk.red('Error:'), 'Provide content via --file <path> or --content <text>.')
          process.exit(1)
        }
        const client = new BlogClient(new HttpClient(getConfig()))
        const post = await client.update(id, content, options.format as ContentFormat, options.title)
        console.log(chalk.green('Blog post updated:'))
        console.log(`  ID:      ${post.id}`)
        console.log(`  Title:   ${post.title}`)
        console.log(`  Version: ${post.version.number}`)
        analytics.track('blog_update', true)
      } catch (error) {
        analytics.track('blog_update', false)
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      }
    })

  blog
    .command('delete <id>')
    .description('Delete a blog post')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (id: string, options: { yes?: boolean }) => {
      const analytics = new Analytics()
      try {
        if (!options.yes) {
          const answers = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Delete blog post ${id}?`,
              default: false,
            },
          ])
          if (!answers.confirm) {
            console.log(chalk.yellow('Cancelled.'))
            return
          }
        }
        const client = new BlogClient(new HttpClient(getConfig()))
        await client.delete(id)
        console.log(chalk.green(`Blog post ${id} deleted.`))
        analytics.track('blog_delete', true)
      } catch (error) {
        analytics.track('blog_delete', false)
        console.error(chalk.red('Error:'), (error as Error).message)
        process.exit(1)
      }
    })
}

function resolveContent(options: { file?: string; content?: string }): string | undefined {
  if (options.file) {
    return fs.readFileSync(options.file, 'utf-8')
  }
  return options.content
}
