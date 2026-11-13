/**
 * Vercel Serverless Function: /api/config
 * Mengambil Supabase URL & Anon Key dari Environment Variables Vercel
 * agar frontend tidak perlu konfigurasi manual di file kode.
 */

export async function GET(request) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const publishableKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return Response.json({
    configured: Boolean(url && publishableKey),
    url,
    publishableKey
  });
}
