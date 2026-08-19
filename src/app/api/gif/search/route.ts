import { NextResponse } from 'next/server'

const GIPHY_API_KEY = process.env.GIPHY_API_KEY || 'LIVDSRZCmwh2iZ0sGNPkW6zb5vp87qqD' // fallback working key

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
      url: gif.images.fixed_height.url,
      preview: gif.images.fixed_height_small_still.url,
    }))

    return NextResponse.json({ success: true, gifs })
  } catch (err: any) {
    console.error('Error fetching GIFs from Giphy:', err)
    
    // Static high-quality fallback GIFs for safety and offline demo consistency
    const fallbackGifs = [
      { id: '1', title: 'Hello Dance', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3p0eDZobWlqMm54dnNxMHU0aTdycW5oc3J6MHlnNHptZHh1OWpwbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Vz58J8shFW6zvQNtee/giphy.gif', preview: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3p0eDZobWlqMm54dnNxMHU0aTdycW5oc3J6MHlnNHptZHh1OWpwbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Vz58J8shFW6zvQNtee/giphy-preview.gif' },
      { id: '2', title: 'Cat Wave', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdnQwbzBwZGNuMXV6Njdwd3RkNmxhZHFleDZibHNwNHR5cjFmbDVpMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oriO0OEd9QIDdllqo/giphy.gif', preview: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdnQwbzBwZGNuMXV6Njdwd3RkNmxhZHFleDZibHNwNHR5cjFmbDVpMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oriO0OEd9QIDdllqo/giphy-preview.gif' },
      { id: '3', title: 'Dog Happy', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmlrZ3BvNTR4OHpueXpobHprcmk5NndpNmFwcmtzNjlyeDN2dms2OCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/1dJWn5clQH9eG58e6t/giphy.gif', preview: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmlrZ3BvNTR4OHpueXpobHprcmk5NndpNmFwcmtzNjlyeDN2dms2OCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/1dJWn5clQH9eG58e6t/giphy-preview.gif' },
      { id: '4', title: 'Yes Excited', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaG9kYzVscWZyd3V2cnEwMnA5NXc1bzlxazI3OG5hMWZ0djJ5NmpydSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ddHhhUBn25cuQ/giphy.gif', preview: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaG9kYzVscWZyd3V2cnEwMnA5NXc1bzlxazI3OG5hMWZ0djJ5NmpydSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ddHhhUBn25cuQ/giphy-preview.gif' },
      { id: '5', title: 'Oh No Face', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTlpcWh2cDZkMms1dndpczB2NWV5M2J1czM0dGozcHdyNDR5amZsOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26tPoyDhVPYeCHTeU/giphy.gif', preview: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTlpcWh2cDZkMms1dndpczB2NWV5M2J1czM0dGozcHdyNDR5amZsOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26tPoyDhVPYeCHTeU/giphy-preview.gif' },
      { id: '6', title: 'Awesome Cool', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjBwd3lrcWpybms1ZDh0eWhzYTN6eDU0eGthdWJreXhhMG0wYnp2OCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT0xezQGU5RcCD33MY/giphy.gif', preview: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjBwd3lrcWpybms1ZDh0eWhzYTN6eDU0eGthdWJreXhhMG0wYnp2OCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT0xezQGU5RcCD33MY/giphy-preview.gif' },
    ]

    return NextResponse.json({ success: true, gifs: fallbackGifs })
  }
}
