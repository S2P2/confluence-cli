export function buildWebUrl(domain: string, protocol: string, spaceKey: string, pageId: string): string {
  return `${protocol}://${domain}/wiki/spaces/${spaceKey}/pages/${pageId}`
}
