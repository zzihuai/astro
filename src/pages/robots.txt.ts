import type { APIRoute } from 'astro'

const basePath = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`
const siteUrl = new URL(basePath, import.meta.env.SITE)

const robotsTxt = `
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Claude-Web

User-agent: *
Allow: /

Sitemap: ${new URL('sitemap-index.xml', siteUrl).href}
`.trim()

export const GET: APIRoute = () =>
  new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  })
