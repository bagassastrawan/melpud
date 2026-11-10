import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_OUTLETS,
  INITIAL_PRODUCTS,
  calculateFinancialSummary,
  parseNLPCommand,
  parseAmount,
  categorizeExpense,
  getOutletBillingStatus,
  filterRecordsByPeriod
} from '../core.js';
import {
  isSupabaseConfigured,
  mapBatchFromDb,
  mapBatchToDb,
  mapSummaryFromDb
} from '../db.js';

test('Financial Engine: Cash basis vs Accrual & Auto-deduction rules', () => {
  const batches = [
    { id: 'b1', outletId: 'p-bungin', qtyDrop: 10, qtyReturned: 2, priceUnit: 5000, status: 'RECONCILED', paymentStatus: 'PAID' },
    { id: 'b2', outletId: 'p-singkep', qtyDrop: 15, qtyReturned: 5, priceUnit: 5000, status: 'RECONCILED', paymentStatus: 'UNPAID' },
    { id: 'b3', outletId: 'bubuh-bali', qtyDrop: 10, qtyReturned: null, priceUnit: 5000, status: 'ACTIVE', paymentStatus: 'UNPAID' }
  ];

  const expenses = [
    { id: 'e1', category: 'Bahan Baku Utama', description: 'Susu dan coklat', amount: 45000 },
    { id: 'e2', category: 'Kemasan', description: 'Cup plastik', amount: 25000 }
  ];

  const summary = calculateFinancialSummary(batches, expenses);

  assert.equal(summary.realCashIn, 40000);
  assert.equal(summary.totalReceivables, 50000);
  assert.equal(summary.totalExpenses, 70000);
  assert.equal(summary.netCash, -30000);
  assert.equal(summary.projectedProfit, 20000);
  assert.equal(summary.lowCashWarning, true);
});

test('Financial Engine: Clean empty state defaults to zeros', () => {
  const summary = calculateFinancialSummary([], []);
  assert.equal(summary.realCashIn, 0);
  assert.equal(summary.totalReceivables, 0);
  assert.equal(summary.totalExpenses, 0);
  assert.equal(summary.netCash, 0);
  assert.equal(summary.projectedProfit, 0);
});

test('NLP Quick-Log Parser: All 5 PRD examples', () => {
  const drop = parseNLPCommand('taruh pudding di p bungin 10 cup coklat', INITIAL_OUTLETS, INITIAL_PRODUCTS);
  assert.equal(drop.action, 'CREATE_DROP');
  assert.equal(drop.data.outletId, 'p-bungin');
  assert.equal(drop.data.qtyDrop, 10);
  assert.equal(drop.data.productId, 'pudding-coklat');

  const reconcile = parseNLPCommand('di p bungin sisa 2 belum dibayar', INITIAL_OUTLETS, INITIAL_PRODUCTS);
  assert.equal(reconcile.action, 'RECONCILE_BATCH');
  assert.equal(reconcile.data.outletId, 'p-bungin');
  assert.equal(reconcile.data.qtyReturned, 2);
  assert.equal(reconcile.data.paymentStatus, 'UNPAID');

  const settle = parseNLPCommand('p bungin sudah lunas', INITIAL_OUTLETS, INITIAL_PRODUCTS);
  assert.equal(settle.action, 'SETTLE_PAYMENT');
  assert.equal(settle.data.outletId, 'p-bungin');

  const exp1 = parseNLPCommand('belanja susu kental manis dan coklat 45rb', INITIAL_OUTLETS, INITIAL_PRODUCTS);
  assert.equal(exp1.action, 'RECORD_EXPENSE');
  assert.equal(exp1.data.category, 'Bahan Baku Utama');
  assert.equal(exp1.data.amount, 45000);

  const exp2 = parseNLPCommand('beli cup plastik 50pcs habis 25k', INITIAL_OUTLETS, INITIAL_PRODUCTS);
  assert.equal(exp2.action, 'RECORD_EXPENSE');
  assert.equal(exp2.data.category, 'Kemasan');
  assert.equal(exp2.data.amount, 25000);
});

test('Amount and Category parsing edge cases', () => {
  assert.equal(parseAmount('45rb'), 45000);
  assert.equal(parseAmount('25k'), 25000);
  assert.equal(parseAmount('Rp 120.000'), 120000);
  assert.equal(parseAmount('bensin motor 15.000'), 15000);
  assert.equal(categorizeExpense('bensin keliling outlet'), 'Operasional Lainnya');
});

test('Supabase Repository Helpers: Config validation & Postgres mapping', () => {
  assert.equal(isSupabaseConfigured({ url: '', publishableKey: '' }), false);
  assert.equal(isSupabaseConfigured({ url: 'https://abc.supabase.co', publishableKey: 'sb_publishable_123' }), true);
  assert.throws(
    () => isSupabaseConfigured({ url: 'https://abc.supabase.co', publishableKey: 'sb_secret_danger' }),
    /Keamanan Supabase/
  );

  const appBatch = {
    id: 'b-1',
    date: '2026-11-10',
    outletId: 'p-bungin',
    productId: 'pudding-coklat',
    productName: 'Pudding Coklat',
    qtyDrop: 10,
    qtyReturned: 2,
    priceUnit: 5000,
    status: 'RECONCILED',
    paymentStatus: 'PAID',
    paidAt: '2026-11-10'
  };
  const dbRow = mapBatchToDb(appBatch);
  assert.equal(dbRow.outlet_id, 'p-bungin');
  assert.equal(dbRow.qty_drop, 10);
  assert.equal(dbRow.payment_status, 'PAID');

  const roundTrip = mapBatchFromDb({ ...dbRow, qty_sold: 8, total_bill: 40000 });
  assert.equal(roundTrip.outletId, 'p-bungin');
  assert.equal(roundTrip.qtySold, 8);
  assert.equal(roundTrip.totalBill, 40000);

  const mappedSummary = mapSummaryFromDb({
    total_receivables: '60000',
    real_cash_in: '40000',
    total_expenses: '25000',
    net_cash: '15000',
    projected_profit: '75000',
    low_cash_warning: true
  });
  assert.deepEqual(mappedSummary, {
    totalReceivables: 60000,
    realCashIn: 40000,
    totalExpenses: 25000,
    netCash: 15000,
    projectedProfit: 75000,
    lowCashWarning: true
  });
});

test('Outlet Billing Status: Last paid age, total owed, and outlet list', () => {
  const batches = [
    { id: 'b1', date: '2026-11-05', outletId: 'p-bungin', productName: 'Pudding Coklat', qtyDrop: 10, qtyReturned: 2, priceUnit: 5000, status: 'RECONCILED', paymentStatus: 'PAID', paidAt: '2026-11-06' },
    { id: 'b2', date: '2026-11-08', outletId: 'p-bungin', productName: 'Pudding Coklat', qtyDrop: 12, qtyReturned: 2, priceUnit: 5000, status: 'RECONCILED', paymentStatus: 'UNPAID', paidAt: null },
    { id: 'b3', date: '2026-11-10', outletId: 'p-bungin', productName: 'Pudding Coklat', qtyDrop: 10, qtyReturned: null, priceUnit: 5000, status: 'ACTIVE', paymentStatus: 'UNPAID', paidAt: null }
  ];

  const beforePay = getOutletBillingStatus('p-bungin', batches, '2026-11-10');
  assert.equal(beforePay.unpaidTotal, 50000);
  assert.equal(beforePay.lastPaidAt, '2026-11-06');
  assert.equal(beforePay.daysSinceLastPaid, 4);
  assert.equal(beforePay.transactions.length, 3);
  assert.equal(beforePay.transactions[0].id, 'b3');

  // Simulate full settlement today
  batches[1].paymentStatus = 'PAID';
  batches[1].paidAt = '2026-11-10';
  const afterPay = getOutletBillingStatus('p-bungin', batches, '2026-11-10');
  assert.equal(afterPay.unpaidTotal, 0);
  assert.equal(afterPay.lastPaidAt, '2026-11-10');
  assert.equal(afterPay.daysSinceLastPaid, 0);
  assert.equal(afterPay.transactions[1].paymentStatus, 'PAID');
});

test('Report Period Filters: Weekly, Monthly (by month), and Quarterly', () => {
  const batches = [
    { id: 'q3', date: '2026-09-15', outletId: 'p-bungin', qtyDrop: 10, qtyReturned: 0, priceUnit: 5000, status: 'RECONCILED', paymentStatus: 'PAID' },
    { id: 'oct', date: '2026-10-20', outletId: 'p-bungin', qtyDrop: 10, qtyReturned: 0, priceUnit: 5000, status: 'RECONCILED', paymentStatus: 'PAID' },
    { id: 'nov-old', date: '2026-11-01', outletId: 'p-bungin', qtyDrop: 10, qtyReturned: 0, priceUnit: 5000, status: 'RECONCILED', paymentStatus: 'PAID' },
    { id: 'nov-recent', date: '2026-11-09', outletId: 'p-bungin', qtyDrop: 10, qtyReturned: 0, priceUnit: 5000, status: 'RECONCILED', paymentStatus: 'PAID' }
  ];
  const expenses = [
    { id: 'e-oct', date: '2026-10-22', category: 'Bahan Baku Utama', amount: 30000 },
    { id: 'e-nov', date: '2026-11-08', category: 'Kemasan', amount: 20000 }
  ];

  const week = filterRecordsByPeriod(batches, expenses, 'week', '2026-11', '2026-11-10');
  assert.deepEqual(week.batches.map(b => b.id), ['nov-recent']);
  assert.deepEqual(week.expenses.map(e => e.id), ['e-nov']);

  const monthNov = filterRecordsByPeriod(batches, expenses, 'month', '2026-11', '2026-11-10');
  assert.deepEqual(monthNov.batches.map(b => b.id), ['nov-old', 'nov-recent']);

  const monthOct = filterRecordsByPeriod(batches, expenses, 'month', '2026-10', '2026-11-10');
  assert.deepEqual(monthOct.batches.map(b => b.id), ['oct']);

  const quarterQ4 = filterRecordsByPeriod(batches, expenses, 'quarter', '2026-11', '2026-11-10');
  assert.deepEqual(quarterQ4.batches.map(b => b.id), ['oct', 'nov-old', 'nov-recent']);
  assert.match(quarterQ4.periodLabel, /Q4 2026/);
});

test('AI Chatbot Commands: Bulk Settle, Outlet Info/Date Query, & Natural Expense', () => {
  const batches = [
    { id: 'b1', date: '2026-11-09', outletId: 'p-bungin', productName: 'Pudding Coklat', qtyDrop: 10, qtyReturned: 1, priceUnit: 5000, status: 'RECONCILED', paymentStatus: 'UNPAID' },
    { id: 'b2', date: '2026-11-10', outletId: 'p-bungin', productName: 'Pudding Coklat', qtyDrop: 9, qtyReturned: 0, priceUnit: 5000, status: 'RECONCILED', paymentStatus: 'UNPAID' }
  ];

  // 1. Bulk settle command
  const settleAll = parseNLPCommand('di outlet p bungin lunas semua', INITIAL_OUTLETS, INITIAL_PRODUCTS, batches, '2026-11-10');
  assert.equal(settleAll.action, 'SETTLE_PAYMENT');
  assert.equal(settleAll.data.outletId, 'p-bungin');
  assert.equal(settleAll.data.unpaidCount, 2);
  assert.equal(settleAll.data.unpaidTotal, 90000);

  // 2. Query info & date
  const infoToday = parseNLPCommand('tampilkan info hutang p bungin dan bawa berapa hari ini', INITIAL_OUTLETS, INITIAL_PRODUCTS, batches, '2026-11-10');
  assert.equal(infoToday.action, 'QUERY_OUTLET_INFO');
  assert.equal(infoToday.data.outletId, 'p-bungin');
  assert.equal(infoToday.data.targetDate, '2026-11-10');

  const infoTgl9 = parseNLPCommand('di p bungin bawa berapa tanggal 9 nov', INITIAL_OUTLETS, INITIAL_PRODUCTS, batches, '2026-11-10');
  assert.equal(infoTgl9.action, 'QUERY_OUTLET_INFO');
  assert.equal(infoTgl9.data.targetDate, '2026-11-09');

  // 3. Natural Indonesian expense phrasing & unit preservation
  const expNatural = parseNLPCommand('saya keluarin uang 50rb dihari ini untuk belanja kebutuhan gula total 50rb', INITIAL_OUTLETS, INITIAL_PRODUCTS, batches, '2026-11-10');
  assert.equal(expNatural.action, 'RECORD_EXPENSE');
  assert.equal(expNatural.data.amount, 50000);
  assert.equal(expNatural.data.date, '2026-11-10');
  assert.match(expNatural.data.description, /gula/i);

  const expPcs = parseNLPCommand('beli cup plastik 50pcs habis 25k', INITIAL_OUTLETS, INITIAL_PRODUCTS, batches, '2026-11-10');
  assert.equal(expPcs.data.amount, 25000);
  assert.match(expPcs.data.description, /50pcs/i);
});
