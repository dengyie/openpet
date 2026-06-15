module.exports = function activate(ctx) {
  const decodeXml = (value) => String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  const cleanText = (value) => decodeXml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const truncate = (value, maxLength) => {
    const text = cleanText(value)
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text
  }

  const extractTag = (block, tagNames) => {
    for (const tagName of tagNames) {
      const match = String(block || '').match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
      if (match) return match[1]
    }
    return ''
  }

  const extractAtomLink = (block) => {
    const match = String(block || '').match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)
    return match ? match[1] : ''
  }

  const getBlocks = (xml, tagName) => Array.from(String(xml || '').matchAll(new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, 'gi'))).map((match) => match[0])

  const normalizeItem = (block) => ({
    title: cleanText(extractTag(block, ['title'])) || 'Untitled item',
    link: cleanText(extractTag(block, ['link']) || extractAtomLink(block)),
    publishedAt: cleanText(extractTag(block, ['pubDate', 'published', 'updated', 'dc:date'])),
    summary: truncate(extractTag(block, ['description', 'summary', 'content', 'content:encoded']), 180)
  })

  const parseFeed = (xml) => {
    const channel = extractTag(xml, ['channel']) || xml
    const itemBlocks = getBlocks(xml, 'item')
    const entryBlocks = itemBlocks.length ? [] : getBlocks(xml, 'entry')
    const items = (itemBlocks.length ? itemBlocks : entryBlocks).map(normalizeItem)
    return {
      title: cleanText(extractTag(channel, ['title'])) || 'RSS Feed',
      items
    }
  }

  const normalizeFeedPath = (value) => {
    const rawPath = String(value || '/openpet.xml').trim()
    if (!rawPath || rawPath.includes('://') || rawPath.includes('\\')) return '/openpet.xml'
    return rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  }

  const normalizeMaxItems = (value) => {
    const count = Number(value)
    return Number.isFinite(count) && count > 0 ? Math.min(Math.floor(count), 5) : 3
  }

  const formatItem = (feed, item) => {
    const summary = item.summary ? ` ${item.summary}` : ''
    return `${feed.title}: ${item.title}.${summary}`
  }

  return {
    refresh: async (payload = {}) => {
      const config = ctx.config.get()
      const feedPath = normalizeFeedPath(payload.feedPath || config.feedPath)
      const maxItems = normalizeMaxItems(payload.maxItems || config.maxItems)
      const url = `https://feeds.example.com${feedPath}`
      const response = await ctx.network.fetch(url, {
        headers: {
          accept: 'application/rss+xml, application/xml, text/xml'
        }
      })

      if (!response.ok) {
        throw new Error(`RSS feed request failed with status ${response.status}`)
      }

      const parsed = parseFeed(response.text || '{}')
      const feed = {
        title: parsed.title,
        sourceUrl: url,
        items: parsed.items.slice(0, maxItems)
      }
      const previousCount = await ctx.storage.get('refreshCount', 0)
      const refreshCount = Number(previousCount || 0) + 1
      await ctx.storage.set('lastFeed', feed)
      await ctx.storage.set('refreshCount', refreshCount)

      if (config.announce !== false) {
        const latestItem = feed.items[0]
        await ctx.pet.say(latestItem ? formatItem(feed, latestItem) : `${feed.title}: no items found.`)
      }

      return {
        ok: true,
        title: feed.title,
        sourceUrl: feed.sourceUrl,
        itemCount: feed.items.length,
        items: feed.items,
        refreshCount
      }
    },

    latest: async () => {
      const feed = await ctx.storage.get('lastFeed', null)
      const latestItem = feed?.items?.[0]
      if (!feed || !latestItem) {
        await ctx.pet.say('No RSS feed data yet.')
        return { ok: false, reason: 'missing' }
      }
      await ctx.pet.say(formatItem(feed, latestItem))
      return { ok: true, title: feed.title, sourceUrl: feed.sourceUrl, item: latestItem }
    }
  }
}
