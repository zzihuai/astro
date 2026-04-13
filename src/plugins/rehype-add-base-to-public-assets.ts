import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'

function withBase(base: string, path: string) {
  const normalizedBase = base === '/' ? '' : base.replace(/\/$/, '')
  return `${normalizedBase}${path}`
}

const rehypeAddBaseToPublicAssets: Plugin<[string?], Root> = function (base = '/') {
  return (tree) => {
    visit(tree, 'element', (node: Element) => {
      for (const key of ['href', 'src', 'xlink:href', 'xlinkHref'] as const) {
        const value = node.properties?.[key]
        if (typeof value !== 'string') continue
        if (!value.startsWith('/icons/')) continue
        if (value.startsWith(withBase(base, '/icons/'))) continue
        node.properties[key] = withBase(base, value)
      }
    })
  }
}

export default rehypeAddBaseToPublicAssets
