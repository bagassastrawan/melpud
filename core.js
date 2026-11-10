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
 * Ekstrak tanggal dari kalimat (mendukung "hari ini", "kemarin", "tanggal X", "9 nov", "YYYY-MM-DD").
 */
export function extractDateFromText(text, refDateStr = new Date().toISOString().slice(0, 10)) {
  const lower = (text || '').toLowerCase();
  const [refYear, refMonth] = refDateStr.split('-');

  if (/\b(?:di\s*hari\s*ini|hari\s*ini|hr\s*ini|sekarang)\b/i.test(lower)) {
    return { date: refDateStr, label: 'Hari ini', explicit: true };
  }
  if (/\bkemarin\b/i.test(lower)) {
    const yMs = Date.parse(refDateStr + 'T00:00:00Z') - 86400000;
    const yStr = new Date(yMs).toISOString().slice(0, 10);
    return { date: yStr, label: 'Kemarin', explicit: true };
  }

  const isoMatch = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return { date: isoMatch[1], label: isoMatch[1], explicit: true };
  }

  const dmyMatch = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    return { date: `${dmyMatch[3]}-${mm}-${dd}`, label: `${dd}/${mm}/${dmyMatch[3]}`, explicit: true };
  }

  const monthMap = {
    jan: '01', januari: '01', feb: '02', februari: '02', mar: '03', maret: '03',
    apr: '04', april: '04', mei: '05', jun: '06', juni: '06', jul: '07', juli: '07',
    agu: '08', agt: '08', agustus: '08', sep: '09', sept: '09', september: '09',
    okt: '10', oktober: '10', nov: '11', november: '11', des: '12', desember: '12'
  };
  const monthTextMatch = lower.match(/\b(\d{1,2})\s+(januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|agt|september|sept|sep|oktober|okt|november|nov|desember|des)\b/i);
  if (monthTextMatch) {
    const dd = monthTextMatch[1].padStart(2, '0');
    const mm = monthMap[monthTextMatch[2].toLowerCase()];
    return { date: `${refYear}-${mm}-${dd}`, label: `${monthTextMatch[1]} ${monthTextMatch[2]}`, explicit: true };
  }

  const tglMatch = lower.match(/\b(?:tanggal|tgl)\s*(\d{1,2})\b/i);
  if (tglMatch) {
    const dd = tglMatch[1].padStart(2, '0');
    return { date: `${refYear}-${refMonth}-${dd}`, label: `Tgl ${tglMatch[1]}`, explicit: true };
  }

  return { date: refDateStr, label: 'Hari ini', explicit: false };
}

/**
 * AI Smart Quick-Log NLP Parser (Natural Language Processing for Indonesian field input)
 * Mendukung: CREATE_DROP, RECONCILE_BATCH, SETTLE_PAYMENT, RECORD_EXPENSE, & QUERY_OUTLET_INFO.
 */
export function parseNLPCommand(rawText, outlets, products, activeBatches = [], refDateStr = new Date().toISOString().slice(0, 10)) {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const dateInfo = extractDateFromText(text, refDateStr);

  // 1. RECONCILE_BATCH check: "sisa", "retur", "kembali" (must precede pure SETTLE_PAYMENT)
  if (lower.includes('sisa') || lower.includes('retur') || lower.includes('kembali')) {
    const matched = matchOutlet(lower, outlets);
    const sisaMatch = lower.match(/(?:sisa|retur|kembali)\s*(\d+)/i) || lower.match(/(\d+)\s*(?:cup|pcs)?\s*(?:sisa|retur)/i);
    const qtyReturned = sisaMatch ? parseInt(sisaMatch[1], 10) : 0;
    const isPaid = lower.includes('lunas') || lower.includes('sudah bayar') || lower.includes('cash') || lower.includes('tunai');

    if (matched) {
      return {
        action: 'RECONCILE_BATCH',
        confidence: 0.92,
        title: 'Rekonsiliasi & Retur Outlet',
        summary: `Rekonsiliasi ${matched.name}: sisa ${qtyReturned} cup, status ${isPaid ? 'PAID (Lunas)' : 'UNPAID (Piutang)'}`,
        data: {
          outletId: matched.id,
          outletName: matched.name,
          qtyReturned,
          paymentStatus: isPaid ? 'PAID' : 'UNPAID'
        }
      };
    }
  }

  // 2. SETTLE_PAYMENT check: "lunas", "lunasi", "sudah bayar", "transfer masuk"
  if (lower.includes('lunas') || lower.includes('sudah bayar') || lower.includes('transfer masuk')) {
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

  // 3. RECORD_EXPENSE check: "keluarin", "pengeluaran", "belanja", "beli", "biaya", "bensin", "habis"
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

  // 4. CREATE_DROP check: "taruh", "titip", "drop", "antar", "kirim"
  if (lower.includes('taruh') || lower.includes('titip') || lower.includes('drop') || lower.includes('antar') || lower.includes('kirim')) {
    const matched = matchOutlet(lower, outlets);
    const matchedProduct = matchProduct(lower, products);
    const qtyMatch = lower.match(/(\d+)\s*(?:cup|pcs|buah|porsi)?/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 10;

    if (matched) {
      return {
        action: 'CREATE_DROP',
        confidence: 0.95,
        title: 'Catat Penitipan Pudding (Drop Batch)',
        summary: `Drop ${qty} cup ${matchedProduct.name} ke ${matched.name}`,
        data: {
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

  // 5. QUERY_OUTLET_INFO check: info hutang outlet, bawa berapa tanggal X / hari ini
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
