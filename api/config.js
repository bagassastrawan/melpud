
/**
 * Supabase Configuration API
 * Mengambil konfigurasi dari Vercel Environment Variables.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.SUPABASE_URL || '';

  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  if (!url || !publishableKey) {
    return Response.json(
      {
        configured: false,
        message: 'Supabase configuration is missing.'
      },
      { status: 503 }
    );
  }

  return Response.json(
    {
      configured: true,
      url,
      publishableKey
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  );
}
