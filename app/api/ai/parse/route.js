import { NextResponse } from 'next/server';

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: 'GEMINI_NOT_CONFIGURED' }, { status: 501 });
  }
  try {
    const body = await request.json();
    return NextResponse.json({ ok: true, parsed: null });
  } catch {
    return NextResponse.json({ ok: false, reason: 'INVALID_JSON' }, { status: 400 });
  }
}
