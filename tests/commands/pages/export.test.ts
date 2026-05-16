import { describe, expect, test } from 'bun:test'
import { formatExportContent } from '../../../src/utils/convert'

describe('formatExportContent', () => {
  test('converts Confluence view HTML to markdown for markdown exports', () => {
    const html = '<h2>CLI Examples</h2><p>Use <strong>bold</strong> and &quot;quotes&quot;.</p>'

    expect(formatExportContent('markdown', html)).toBe('## CLI Examples\n\nUse **bold** and "quotes".')
  })

  test('converts Confluence pre blocks to fenced markdown code blocks', () => {
    const html = '<div class="code panel"><div class="codeContent panelContent"><pre>const x = &quot;y&quot;\nconsole.log(x)</pre></div></div>'

    expect(formatExportContent('markdown', html)).toBe('```\nconst x = "y"\nconsole.log(x)\n```')
  })

  test('converts Confluence view HTML to plain text for text exports', () => {
    const html = '<h2>CLI Examples</h2><p>Use <strong>bold</strong> and &quot;quotes&quot;.</p>'

    expect(formatExportContent('text', html)).toBe('CLI ExamplesUse bold and "quotes".')
  })

  test('leaves HTML exports unchanged', () => {
    const html = '<h2>CLI Examples</h2><p>Use <strong>bold</strong>.</p>'

    expect(formatExportContent('html', html)).toBe(html)
  })
})
