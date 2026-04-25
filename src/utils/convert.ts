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
    .trim();
}

/**
 * Convert HTML (Confluence view or storage format) to approximate Markdown.
 */
export function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<hr\s*\/?>/gi, '---\n\n');
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

/**
 * Convert Markdown to approximate Confluence storage format.
 */
export function markdownToStorage(markdown: string): string {
  let storage = markdown;
  storage = storage.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  storage = storage.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  storage = storage.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  storage = storage.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  storage = storage.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  storage = storage.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  storage = storage.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  storage = storage.replace(/\*(.+?)\*/g, '<em>$1</em>');
  storage = storage.replace(/`(.+?)`/g, '<code>$1</code>');
  storage = storage.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  storage = storage.replace(/^---$/gm, '<hr/>');
  storage = storage.replace(/\n{2,}/g, '</p><p>');
  return `<p>${storage}</p>`;
}

/**
 * Convert Markdown to HTML.
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^---$/gm, '<hr/>');
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');
  return `<p>${html}</p>`;
}
