import path from 'node:path';

export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed';
  const stripped = path.basename(filename.replace(/\\/g, '/'));
  const cleaned = stripped
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  return cleaned || 'unnamed';
}

export function sanitizeTitle(value: string): string {
  if (!value) return 'page';
  const cleaned = value
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ')
    .replace(/^\.+/, '')
    .trim();
  return cleaned || 'page';
}