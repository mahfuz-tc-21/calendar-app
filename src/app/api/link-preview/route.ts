import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    // Validate URL format
    const parsedUrl = new URL(targetUrl)
    
    // Fetch target URL with a timeout
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 4000) // 4s timeout

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    })

    clearTimeout(id)

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      // If it's an image or something else, return basic info
      return NextResponse.json({
        title: parsedUrl.hostname,
        url: targetUrl,
        siteName: parsedUrl.hostname
      })
    }

    const html = await response.text()

    // Parse metadata
    let title = ''
    let description = ''
    let image = ''
    let siteName = parsedUrl.hostname

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim()
    }

    // Process meta tags
    const metaTagRegex = /<meta\s+[^>]*>/gi
    let match
    while ((match = metaTagRegex.exec(html)) !== null) {
      const tag = match[0]
      
      const getAttr = (attrName: string) => {
        const regex = new RegExp(`${attrName}=["']([^"']+)["']`, 'i')
        const m = tag.match(regex)
        return m ? m[1] : null
      }

      const property = getAttr('property')
      const name = getAttr('name')
      const content = getAttr('content')

      if (content) {
        const decodedContent = content
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim()

        if (property === 'og:title' || name === 'twitter:title') {
          title = decodedContent
        } else if (property === 'og:description' || name === 'description' || name === 'twitter:description') {
          description = decodedContent
        } else if (property === 'og:image' || name === 'twitter:image') {
          image = decodedContent
        } else if (property === 'og:site_name') {
          siteName = decodedContent
        }
      }
    }

    // Clean up title if it contains HTML entities
    title = title
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")

    // If image is relative, resolve it to absolute
    if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
      try {
        if (image.startsWith('//')) {
          image = `${parsedUrl.protocol}${image}`
        } else if (image.startsWith('/')) {
          image = `${parsedUrl.origin}${image}`
        } else {
          // Resolve relative path
          const pathParts = parsedUrl.pathname.split('/')
          pathParts.pop() // Remove filename
          const basePath = pathParts.join('/')
          image = `${parsedUrl.origin}${basePath}/${image}`
        }
      } catch (e) {
        console.warn('Failed to resolve relative image URL:', image, e)
      }
    }

    return NextResponse.json({
      title: title || parsedUrl.hostname,
      description: description || '',
      image: image || '',
      siteName: siteName || parsedUrl.hostname,
      url: targetUrl
    })
  } catch (err: any) {
    console.error('Error fetching link preview:', err)
    let fallbackHostname = 'Link'
    try {
      if (targetUrl) {
        fallbackHostname = new URL(targetUrl).hostname
      }
    } catch {}

    return NextResponse.json({
      title: fallbackHostname,
      url: targetUrl || '',
      siteName: fallbackHostname,
      error: err.message || 'Could not fetch metadata'
    })
  }
}
