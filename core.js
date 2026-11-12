/**
 * Melpud Management System - Core Business Logic & Financial Engine
 * PRD v2.0 Specification
 */

export const INITIAL_OUTLETS = [
  { id: 'p-bungin', name: 'P. BUNGIN', contact: '0812-3456-7890', active: true },
  { id: 'p-moyo-conato', name: 'P. MOYO CONATO', contact: '0813-9876-5432', active: true },
  { id: 'p-singkep', name: 'P. SINGKEP', contact: '0811-2233-4455', active: true },
  { id: 'bubuh-bali', name: 'BUBUH BALI', contact: '0878-6543-2109', active: true },
  { id: 'skensa-mami', name: 'SKENSA MAMI', contact: '0857-1122-3344', active: true }
];

export const INITIAL_PRODUCTS = [
  { id: 'pudding-coklat', name: 'Pudding Coklat', price: 5000 }
];

export const EXPENSE_CATEGORIES = [
  'Bahan Baku Utama',
  'Kemasan',
  'Operasional Lainnya'
];

/**
 * Format currency to Indonesian Rupiah (Rp X.XXX)
 */
export function formatRupiah(amount) {
  const num = Math.round(Number(amount) || 0);
  return 'Rp ' + num.toLocaleString('id-ID');
}

/**
 * Calculate financial summary based on cash-basis and consignment rules:
 * - Piutang Berjalan: SUM(Qty Terjual * Harga Satuan) for all UNPAID batches
 * - Kas Masuk Riil: SUM(Qty Terjual * Harga Satuan) for all PAID batches
 * - Total Pengeluaran: SUM(Amount) for all expenses
 * - Saldo Kas Bersih Riil: Kas Masuk Riil - Total Pengeluaran
 * - Proyeksi Laba Total (Accrual): (Kas Masuk Riil + Total Piutang) - Total Pengeluaran
 */
export function calculateFinancialSummary(batches, expenses) {
  let totalReceivables = 0; // Piutang Berjalan (UNPAID)
  let realCashIn = 0;       // Kas Masuk Riil (PAID)
  
  for (const b of batches) {
    const qtySold = b.status === 'RECONCILED'
      ? Math.max(0, (b.qtyDrop || 0) - (b.qtyReturned || 0))
      : 0;
    const bill = qtySold * (b.priceUnit || 5000);

    if (b.status === 'RECONCILED') {
      if (b.paymentStatus === 'PAID') {
        realCashIn += bill;
      } else if (b.paymentStatus === 'UNPAID') {
        totalReceivables += bill;
      }
    }
  }

  let totalExpenses = 0;
  for (const exp of expenses) {
    totalExpenses += Number(exp.amount) || 0;
  }

  const netCash = realCashIn - totalExpenses;
  const projectedProfit = (realCashIn + totalReceivables) - totalExpenses;
  const lowCashWarning = netCash < 50000;

  return {
    totalReceivables,
    realCashIn,
    totalExpenses,
    netCash,
    projectedProfit,
    lowCashWarning
  };
}

/**
 * Match outlet by loose text (e.g. "p bungin" -> "P. BUNGIN", "skensa" -> "SKENSA MAMI")
 */
export function matchOutlet(text, outlets) {
  if (!text) return null;
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const exact = outlets.find(o => {
    const oClean = o.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean.includes(oClean) || oClean.includes(clean);
  });
  if (exact) return exact;

  const lowerWords = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return outlets.find(o => {
    const tokens = o.name.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4);
    return tokens.some(t => lowerWords.includes(t));
  }) || null;
}

/**
 * Temukan seluruh kemunculan outlet dalam kalimat beserta posisi karakter (terurut kemunculan).
 */
export function findAllOutletMatches(text, outlets) {
  if (!text || !Array.isArray(outlets)) return [];
  const lower = text.toLowerCase();
  const found = [];

  for (const outlet of outlets) {
    const words = outlet.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const patterns = [];
    if (words.length > 0) {
      patterns.push(words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?:\\.|\\s)*'));
    }
    words.filter(w => w.length >= 4).forEach(w => {
      patterns.push(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    });

    let bestMatch = null;
    for (const pat of patterns) {
      const re = new RegExp(`\\b${pat}\\b`, 'gi');
      const m = re.exec(lower);
      if (m) {
        if (!bestMatch || m.index < bestMatch.index || (m.index === bestMatch.index && m[0].length > bestMatch.length)) {
          bestMatch = { outlet, index: m.index, length: m[0].length };
        }
      }
    }
    if (bestMatch) found.push(bestMatch);
  }

  return found.sort((a, b) => a.index - b.index);
}
/**
 * Match product by loose text
 */
export function matchProduct(text, products) {
  if (!text) return products[0] || null;
  const clean = text.toLowerCase();
  for (const p of products) {
    const pWords = p.name.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
    if (clean.includes(p.name.toLowerCase()) || pWords.some(w => w !== 'pudding' && clean.includes(w))) {
      return p;
    }
  }
  return products[0] || null;
}

/**
 * Parse Indonesian currency amount from text (e.g. "45rb" -> 45000, "25k" -> 25000, "Rp 50.000" -> 50000)
 */
export function parseAmount(text) {
  if (!text) return 0;
  const str = text.toLowerCase().trim();

  const matchK = str.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
  if (matchK) {
    const val = parseFloat(matchK[1].replace(',', '.'));
    return Math.round(val * 1000);
  }

  const matchDot = str.match(/\b(\d{1,3}(?:\.\d{3})+)\b/);
  if (matchDot) {
    return parseInt(matchDot[1].replace(/\./g, ''), 10);
  }

  const matchRp = str.match(/(?:rp\.?\s*|habis\s+|sebesar\s+)(\d[\d.,]*)/i);
  if (matchRp) {
    const rawDigits = matchRp[1].replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(rawDigits) || 0);
  }

  const matchPlain = str.match(/\b(\d{4,9})\b/);
  if (matchPlain) {
    return parseInt(matchPlain[1], 10);
  }

  return 0;
}

/**
 * Categorize expense description into 3 PRD categories:
 * - Bahan Baku Utama: susu, coklat, agar-agar, gula, perasa
 * - Kemasan: cup, sendok, plastik, kardus, stiker, kresek
 * - Operasional Lainnya: bensin, transport, listrik, dll
 */
export function categorizeExpense(desc) {
  const s = (desc || '').toLowerCase();
  if (s.includes('cup') || s.includes('sendok') || s.includes('plastik') || s.includes('stiker') || s.includes('kardus') || s.includes('kemasan')) {
    return 'Kemasan';
  }
  if (s.includes('bensin') || s.includes('parkir') || s.includes('transport') || s.includes('ongkir') || s.includes('operasional')) {
    return 'Operasional Lainnya';
  }
  return 'Bahan Baku Utama';
}

/**
 * Ekstrak seluruh tanggal yang disebut dalam kalimat (mendukung "hari ini dan tanggal 9 nov").
 */
export function extractDatesFromText(text, refDateStr = new Date().toISOString().slice(0, 10)) {
  const lower = (text || '').toLowerCase();
  const [refYear, refMonth] = refDateStr.split('-');
  const hits = [];

  const addHit = (index, date, label) => {
    hits.push({ index, date, label, explicit: true });
  };

  const todayRe = /\b(?:di\s*hari\s*ini|hari\s*ini|hr\s*ini|sekarang)\b/gi;
  for (const m of lower.matchAll(todayRe)) addHit(m.index, refDateStr, 'Hari ini');

  const yestRe = /\bkemarin\b/gi;
  for (const m of lower.matchAll(yestRe)) {
    const yStr = new Date(Date.parse(refDateStr + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
    addHit(m.index, yStr, 'Kemarin');
  }

  for (const m of lower.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)) {
    addHit(m.index, m[1], m[1]);
  }

  for (const m of lower.matchAll(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g)) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    addHit(m.index, `${m[3]}-${mm}-${dd}`, `${dd}/${mm}/${m[3]}`);
  }

  const monthMap = {
    jan: '01', januari: '01', feb: '02', februari: '02', mar: '03', maret: '03',
    apr: '04', april: '04', mei: '05', jun: '06', juni: '06', jul: '07', juli: '07',
    agu: '08', agt: '08', agustus: '08', sep: '09', sept: '09', september: '09',
    okt: '10', oktober: '10', nov: '11', november: '11', des: '12', desember: '12'
  };
  const monthTextRe = /\b(\d{1,2})\s+(januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|agt|september|sept|sep|oktober|okt|november|nov|desember|des)\b/gi;
  for (const m of lower.matchAll(monthTextRe)) {
    const dd = m[1].padStart(2, '0');
    const mm = monthMap[m[2].toLowerCase()];
    addHit(m.index, `${refYear}-${mm}-${dd}`, `${m[1]} ${m[2]}`);
  }

  for (const m of lower.matchAll(/\b(?:tanggal|tgl)\s*(\d{1,2})\b/gi)) {
    const dd = m[1].padStart(2, '0');
    const dateStr = `${refYear}-${refMonth}-${dd}`;
    if (!hits.some(h => Math.abs(h.index - m.index) <= 12 && h.date === dateStr)) {
      addHit(m.index, dateStr, `Tgl ${m[1]}`);
    }
  }

  hits.sort((a, b) => a.index - b.index);
  const seen = new Set();
  return hits.filter(h => {
    if (seen.has(h.date)) return false;
    seen.add(h.date);
    return true;
  });
}

/**
 * Ekstrak tanggal utama dari kalimat.
 */
export function extractDateFromText(text, refDateStr = new Date().toISOString().slice(0, 10)) {
  const hits = extractDatesFromText(text, refDateStr);
  return hits[0] || { date: refDateStr, label: 'Hari ini', explicit: false };
}

function detectPayStatus(segment, fallback = 'UNPAID') {
  if (/\b(?:belom|belum)\s*(?:di)?bayar|belom\s*membayar|belum\s*membayar|unpaid|piutang\b/i.test(segment)) {
    return 'UNPAID';
  }
  if (/\b(?:sudah\s*(?:di)?bayar|lunas|paid|cash|tunai)\b/i.test(segment)) {
    return 'PAID';
  }
  return fallback;
}
function stripDateTokens(segment) {
  return (segment || '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/g, ' ')
    .replace(/\b\d{1,2}\s+(?:januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|agt|september|sept|sep|oktober|okt|november|nov|desember|des)\b/gi, ' ')
    .replace(/\b(?:tanggal|tgl)\s*\d{1,2}\b/gi, ' ');
}

function extractReturnQty(segment, allowBareNumber = false) {
  const cleanSeg = stripDateTokens(segment);
  if (/tidak\s*ada\s*(?:returns?|retur|sisa)|tanpa\s*(?:returns?|retur|sisa)|habis\s*semua/i.test(cleanSeg)) {
    return 0;
  }
  const m = cleanSeg.match(/(?:sisa|returns?|retur|kembali)\s*(\d+)/i)
    || cleanSeg.match(/(\d+)\s*(?:cup|pcs)?\s*(?:sisa|returns?|retur)/i);
  if (m) return parseInt(m[1], 10);
  if (allowBareNumber) {
    const bare = cleanSeg.match(/\b(\d+)\b/);
    if (bare) return parseInt(bare[1], 10);
  }
  return null;
}
/**
 * AI Smart Quick-Log NLP Parser (Natural Language Processing for Indonesian field input)
 */
export function parseNLPCommand(rawText, outlets, products, activeBatches = [], refDateStr = new Date().toISOString().slice(0, 10)) {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const dateInfo = extractDateFromText(text, refDateStr);
  const allDates = extractDatesFromText(text, refDateStr);
  const outletMatches = findAllOutletMatches(text, outlets);

  // A. QUERY_REPORT: "berikan daftar laporan minggu ini / hari ini"
  if (/\b(?:laporan|rekap)\b/i.test(lower) && !/\b(?:taruh|titip|drop|keluarin|belanja|beli)\b/i.test(lower)) {
    const hasWeek = /\bminggu(?:an)?\b/i.test(lower);
    const hasToday = /\b(?:hari\s*ini|hr\s*ini)\b/i.test(lower);
    const hasMonth = /\bbulan(?:an)?\b/i.test(lower);
    const scope = (hasWeek && hasToday) ? 'both' : (hasWeek ? 'week' : (hasToday ? 'day' : (hasMonth ? 'month' : 'week')));
    return {
      action: 'QUERY_REPORT',
      confidence: 0.94,
      title: 'Daftar Laporan Operasional',
      summary: `Laporan periode ${scope === 'both' ? 'minggu ini & hari ini' : scope}`,
      data: { scope, targetDate: dateInfo.date }
    };
  }

  // B. QUERY_EXPENSES: "daftar belanja hari ini dan tanggal ini berapa"
  if (
    /\b(?:daftar|list|cek|lihat|riwayat|history)\s*(?:belanja|pengeluaran)\b/i.test(lower) ||
    (/\b(?:belanja|pengeluaran)\b/i.test(lower) && /\b(?:berapa|mana|apa\s*saja)\b/i.test(lower))
  ) {
    const dates = allDates.length > 0 ? allDates : [{ date: refDateStr, label: 'Hari ini', explicit: false }];
    return {
      action: 'QUERY_EXPENSES',
      confidence: 0.94,
      title: 'Daftar Belanja & Pengeluaran',
      summary: `Rincian belanja untuk ${dates.map(d => d.label).join(', ')}`,
      data: { dates }
    };
  }

  // C. Multi-Outlet / Bulk / Single Reconciliation (Commands 1, 4, 5, 6 + existing RECONCILE_BATCH)
  const hasAllOutlets = /\bsemua\s*outlet\b/i.test(lower);
  const hasReturnWord = /\b(?:sisa|returns?|retur|kembali)\b/i.test(lower);
  const hasCollected = /\b(?:sudah\s*diambil|diambil)\b/i.test(lower);
  const hasExcept = /\bkecuali\b/i.test(lower);
  const isMultiOutletReconcile = outletMatches.length >= 2 && (hasReturnWord || /\b(?:bayar|lunas|unpaid|paid)\b/i.test(lower));
  const isBulkAllOutlets = hasAllOutlets && (hasReturnWord || hasCollected || hasExcept || /\b(?:belom|belum)\s*(?:di)?bayar|belom\s*membayar|belum\s*membayar\b/i.test(lower));

  if (isMultiOutletReconcile || isBulkAllOutlets) {
    const prefix = outletMatches.length > 0 ? lower.slice(0, outletMatches[0].index) : lower;
    const globalPay = detectPayStatus(prefix, detectPayStatus(lower, 'UNPAID'));
    const items = [];

    if (isMultiOutletReconcile && !hasExcept && !hasCollected && !/tidak\s*ada\s*(?:returns?|retur|sisa)/i.test(prefix)) {
      // Per-outlet clauses (Commands 5, 6, & multi-outlet return confirmation)
      for (let i = 0; i < outletMatches.length; i++) {
        const m = outletMatches[i];
        const nextIdx = i + 1 < outletMatches.length ? outletMatches[i + 1].index : lower.length;
        const segAfterOutlet = lower.slice(m.index + m.length, nextIdx);
        const qty = extractReturnQty(segAfterOutlet, hasReturnWord);
        if (qty === null) {
          return {
            action: 'PROMPT_CLARIFY',
            title: 'Lengkapi Jumlah Sisa / Return',
            summary: `Sebutkan jumlah sisa/return untuk ${m.outlet.name} (contoh: "${m.outlet.name.toLowerCase()} sisa 2 belum bayar").`
          };
        }
        items.push({
          outletId: m.outlet.id,
          outletName: m.outlet.name,
          qtyReturned: qty,
          paymentStatus: detectPayStatus(segAfterOutlet, globalPay)
        });
      }
    } else if (hasExcept) {
      // Command 4A: "semua outlet tidak ada return kecuali outlet X"
      const exceptIdx = lower.indexOf('kecuali');
      const excludedMap = new Map();
      for (let i = 0; i < outletMatches.length; i++) {
        const m = outletMatches[i];
        if (m.index >= exceptIdx) {
          const nextIdx = i + 1 < outletMatches.length ? outletMatches[i + 1].index : lower.length;
          const seg = lower.slice(m.index, nextIdx);
          excludedMap.set(m.outlet.id, {
            qty: extractReturnQty(seg),
            pay: detectPayStatus(seg, globalPay)
          });
        }
      }

      const activeTargets = activeBatches.filter(b => b.status === 'ACTIVE');
      const seenOutlets = new Set();
      for (const b of activeTargets) {
        if (seenOutlets.has(b.outletId)) continue;
        seenOutlets.add(b.outletId);
        const outletObj = outlets.find(o => o.id === b.outletId);
        const exc = excludedMap.get(b.outletId);
        if (exc) {
          if (exc.qty !== null) {
            items.push({
              batchId: b.id,
              outletId: b.outletId,
              outletName: outletObj ? outletObj.name : b.outletId,
              qtyReturned: exc.qty,
              paymentStatus: exc.pay
            });
          }
          continue;
        }
        items.push({
          batchId: b.id,
          outletId: b.outletId,
          outletName: outletObj ? outletObj.name : b.outletId,
          qtyReturned: 0,
          paymentStatus: globalPay
        });
      }
    } else if (/tidak\s*ada\s*(?:returns?|retur|sisa)|tanpa\s*(?:returns?|retur|sisa)/i.test(lower) || hasCollected) {
      // Command 1 & 4A without exception: "semua outlet tanggal sekian sudah diambil tapi belom dibayar"
      const activeOnly = activeBatches.filter(b => b.status === 'ACTIVE');
      const datedMatches = dateInfo.explicit ? activeOnly.filter(b => b.date === dateInfo.date) : activeOnly;
      const targets = datedMatches.length > 0
        ? datedMatches
        : (dateInfo.explicit ? activeOnly.filter(b => b.date <= dateInfo.date) : activeOnly);

      for (const b of targets) {
        const outletObj = outlets.find(o => o.id === b.outletId);
        items.push({
          batchId: b.id,
          outletId: b.outletId,
          outletName: outletObj ? outletObj.name : b.outletId,
          qtyReturned: 0,
          paymentStatus: globalPay,
          date: b.date
        });
      }
    } else {
      // Command 4B: "semua outlet return [N] dan belom dibayar"
      const globalQty = extractReturnQty(lower);
      if (globalQty === null) {
        return {
          action: 'PROMPT_CLARIFY',
          title: 'Sebutkan Jumlah Return',
          summary: 'Tuliskan jumlah return masing-masing atau angka globalnya, misal: "semua outlet return 2 dan belom dibayar" atau "p bungin sisa 2, skensa mami sisa 1 belom bayar".'
        };
      }
      const activeOnly = activeBatches.filter(b => b.status === 'ACTIVE');
      for (const b of activeOnly) {
        const outletObj = outlets.find(o => o.id === b.outletId);
        items.push({
          batchId: b.id,
          outletId: b.outletId,
          outletName: outletObj ? outletObj.name : b.outletId,
          qtyReturned: globalQty,
          paymentStatus: globalPay
        });
      }
    }

    if (items.length === 0) {
      return {
        action: 'PROMPT_CLARIFY',
        title: 'Tidak Ada Batch Aktif',
        summary: `Tidak ditemukan batch ACTIVE yang cocok untuk diproses (${dateInfo.label}).`
      };
    }

    const lines = items.map(it => `${it.outletName}: sisa ${it.qtyReturned} (${it.paymentStatus})`).join('; ');
    return {
      action: 'BATCH_RECONCILE_MULTI',
      confidence: 0.93,
      title: `Update Massal ${items.length} Transaksi Outlet`,
      summary: lines,
      data: { items, targetDate: dateInfo.date }
    };
  }

  // 1. Single-outlet RECONCILE_BATCH check: "sisa", "retur", "return", "kembali"
  if (hasReturnWord) {
    const matched = matchOutlet(lower, outlets);
    const qtyReturned = extractReturnQty(lower) ?? 0;
    const paymentStatus = detectPayStatus(lower, 'UNPAID');

    if (matched) {
      return {
        action: 'RECONCILE_BATCH',
        confidence: 0.92,
        title: 'Rekonsiliasi & Retur Outlet',
        summary: `Rekonsiliasi ${matched.name}: sisa ${qtyReturned} cup, status ${paymentStatus === 'PAID' ? 'PAID (Lunas)' : 'UNPAID (Piutang)'}`,
        data: {
          outletId: matched.id,
          outletName: matched.name,
          qtyReturned,
          paymentStatus
        }
      };
    }
  }

  // 2. SETTLE_PAYMENT check: "lunas", "lunasi", "sudah bayar", "transfer masuk"
  if (lower.includes('lunas') || lower.includes('sudah bayar') || lower.includes('transfer masuk')) {
    if (hasAllOutlets) {
      const unpaidCount = activeBatches.filter(b => b.status === 'RECONCILED' && b.paymentStatus === 'UNPAID').length;
      return {
        action: 'SETTLE_PAYMENT',
        confidence: 0.94,
        title: 'Lunasi Semua Hutang Seluruh Outlet',
        summary: `Lunasi seluruh tagihan UNPAID di semua outlet (${unpaidCount} nota belum terbayar)`,
        data: { outletId: 'ALL', outletName: 'Semua Outlet', unpaidCount }
      };
    }
    const matched = matchOutlet(lower, outlets);
    if (matched) {
      const billing = getOutletBillingStatus(matched.id, activeBatches, refDateStr);
      const detailText = billing.unpaidCount > 0
        ? `Lunasi seluruh hutang ${matched.name} (${billing.unpaidCount} nota belum terbayar, total ${formatRupiah(billing.unpaidTotal)})`
        : `Tandai semua tagihan ${matched.name} LUNAS (PAID)`;
      return {
        action: 'SETTLE_PAYMENT',
        confidence: 0.95,
        title: 'Lunasi Semua Hutang Outlet',
        summary: detailText,
        data: {
          outletId: matched.id,
          outletName: matched.name,
          unpaidCount: billing.unpaidCount,
          unpaidTotal: billing.unpaidTotal
        }
      };
    }
    return {
      action: 'PROMPT_CLARIFY',
      title: 'Sebutkan Nama Outlet',
      summary: `Tuliskan nama outletnya agar saya bisa lunasi semua hutangnya (contoh: "di outlet ${outlets[0]?.name?.toLowerCase() || 'p bungin'} lunas semua").`
    };
  }

  // 3. RECORD_EXPENSE check
  if (
    lower.includes('keluarin') || lower.includes('mengeluarkan') || lower.includes('pengeluaran') ||
    lower.includes('keluar uang') || lower.includes('belanja') || lower.includes('beli') ||
    lower.includes('biaya') || lower.includes('bensin') || lower.includes('habis')
  ) {
    const totalMatch = lower.match(/total\s*(?:rp\.?\s*)?(\d+(?:[.,]\d+)?\s*(?:rb|ribu|k)?)/i);
    const amount = totalMatch ? parseAmount(totalMatch[1]) : parseAmount(lower);
    const category = categorizeExpense(lower);

    let desc = text
      .replace(/^.*?(?:untuk\s+belanja\s+kebutuhan|untuk\s+belanja|untuk\s+kebutuhan|buat\s+belanja|buat\s+beli|belanja|beli|kebutuhan|biaya|pengeluaran)\s+/i, '')
      .replace(/^(?:saya\s+)?(?:keluarin|keluar|mengeluarkan)\s+(?:uang\s+)?/i, '')
      .replace(/\b(?:di\s*hari\s*ini|hari\s*ini|hr\s*ini|kemarin)\b/gi, '')
      .replace(/\btotal\s*(?:rp\.?\s*)?\d[\d.,]*\s*(?:rb|ribu|k)?\b/gi, '')
      .replace(/(?:habis\s+|sebesar\s+)?(?:rp\.?\s*)\d[\d.,]*\s*(?:rb|ribu|k)?\b/gi, '')
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:rb|ribu|k)\b/gi, '')
      .replace(/\b\d{1,3}(?:\.\d{3})+\b/g, '')
      .replace(/\b\d{4,9}\b/g, '')
      .replace(/\b(?:habis|sebesar|total)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!desc) {
      desc = category === 'Kemasan' ? 'Kemasan & Cup' : (category === 'Operasional Lainnya' ? 'Bensin Operasional' : 'Bahan Baku Pudding');
    }

    return {
      action: 'RECORD_EXPENSE',
      confidence: 0.90,
      title: 'Catat Pengeluaran ke Buku Kas',
      summary: `Catat pengeluaran [${category}] tanggal ${dateInfo.date} sebesar ${formatRupiah(amount)} (${desc})`,
      data: {
        date: dateInfo.date,
        category,
        description: desc,
        amount
      }
    };
  }

  // 4. CREATE_DROP & BATCH_CREATE_DROP check ("taruh", "titip", "drop", "bawa <angka>", multi-outlet bawa)
  const isQuestionWord = /\b(?:berapa|info|informasi|cek|tampilkan|lihat|mana|apa)\b/i.test(lower);
  const hasDropVerb = /\b(?:taruh|titip|drop|antar|kirim|bawa)\b/i.test(lower);

  if (!isQuestionWord && outletMatches.length >= 2 && (hasDropVerb || /\b\d+\b/.test(lower))) {
    const items = [];
    for (let i = 0; i < outletMatches.length; i++) {
      const m = outletMatches[i];
      const nextIdx = i + 1 < outletMatches.length ? outletMatches[i + 1].index : lower.length;
      const segAfter = stripDateTokens(lower.slice(m.index + m.length, nextIdx));
      const qtyMatch = segAfter.match(/(?:bawa|titip|taruh|drop|kirim)?\s*(\d+)\s*(?:cup|pcs|buah|porsi)?/i);
      if (!qtyMatch) {
        return {
          action: 'PROMPT_CLARIFY',
          title: 'Lengkapi Jumlah Cup',
          summary: `Sebutkan jumlah cup yang dibawa untuk ${m.outlet.name} (contoh: "${m.outlet.name.toLowerCase()} bawa 10").`
        };
      }
      const qtyDrop = parseInt(qtyMatch[1], 10);
      const prod = matchProduct(segAfter, products);
      items.push({
        outletId: m.outlet.id,
        outletName: m.outlet.name,
        productId: prod.id,
        productName: prod.name,
        priceUnit: prod.price,
        qtyDrop
      });
    }
    return {
      action: 'BATCH_CREATE_DROP',
      confidence: 0.94,
      title: `Catat Drop Massal (${items.length} Outlet)`,
      summary: items.map(it => `${it.outletName}: ${it.qtyDrop} cup ${it.productName}`).join('; '),
      data: { date: dateInfo.date, items }
    };
  }

  if (!isQuestionWord && hasDropVerb) {
    const matched = matchOutlet(lower, outlets);
    const matchedProduct = matchProduct(lower, products);
    const afterOutlet = stripDateTokens(outletMatches[0] ? lower.slice(outletMatches[0].index + outletMatches[0].length) : lower);
    const qtyMatch = afterOutlet.match(/(\d+)\s*(?:cup|pcs|buah|porsi)?/i) || stripDateTokens(lower).match(/(\d+)\s*(?:cup|pcs|buah|porsi)?/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 10;
    if (matched) {
      return {
        action: 'CREATE_DROP',
        confidence: 0.95,
        title: 'Catat Penitipan Pudding (Drop Batch)',
        summary: `Drop ${qty} cup ${matchedProduct.name} ke ${matched.name}`,
        data: {
          date: dateInfo.date,
          outletId: matched.id,
          outletName: matched.name,
          productId: matchedProduct.id,
          productName: matchedProduct.name,
          priceUnit: matchedProduct.price,
          qtyDrop: qty
        }
      };
    }
  }
  // 5. QUERY_OUTLET_INFO check
  if (
    lower.includes('info') || lower.includes('informasi') || lower.includes('cek') ||
    lower.includes('berapa') || lower.includes('hutang') || lower.includes('piutang') ||
    lower.includes('bawa') || lower.includes('tampilkan') || lower.includes('lihat') ||
    lower.includes('status') || lower.includes('riwayat')
  ) {
    const matched = matchOutlet(lower, outlets);
    if (matched) {
      return {
        action: 'QUERY_OUTLET_INFO',
        confidence: 0.94,
        title: `Informasi Outlet ${matched.name}`,
        summary: `Ringkasan hutang & titipan ${matched.name} (${dateInfo.label})`,
        data: {
          outletId: matched.id,
          outletName: matched.name,
          targetDate: dateInfo.date,
          targetDateLabel: dateInfo.label,
          dateWasExplicit: dateInfo.explicit
        }
      };
    }
    return {
      action: 'QUERY_OUTLET_INFO',
      confidence: 0.85,
      title: 'Ringkasan Piutang & Bawaan Outlet',
      summary: `Ringkasan semua outlet (${dateInfo.label})`,
      data: {
        outletId: 'ALL',
        outletName: 'Semua Outlet',
        targetDate: dateInfo.date,
        targetDateLabel: dateInfo.label,
        dateWasExplicit: dateInfo.explicit
      }
    };
  }

  return null;
}

/**
 * Validasi integritas hasil parsing AI (lokal maupun Gemini) sebelum tampil di konfirmasi user.
 * Mencegah angka salah (misal sisa retur > qty titip, nominal 0, atau outlet tak dikenal).
 */
export function validateParsedAction(parsed, outlets, products, activeBatches = []) {
  if (!parsed || !parsed.action) {
    return { ok: false, reason: 'Perintah tidak dapat dipahami.' };
  }
  if (parsed.action === 'PROMPT_CLARIFY' || parsed.action.startsWith('QUERY_')) {
    return { ok: true, parsed };
  }

  const data = parsed.data || {};

  if (parsed.action === 'CREATE_DROP') {
    const outlet = outlets.find(o => o.id === data.outletId) || matchOutlet(data.outletName || '', outlets);
    if (!outlet) return { ok: false, reason: `Outlet "${data.outletName || ''}" tidak ditemukan.` };
    const qty = Number(data.qtyDrop);
    if (!Number.isInteger(qty) || qty <= 0) return { ok: false, reason: 'Jumlah titip harus angka bulat > 0.' };
    const prod = products.find(p => p.id === data.productId) || matchProduct(data.productName || '', products);
    data.outletId = outlet.id;
    data.outletName = outlet.name;
    data.productId = prod.id;
    data.productName = prod.name;
    data.priceUnit = prod.price;
    data.qtyDrop = qty;
  }

  if (parsed.action === 'BATCH_CREATE_DROP') {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return { ok: false, reason: 'Daftar drop outlet kosong.' };
    }
    for (const item of data.items) {
      const outlet = outlets.find(o => o.id === item.outletId) || matchOutlet(item.outletName || '', outlets);
      if (!outlet) return { ok: false, reason: `Outlet "${item.outletName || ''}" tidak terdaftar.` };
      const qty = Number(item.qtyDrop);
      if (!Number.isInteger(qty) || qty <= 0) return { ok: false, reason: `Jumlah cup di ${outlet.name} harus > 0.` };
      const prod = products.find(p => p.id === item.productId) || matchProduct(item.productName || '', products);
      item.outletId = outlet.id;
      item.outletName = outlet.name;
      item.productId = prod.id;
      item.productName = prod.name;
      item.priceUnit = prod.price;
      item.qtyDrop = qty;
    }
  }

  if (parsed.action === 'RECONCILE_BATCH') {
    const outlet = outlets.find(o => o.id === data.outletId) || matchOutlet(data.outletName || '', outlets);
    if (!outlet) return { ok: false, reason: 'Outlet tidak ditemukan.' };
    const ret = Number(data.qtyReturned);
    if (!Number.isInteger(ret) || ret < 0) return { ok: false, reason: 'Jumlah sisa retur harus >= 0.' };
    const target = activeBatches.find(b => b.outletId === outlet.id && b.status === 'ACTIVE')
      || activeBatches.find(b => b.outletId === outlet.id);
    if (target && ret > target.qtyDrop) {
      return { ok: false, reason: `Sisa retur (${ret} cup) di ${outlet.name} melebihi jumlah titip (${target.qtyDrop} cup).` };
    }
    data.outletId = outlet.id;
    data.outletName = outlet.name;
    data.qtyReturned = ret;
  }

  if (parsed.action === 'BATCH_RECONCILE_MULTI') {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return { ok: false, reason: 'Tidak ada outlet pada daftar rekonsiliasi.' };
    }
    for (const item of data.items) {
      const outlet = outlets.find(o => o.id === item.outletId) || matchOutlet(item.outletName || '', outlets);
      if (!outlet) return { ok: false, reason: `Outlet "${item.outletName || ''}" tidak terdaftar.` };
      const ret = Number(item.qtyReturned);
      if (!Number.isInteger(ret) || ret < 0) return { ok: false, reason: `Jumlah sisa di ${outlet.name} harus >= 0.` };
      const target = item.batchId
        ? activeBatches.find(b => b.id === item.batchId)
        : (activeBatches.find(b => b.outletId === outlet.id && b.status === 'ACTIVE')
          || activeBatches.find(b => b.outletId === outlet.id && b.paymentStatus === 'UNPAID'));
      if (!target) {
        return { ok: false, reason: `Tidak ada batch aktif/unpaid di ${outlet.name}.` };
      }
      if (ret > target.qtyDrop) {
        return { ok: false, reason: `Sisa retur (${ret} cup) di ${outlet.name} melebihi jumlah titip (${target.qtyDrop} cup).` };
      }
      item.outletId = outlet.id;
      item.outletName = outlet.name;
      item.qtyReturned = ret;
      item.paymentStatus = item.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID';
    }
  }

  if (parsed.action === 'RECORD_EXPENSE') {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, reason: 'Nominal pengeluaran harus lebih besar dari Rp 0.' };
    }
    data.amount = Math.round(amount);
  }

  return { ok: true, parsed };
}

/**
 * Hitung status piutang, umur pembayaran terakhir, dan daftar transaksi langsung per outlet.
 */
export function getOutletBillingStatus(outletId, batches, refDateStr = new Date().toISOString().slice(0, 10)) {
  const outletBatches = batches
    .filter(b => b.outletId === outletId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  let unpaidTotal = 0;
  let unpaidCount = 0;
  let activeBatch = null;
  let lastPaidAt = null;
  let oldestUnpaidDate = null;

  const transactions = outletBatches.map(b => {
    const isReconciled = b.status === 'RECONCILED';
    const qtySold = isReconciled ? Math.max(0, (b.qtyDrop || 0) - (b.qtyReturned || 0)) : 0;
    const bill = qtySold * (b.priceUnit || 5000);

    if (b.status === 'ACTIVE' && !activeBatch) {
      activeBatch = b;
    }

    if (isReconciled && b.paymentStatus === 'UNPAID') {
      unpaidTotal += bill;
      unpaidCount++;
      if (!oldestUnpaidDate || (b.date && b.date < oldestUnpaidDate)) {
        oldestUnpaidDate = b.date;
      }
    }

    if (isReconciled && b.paymentStatus === 'PAID') {
      const paidDate = b.paidAt || b.date;
      if (paidDate && (!lastPaidAt || paidDate > lastPaidAt)) {
        lastPaidAt = paidDate;
      }
    }

    return {
      id: b.id,
      date: b.date,
      productName: b.productName || 'Pudding Coklat',
      qtyDrop: b.qtyDrop,
      qtyReturned: b.qtyReturned,
      qtySold,
      bill,
      status: b.status,
      paymentStatus: b.paymentStatus,
      paidAt: b.paidAt || null
    };
  });

  const refMs = Date.parse(refDateStr + 'T00:00:00Z');
  const daysSinceLastPaid = lastPaidAt && !Number.isNaN(refMs)
    ? Math.max(0, Math.round((refMs - Date.parse(lastPaidAt + 'T00:00:00Z')) / 86400000))
    : null;
  const oldestUnpaidDays = oldestUnpaidDate && !Number.isNaN(refMs)
    ? Math.max(0, Math.round((refMs - Date.parse(oldestUnpaidDate + 'T00:00:00Z')) / 86400000))
    : null;

  return {
    outletId,
    activeBatch,
    unpaidTotal,
    unpaidCount,
    lastPaidAt,
    daysSinceLastPaid,
    oldestUnpaidDate,
    oldestUnpaidDays,
    totalBatches: outletBatches.length,
    transactions
  };
}

const QUARTER_MONTHS = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Okt–Des'];
const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Filter batches & expenses untuk laporan Mingguan, Bulanan (tiap bulan), Kuartalan, atau Semua.
 */
export function filterRecordsByPeriod(
  batches,
  expenses,
  period = 'all',
  anchorMonth = new Date().toISOString().slice(0, 7),
  refDateStr = new Date().toISOString().slice(0, 10)
) {
  const safeMonth = /^\d{4}-\d{2}$/.test(anchorMonth || '') ? anchorMonth : refDateStr.slice(0, 7);
  const [yearStr, monthStr] = safeMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (!period || period === 'all') {
    return { batches, expenses, periodLabel: 'Semua Waktu' };
  }

  if (period === 'month') {
    return {
      batches: batches.filter(b => (b.date || '').slice(0, 7) === safeMonth),
      expenses: expenses.filter(e => (e.date || '').slice(0, 7) === safeMonth),
      periodLabel: `Bulanan (${MONTH_NAMES_ID[month - 1] || monthStr} ${year})`
    };
  }

  if (period === 'quarter') {
    const q = Math.floor((month - 1) / 3) + 1;
    const qStart = `${yearStr}-${String((q - 1) * 3 + 1).padStart(2, '0')}`;
    const qEnd = `${yearStr}-${String(q * 3).padStart(2, '0')}`;
    return {
      batches: batches.filter(b => {
        const ym = (b.date || '').slice(0, 7);
        return ym >= qStart && ym <= qEnd;
      }),
      expenses: expenses.filter(e => {
        const ym = (e.date || '').slice(0, 7);
        return ym >= qStart && ym <= qEnd;
      }),
      periodLabel: `Kuartalan (Q${q} ${year} • ${QUARTER_MONTHS[q - 1]})`
    };
  }

  if (period === 'week') {
    const currentMonth = refDateStr.slice(0, 7);
    let endDateStr = refDateStr;
    if (safeMonth !== currentMonth) {
      const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      endDateStr = lastDay;
    }
    const endMs = Date.parse(endDateStr + 'T00:00:00Z');
    const startDateStr = new Date(endMs - 6 * 86400000).toISOString().slice(0, 10);
    return {
      batches: batches.filter(b => b.date >= startDateStr && b.date <= endDateStr),
      expenses: expenses.filter(e => e.date >= startDateStr && e.date <= endDateStr),
      periodLabel: `Mingguan (${startDateStr.slice(5)} s/d ${endDateStr.slice(5)})`
    };
  }

  return { batches, expenses, periodLabel: 'Semua Waktu' };
}
