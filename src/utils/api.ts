export function getApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    const cap = (window as any).Capacitor;
    if (cap) {
      const hostedUrl = process.env.NEXT_PUBLIC_HOSTED_URL;
      if (hostedUrl) {
        const baseUrl = hostedUrl.endsWith('/') ? hostedUrl.slice(0, -1) : hostedUrl;
        return `${baseUrl}${path}`;
      }
      console.warn("Capacitor context detected but NEXT_PUBLIC_HOSTED_URL environment variable is not defined. API requests may fail.");
    }
  }
  return path;
}
