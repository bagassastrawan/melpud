import { NextResponse } from 'next/server';

export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  return NextResponse.json({
    configured: Boolean(url && publishableKey),
    url,
    publishableKey
  });
}
