/**
 * Melpud Data Adapter - Supabase PostgreSQL + Clean Local Fallback
 * Menggunakan @supabase/supabase-js@2.119.0 (pinned version)
 */

import { SUPABASE_CONFIG } from './supabase-config.js';
import { INITIAL_OUTLETS, INITIAL_PRODUCTS, calculateFinancialSummary } from './core.js';

const SUPABASE_CDN_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

const LOCAL_KEYS = {
  outlets: 'melpud_v2_outlets',
  products: 'melpud_v2_products',
  batches: 'melpud_v2_batches',
  expenses: 'melpud_v2_expenses'
};

let clientPromise = null;

/**
 * Validasi apakah konfigurasi Supabase sudah diisi dan aman untuk browser.
 */
export function isSupabaseConfigured(config = SUPABASE_CONFIG) {
  if (!config || typeof config.url !== 'string' || typeof config.publishableKey !== 'string') {
    return false;
  }
  const url = config.url.trim();
  const key = config.publishableKey.trim();
  if (!url || !key) return false;
  if (url.includes('YOUR_PROJECT') || key.includes('YOUR_KEY')) return false;
  if (!/^https?:\/\/.+/.test(url)) return false;
  // Tolak secret/service_role key agar tidak terekspos di client browser
  if (key.startsWith('sb_secret_')) {
    throw new Error('Keamanan Supabase: Jangan gunakan sb_secret_ / service_role key di frontend! Gunakan Publishable / anon key.');
  }
  return true;
}

export function mapBatchFromDb(row) {
  return {
    id: row.id,
    date: row.date,
    outletId: row.outlet_id,
    productId: row.product_id,
    productName: row.product_name,
    qtyDrop: Number(row.qty_drop),
    qtyReturned: row.qty_returned === null || row.qty_returned === undefined ? null : Number(row.qty_returned),
    priceUnit: Number(row.price_unit),
    qtySold: row.qty_sold !== undefined ? Number(row.qty_sold) : undefined,
    totalBill: row.total_bill !== undefined ? Number(row.total_bill) : undefined,
    status: row.status,
    paymentStatus: row.payment_status,
    paidAt: row.paid_at || null
  };
}

export function mapBatchToDb(batch) {
  return {
    id: batch.id,
    date: batch.date,
    outlet_id: batch.outletId,
    product_id: batch.productId,
    product_name: batch.productName,
    qty_drop: batch.qtyDrop,
    qty_returned: batch.qtyReturned ?? null,
    price_unit: batch.priceUnit,
    status: batch.status,
    payment_status: batch.paymentStatus,
    paid_at: batch.paidAt || null
  };
}

export function mapExpenseFromDb(row) {
  return {
    id: row.id,
    date: row.date,
    category: row.category,
    description: row.description,
    amount: Number(row.amount)
  };
}

export function mapSummaryFromDb(row) {
  if (!row) return null;
  return {
    totalReceivables: Number(row.total_receivables) || 0,
    realCashIn: Number(row.real_cash_in) || 0,
    totalExpenses: Number(row.total_expenses) || 0,
    netCash: Number(row.net_cash) || 0,
    projectedProfit: Number(row.projected_profit) || 0,
    lowCashWarning: Boolean(row.low_cash_warning)
  };
}

async function getClient() {
  if (!isSupabaseConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import(SUPABASE_CDN_URL).then(({ createClient }) =>
      createClient(SUPABASE_CONFIG.url.trim(), SUPABASE_CONFIG.publishableKey.trim())
    );
  }
  return clientPromise;
}

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(fallback));
  } catch {
    return JSON.parse(JSON.stringify(fallback));
  }
}

function saveLocal(state) {
  try {
    localStorage.setItem(LOCAL_KEYS.outlets, JSON.stringify(state.outlets));
    localStorage.setItem(LOCAL_KEYS.products, JSON.stringify(state.products));
    localStorage.setItem(LOCAL_KEYS.batches, JSON.stringify(state.batches));
    localStorage.setItem(LOCAL_KEYS.expenses, JSON.stringify(state.expenses));
  } catch (e) {
    console.error('LocalStorage save failed:', e);
  }
}

export function clearLegacyDummyStorage() {
  try {
    ['melpud_outlets', 'melpud_products', 'melpud_batches', 'melpud_expenses'].forEach(k => {
      localStorage.removeItem(k);
    });
  } catch {
    // ignore outside browser
  }
}

export class MelpudRepository {
  constructor() {
    this.mode = 'local'; // 'local' | 'supabase' | 'error'
    this.lastError = null;
  }

  async loadAll() {
    clearLegacyDummyStorage();

    if (!isSupabaseConfigured()) {
      this.mode = 'local';
      const outlets = loadLocal(LOCAL_KEYS.outlets, INITIAL_OUTLETS);
      const products = loadLocal(LOCAL_KEYS.products, INITIAL_PRODUCTS);
      const batches = loadLocal(LOCAL_KEYS.batches, []);
      const expenses = loadLocal(LOCAL_KEYS.expenses, []);
      return {
        mode: this.mode,
        outlets,
        products,
        batches,
        expenses,
        summary: calculateFinancialSummary(batches, expenses)
      };
    }

    const supabase = await getClient();
    const [outletsRes, productsRes, batchesRes, expensesRes, summaryRes] = await Promise.all([
      supabase.from('outlets').select('*').order('created_at', { ascending: true }),
      supabase.from('products').select('*').order('created_at', { ascending: true }),
      supabase.from('consignment_batches').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('view_financial_summary').select('*').single()
    ]);

    const firstError = outletsRes.error || productsRes.error || batchesRes.error || expensesRes.error || summaryRes.error;
    if (firstError) {
      this.mode = 'error';
      this.lastError = firstError.message;
      throw new Error(`Gagal memuat data Supabase: ${firstError.message}`);
    }

    this.mode = 'supabase';
    this.lastError = null;
    const batches = (batchesRes.data || []).map(mapBatchFromDb);
    const expenses = (expensesRes.data || []).map(mapExpenseFromDb);

    return {
      mode: this.mode,
      outlets: outletsRes.data || [],
      products: productsRes.data || [],
      batches,
      expenses,
      summary: mapSummaryFromDb(summaryRes.data) || calculateFinancialSummary(batches, expenses)
    };
  }

  async fetchSummary(batches, expenses) {
    if (this.mode !== 'supabase') {
      return calculateFinancialSummary(batches, expenses);
    }
    const supabase = await getClient();
    const { data, error } = await supabase.from('view_financial_summary').select('*').single();
    if (error) throw new Error(error.message);
    return mapSummaryFromDb(data);
  }

  async createBatch(batch, stateSnapshot) {
    if (this.mode === 'supabase') {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('consignment_batches')
        .insert(mapBatchToDb(batch))
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapBatchFromDb(data);
    }
    saveLocal(stateSnapshot);
    return batch;
  }

  async reconcileBatch(batchId, qtyReturned, paymentStatus, paidAt, stateSnapshot) {
    if (this.mode === 'supabase') {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('consignment_batches')
        .update({
          qty_returned: qtyReturned,
          status: 'RECONCILED',
          payment_status: paymentStatus,
          paid_at: paidAt
        })
        .eq('id', batchId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapBatchFromDb(data);
    }
    saveLocal(stateSnapshot);
    return null;
  }

  async updateBatch(batch, stateSnapshot) {
    if (this.mode === 'supabase') {
      const supabase = await getClient();
      const payload = mapBatchToDb(batch);
      delete payload.id;
      const { data, error } = await supabase
        .from('consignment_batches')
        .update(payload)
        .eq('id', batch.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapBatchFromDb(data);
    }
    saveLocal(stateSnapshot);
    return batch;
  }

  async deleteBatch(batchId, stateSnapshot) {
    if (this.mode === 'supabase') {
      const supabase = await getClient();
      const { error } = await supabase.from('consignment_batches').delete().eq('id', batchId);
      if (error) throw new Error(error.message);
      return;
    }
    saveLocal(stateSnapshot);
  }

  async settleBatches(batchIds, paidAt, stateSnapshot) {
    if (batchIds.length === 0) return;
    if (this.mode === 'supabase') {
      const supabase = await getClient();
      const { error } = await supabase
        .from('consignment_batches')
        .update({ payment_status: 'PAID', paid_at: paidAt })
        .in('id', batchIds);
      if (error) throw new Error(error.message);
      return;
    }
    saveLocal(stateSnapshot);
  }
  async createExpense(expense, stateSnapshot) {
    if (this.mode === 'supabase') {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          id: expense.id,
          date: expense.date,
          category: expense.category,
          description: expense.description,
          amount: expense.amount
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapExpenseFromDb(data);
    }
    saveLocal(stateSnapshot);
    return expense;
  }

  async deleteExpense(expenseId, stateSnapshot) {
    if (this.mode === 'supabase') {
      const supabase = await getClient();
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
      if (error) throw new Error(error.message);
      return;
    }
    saveLocal(stateSnapshot);
  }

  async createOutlet(outlet, stateSnapshot) {
    if (this.mode === 'supabase') {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('outlets')
        .insert(outlet)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    saveLocal(stateSnapshot);
    return outlet;
  }

  async createProduct(product, stateSnapshot) {
    if (this.mode === 'supabase') {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    saveLocal(stateSnapshot);
    return product;
  }

  async subscribeRealtime(onChange) {
    if (this.mode !== 'supabase') return null;
    const supabase = await getClient();
    const channel = supabase
      .channel('melpud-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consignment_batches' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outlets' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, onChange)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }
}
