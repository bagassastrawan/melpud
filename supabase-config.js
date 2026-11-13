
/**
 * Konfigurasi Koneksi Supabase - Melpud
 *
 * Environment Variables diatur melalui Vercel Dashboard.
 * Tidak memerlukan file .env lokal.
 */

export const SUPABASE_CONFIG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
};

// Validasi konfigurasi
if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.publishableKey) {
  console.error(
    'Supabase configuration is missing. Check Vercel Environment Variables.'
  );
}
