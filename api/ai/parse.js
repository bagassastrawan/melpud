/**
 * Vercel Serverless Function: /api/ai/parse
 * Fallback NLP berbasis Gemini API (Structured JSON Output) untuk perintah baru
 * yang belum dikenali parser lokal, tanpa mengekspos API key ke browser.
 */

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { ok: false, reason: 'GEMINI_NOT_CONFIGURED' },
      { status: 501 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: 'INVALID_JSON' }, { status: 400 });
  }

  const { text, outlets = [], products = [], activeBatches = [], today = '', learnedExamples = [] } = body || {};
  if (!text || typeof text !== 'string') {
    return Response.json({ ok: false, reason: 'EMPTY_TEXT' }, { status: 400 });
  }

  const examplesText = Array.isArray(learnedExamples) && learnedExamples.length > 0
    ? `\nContoh terlatih yang sudah dikonfirmasi benar oleh owner:\n${learnedExamples.slice(-10).map(ex => `- Input: "${ex.phrase}" -> Output: ${JSON.stringify(ex.parsed)}`).join('\n')}`
    : '';

  const systemPrompt = `Anda adalah parser perintah operasional untuk sistem konsinyasi pudding Melpud.
Tanggal hari ini: ${today}.
Outlet terdaftar: ${JSON.stringify(outlets.map(o => ({ id: o.id, name: o.name })))}.
Produk terdaftar: ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, price: p.price })))}.
Batch aktif saat ini: ${JSON.stringify(activeBatches.filter(b => b.status === 'ACTIVE').map(b => ({ id: b.id, outletId: b.outletId, date: b.date, qtyDrop: b.qtyDrop })))}.
${examplesText}

Klasifikasikan input owner menjadi SATU JSON valid dengan field:
- "action": salah satu dari "CREATE_DROP", "BATCH_CREATE_DROP", "RECONCILE_BATCH", "BATCH_RECONCILE_MULTI", "SETTLE_PAYMENT", "RECORD_EXPENSE", "QUERY_OUTLET_INFO", "QUERY_EXPENSES", "QUERY_REPORT", atau "PROMPT_CLARIFY"
- "title": ringkasan judul singkat bahasa Indonesia
- "summary": rincian yang jelas untuk konfirmasi 1-klik
- "data":
  - CREATE_DROP: { date, outletId, outletName, productId, productName, priceUnit, qtyDrop }
  - BATCH_CREATE_DROP: { date, items: [{ outletId, outletName, productId, productName, priceUnit, qtyDrop }] }
  - RECONCILE_BATCH: { outletId, outletName, qtyReturned, paymentStatus ("PAID"|"UNPAID") }
  - BATCH_RECONCILE_MULTI: { targetDate, items: [{ outletId, outletName, qtyReturned, paymentStatus ("PAID"|"UNPAID") }] }
  - SETTLE_PAYMENT: { outletId (atau "ALL"), outletName }
  - RECORD_EXPENSE: { date, category ("Bahan Baku Utama"|"Kemasan"|"Operasional Lainnya"), description, amount }
  - QUERY_OUTLET_INFO: { outletId (atau "ALL"), outletName, targetDate, targetDateLabel, dateWasExplicit }
  - QUERY_EXPENSES: { dates: [{ date, label }] }
  - QUERY_REPORT: { scope ("week"|"day"|"month"|"both"), targetDate }
  - PROMPT_CLARIFY: {} (pakai ini jika angka atau nama outlet ambigu agar tidak menghasilkan nilai salah!)

Aturan ketat: jangan pernah mengarang angka retur atau nominal; jika ragu atau angka tidak disebut, pilih PROMPT_CLARIFY.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nInput owner: "${text}"` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        })
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ ok: false, reason: `GEMINI_HTTP_${res.status}`, detail: errText.slice(0, 200) }, { status: 502 });
    }

    const json = await res.json();
    const rawOut = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = rawOut ? JSON.parse(rawOut) : null;
    return Response.json({ ok: true, parsed });
  } catch (err) {
    return Response.json({ ok: false, reason: 'GEMINI_PARSE_ERROR', detail: err.message }, { status: 502 });
  }
}
