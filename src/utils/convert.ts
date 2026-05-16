import TurndownService from 'turndown'

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  fence: '```',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
})

turndownService.addRule('confluencePreBlocks', {
  filter: 'pre',
  replacement: (_content, node) => {
    const code = (node.textContent ?? '').replace(/\n$/, '')
    return `\n\n\`\`\`\n${code}\n\`\`\`\n\n`
  },
})

/**
 * Strip HTML tags and decode entities to plain text.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Convert HTML (Confluence view or storage format) to approximate Markdown.
 */
export function htmlToMarkdown(html: string): string {
  return turndownService
    .turndown(html)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Convert Confluence export content into the requested output format.
 */
export function formatExportContent(format: string, html: string): string {
  if (format === 'markdown') return htmlToMarkdown(html)
  if (format === 'text') return htmlToPlainText(html)
  return html
}

/**
 * Convert Markdown to approximate Confluence storage format.
 */
export function markdownToStorage(markdown: string): string {
  const blocks = splitBlocks(markdown)
  return blocks
    .map((block) => {
      const html = applyInlineFormatting(block)
      if (/^<h[1-6]>|^<hr\/>/.test(html)) return html
      return `<p>${html}</p>`
    })
    .join('')
}

/**
 * Convert Markdown to HTML.
 */
export function markdownToHtml(markdown: string): string {
  const blocks = splitBlocks(markdown)
  return blocks
    .map((block) => {
      let html = applyInlineFormatting(block)
      html = html.replace(/\n/g, '<br/>')
      if (/^<h[1-6]>|^<hr\/>/.test(html)) return html
      return `<p>${html}</p>`
    })
    .join('')
}

function splitBlocks(markdown: string): string[] {
  let text = markdown
  text = text.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
  text = text.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
  text = text.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
  text = text.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  text = text.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  text = text.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
  text = text.replace(/^---$/gm, '<hr/>')
  return text.split(/\n{2,}/).filter(Boolean)
}

function applyInlineFormatting(text: string): string {
  let html = text
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/`(.+?)`/g, '<code>$1</code>')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  return html
}
