export function getApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
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
