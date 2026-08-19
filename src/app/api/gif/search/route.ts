import { NextResponse } from 'next/server'

const GIPHY_API_KEY = process.env.GIPHY_API_KEY || 'LIVDSRZCmwh2iZ0sGNPkW6zb5vp87qqD' // fallback key

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '12')

    let url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&rating=g`
    if (query.trim()) {
      url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=g`
    }

    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Giphy API returned status: ${res.status}`)
    }

    const data = await res.json()
    const gifs = data.data.map((gif: any) => ({
      id: gif.id,
      title: gif.title,
      url: `https://i.giphy.com/media/${gif.id}/giphy.gif`,
      preview: `https://i.giphy.com/media/${gif.id}/200w.gif`,
    }))

    return NextResponse.json({ success: true, gifs })
  } catch (err: any) {
    console.error('Error fetching GIFs from Giphy:', err)
    
    // Permanent direct high-quality CDN fallback GIFs
    const fallbackGifs = [
      { id: 'Vz58J8shFW6zvQNtee', title: 'Hello Dance', url: 'https://i.giphy.com/media/Vz58J8shFW6zvQNtee/giphy.gif', preview: 'https://i.giphy.com/media/Vz58J8shFW6zvQNtee/200w.gif' },
      { id: '3oriO0OEd9QIDdllqo', title: 'Cat Wave', url: 'https://i.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif', preview: 'https://i.giphy.com/media/3oriO0OEd9QIDdllqo/200w.gif' },
      { id: '1dJWn5clQH9eG58e6t', title: 'Dog Happy', url: 'https://i.giphy.com/media/1dJWn5clQH9eG58e6t/giphy.gif', preview: 'https://i.giphy.com/media/1dJWn5clQH9eG58e6t/200w.gif' },
      { id: 'ddHhhUBn25cuQ', title: 'Yes Excited', url: 'https://i.giphy.com/media/ddHhhUBn25cuQ/giphy.gif', preview: 'https://i.giphy.com/media/ddHhhUBn25cuQ/200w.gif' },
      { id: '26tPoyDhVPYeCHTeU', title: 'Oh No Face', url: 'https://i.giphy.com/media/26tPoyDhVPYeCHTeU/giphy.gif', preview: 'https://i.giphy.com/media/26tPoyDhVPYeCHTeU/200w.gif' },
      { id: 'xT0xezQGU5RcCD33MY', title: 'Awesome Cool', url: 'https://i.giphy.com/media/xT0xezQGU5RcCD33MY/giphy.gif', preview: 'https://i.giphy.com/media/xT0xezQGU5RcCD33MY/200w.gif' },
    ]

    return NextResponse.json({ success: true, gifs: fallbackGifs })
  }
}
