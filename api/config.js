
/**
 * Vercel Serverless Function: /api/config
 *
 * Mengambil konfigurasi Supabase dari Environment Variables Vercel.
 * Digunakan oleh frontend untuk mendapatkan Supabase URL dan Publishable Key.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      '';

    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    const configured = Boolean(url && publishableKey);

    if (!configured) {
      return Response.json(
        {
          configured: false,
          message: 'Supabase environment variables are not configured.'
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
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  } catch (error) {
    console.error('Supabase configuration error:', error);

    return Response.json(
      {
        configured: false,
        message: 'Failed to load Supabase configuration.'
      },
      { status: 500 }
    );
  }
}
