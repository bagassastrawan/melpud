/**
 * Supabase Configuration - Melpud
 */
export const SUPABASE_CONFIG = {
  url: '',
  publishableKey: ''
};

export async function getSupabaseConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.configured && data.url && data.publishableKey) {
        return { url: data.url, publishableKey: data.publishableKey };
      }
    }
  } catch {}
  return SUPABASE_CONFIG;
}
