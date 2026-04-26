import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import type { Analytics } from '../../analytics.js'
import type { DefaultAttachmentsClient } from '../../client/attachments.js'
import type { PagesClient } from '../../client/pages.js'
import { getConfig } from '../../config/loader.js'
import { uniquePathFor } from '../../utils/fs.js'
import { sanitizeTitle } from '../../utils/sanitize.js'
import { buildClient } from './crud.js'
import { shouldExcludePage } from './tree.js'

export const EXPORT_MARKER = '.confluence-export.json'

export function writeExportMarker(exportDir: string, meta: { pageId: string; title: string }): void {
  const marker = {
    exportedAt: new Date().toISOString(),
    pageId: meta.pageId,
    title: meta.title,
    tool: 'confluence-cli',
  }
  fs.writeFileSync(path.join(exportDir, EXPORT_MARKER), JSON.stringify(marker, null, 2))
}

export function isExportDirectory(dir: string): boolean {
  return fs.existsSync(path.join(dir, EXPORT_MARKER))
}

export async function exportRecursive(
  pages: PagesClient,
  attachments: InstanceType<typeof DefaultAttachmentsClient>,
  pageId: string,
  options: {
    format?: string
    dest?: string
    file?: string
    attachmentsDir?: string
    pattern?: string
    referencedOnly?: boolean
    skipAttachments?: boolean
    maxDepth?: string
    exclude?: string
    delayMs?: string
    dryRun?: boolean
    overwrite?: boolean
  },
): Promise<void> {
  const format = (options.format ?? 'markdown').toLowerCase()
  const formatExt: Record<string, string> = { markdown: 'md', html: 'html', text: 'txt' }
  const contentExt = formatExt[format] ?? 'txt'
  const contentFile = options.file ?? `page.${contentExt}`
  const baseDir = path.resolve(options.dest ?? '.')
  const delayMs = Number.parseInt(options.delayMs ?? '100', 10) || 100

  const rootPage = await pages.getPageInfo(pageId)
  console.log(`Fetching descendants of "${chalk.blue(rootPage.title)}"...`)

  const descendants = await pages.getAllDescendantPages(pageId)
  const excludePatterns = options.exclude
    ? options.exclude
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : []

  const allPages = [{ id: rootPage.id, title: rootPage.title, parentId: undefined as string | undefined }]
  for (const page of descendants) {
    if (excludePatterns.length && shouldExcludePage(page.title, excludePatterns)) continue
    allPages.push({ id: page.id, title: page.title, parentId: page.parentId })
  }

  const totalPages = allPages.length
  console.log(`Found ${chalk.blue(totalPages)} page(s) to export.`)

  if (options.dryRun) {
    const printDryRun = (items: typeof allPages, indent = '') => {
      for (const item of items) {
        console.log(`${indent}${chalk.blue(item.title)} (${item.id})`)
        const children = allPages.filter((p) => p.parentId === item.id)
        if (children.length) printDryRun(children, `${indent}  `)
      }
    }
    const roots = allPages.filter((p) => !p.parentId || p.parentId === pageId)
    printDryRun(roots.length > 0 ? roots : [allPages[0]!])
    console.log(chalk.yellow('\nDry run - no files written.'))
    return
  }

  if (options.overwrite) {
    const rootFolderName = sanitizeTitle(rootPage.title)
    const rootExportDir = path.join(baseDir, rootFolderName)
    if (fs.existsSync(rootExportDir)) {
      if (!isExportDirectory(rootExportDir)) {
        throw new Error(`Refusing to overwrite "${rootExportDir}" - it was not created by confluence-cli.`)
      }
      fs.rmSync(rootExportDir, { recursive: true, force: true })
    }
  }

  let exported = 0
  const failures: Array<{ id: string; title: string; error: string }> = []

  async function exportPage(page: { id: string; title: string }, dir: string): Promise<string> {
    exported++
    console.log(`[${exported}/${totalPages}] Exporting: ${chalk.blue(page.title)}`)

    const folderName = sanitizeTitle(page.title)
    let exportDir = path.join(dir, folderName)

    if (fs.existsSync(exportDir)) {
      let counter = 1
      while (fs.existsSync(`${exportDir} (${counter})`)) counter++
      exportDir = `${exportDir} (${counter})`
    }
    fs.mkdirSync(exportDir, { recursive: true })

    const apiFormat = format === 'markdown' || format === 'text' ? 'view' : 'storage'
    const pageContent = await pages.readPage(page.id, apiFormat)
    const content = pageContent.body.view?.value ?? pageContent.body.storage?.value ?? ''
    fs.writeFileSync(path.join(exportDir, contentFile), content)

    if (!options.skipAttachments) {
      const allAtts = await attachments.getAll(page.id)
      const pattern = options.pattern?.trim()
      const filtered = pattern ? allAtts.filter((att) => attachments.matchesPattern(att.title, pattern)) : allAtts

      if (filtered.length > 0) {
        const attDir = path.join(exportDir, options.attachmentsDir ?? 'attachments')
        fs.mkdirSync(attDir, { recursive: true })
        for (const att of filtered) {
          const targetPath = uniquePathFor(attDir, att.title)
          await attachments.download(page.id, att.downloadLink, targetPath)
        }
      }
    }

    return exportDir
  }

  // Export root
  let rootDir: string
  try {
    rootDir = await exportPage(rootPage, baseDir)
    writeExportMarker(rootDir, { pageId, title: rootPage.title })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(chalk.red(`  Failed: ${rootPage.title} - ${msg}`))
    throw new Error(`Failed to export root page: ${msg}`)
  }

  // Export descendants in tree order
  async function walkTree(parentId: string, parentDir: string): Promise<void> {
    const children = allPages.filter((p) => p.parentId === parentId && p.id !== rootPage.id)
    for (const child of children) {
      try {
        const childDir = await exportPage(child, parentDir)
        await walkTree(child.id, childDir)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        failures.push({ id: child.id, title: child.title, error: msg })
        console.error(chalk.red(`  Failed: ${child.title} - ${msg}`))
      }
      if (delayMs > 0 && exported < totalPages) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  await walkTree(pageId, rootDir)

  const succeeded = exported - failures.length
  console.log(chalk.green(`\nExported ${succeeded}/${totalPages} page(s) to ${rootDir}`))
  if (failures.length > 0) {
    console.log(chalk.red(`\n${failures.length} failure(s):`))
    for (const f of failures) {
      console.log(chalk.red(`  - ${f.title} (${f.id}): ${f.error}`))
    }
  }
}

export async function handleExport(
  pageId: string,
  options: {
    format?: string
    dest?: string
    file?: string
    attachmentsDir?: string
    pattern?: string
    referencedOnly?: boolean
    skipAttachments?: boolean
    recursive?: boolean
    maxDepth?: string
    exclude?: string
    delayMs?: string
    dryRun?: boolean
    overwrite?: boolean
  },
  analytics: Analytics,
): Promise<void> {
  const config = getConfig()
  const { pages, attachments } = buildClient(config)

  if (options.recursive) {
    await exportRecursive(pages, attachments, pageId, options)
    analytics.track('export', true)
    return
  }

  const format = (options.format ?? 'markdown').toLowerCase()
  const formatExt: Record<string, string> = { markdown: 'md', html: 'html', text: 'txt' }
  const contentExt = formatExt[format] ?? 'txt'

  const pageInfo = await pages.getPageInfo(pageId)
  const apiFormat = format === 'markdown' || format === 'text' ? 'view' : 'storage'
  const pageContent = await pages.readPage(pageId, apiFormat)
  const content = pageContent.body.view?.value ?? pageContent.body.storage?.value ?? ''

  const baseDir = path.resolve(options.dest ?? '.')
  const folderName = sanitizeTitle(pageInfo.title)
  const exportDir = path.join(baseDir, folderName)

  if (options.overwrite && fs.existsSync(exportDir)) {
    if (!isExportDirectory(exportDir)) {
      throw new Error(
        `Refusing to overwrite "${exportDir}" - it was not created by confluence-cli (missing ${EXPORT_MARKER}).`,
      )
    }
    fs.rmSync(exportDir, { recursive: true, force: true })
  }
  fs.mkdirSync(exportDir, { recursive: true })

  const contentFile = options.file ?? `page.${contentExt}`
  const contentPath = path.join(exportDir, contentFile)
  fs.writeFileSync(contentPath, content)
  writeExportMarker(exportDir, { pageId, title: pageInfo.title })

  console.log(chalk.green('Page exported'))
  console.log(`Title: ${chalk.blue(pageInfo.title)}`)
  console.log(`Content: ${chalk.gray(contentPath)}`)

  if (!options.skipAttachments) {
    const allAttachments = await attachments.getAll(pageId)
    const pattern = options.pattern?.trim()
    const filtered = pattern
      ? allAttachments.filter((att) => attachments.matchesPattern(att.title, pattern))
      : allAttachments

    if (filtered.length === 0) {
      console.log(chalk.yellow('No attachments to download.'))
    } else {
      const attachmentsDir = path.join(exportDir, options.attachmentsDir ?? 'attachments')
      fs.mkdirSync(attachmentsDir, { recursive: true })

      let downloaded = 0
      for (const att of filtered) {
        const targetPath = uniquePathFor(attachmentsDir, att.title)
        await attachments.download(pageId, att.downloadLink, targetPath)
        downloaded += 1
        console.log(`  ${chalk.green(att.title)} -> ${chalk.gray(targetPath)}`)
      }
      console.log(chalk.green(`Downloaded ${downloaded} attachment(s) to ${attachmentsDir}`))
    }
  }

  analytics.track('export', true)
}
