import { createClient } from '@/utils/supabase/client'

export function getApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    // If we are on localhost with a port (like :3000 or :3001), always use relative paths for local testing
    if (window.location.hostname === 'localhost' && window.location.port) {
      return path;
    }

    // Detect Capacitor environment reliably
    const isCapacitor = 
      (window as any).Capacitor || 
      window.location.protocol === 'capacitor:' || 
      (window.location.hostname === 'localhost' && !window.location.port && window.location.protocol !== 'https:');

    if (isCapacitor) {
      const hostedUrl = process.env.NEXT_PUBLIC_HOSTED_URL || 'https://calendar-app22.vercel.app';
      const baseUrl = hostedUrl.endsWith('/') ? hostedUrl.slice(0, -1) : hostedUrl;
      return `${baseUrl}${path}`;
    }
  }
  return path;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    if (session?.refresh_token) {
      headers['x-refresh-token'] = session.refresh_token
    }
  } catch (e) {
    console.error('Error fetching auth session for headers:', e)
  }
  
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('private_space_token')
    if (token) {
      headers['x-private-space-token'] = token
    }
  }
  return headers
}
