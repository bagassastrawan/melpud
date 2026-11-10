/**
 * Melpud Management System - Main Application Controller
 * PRD v2.0 Specification (Connected to Supabase PostgreSQL + Clean Local Fallback)
 */

import {
  INITIAL_OUTLETS,
  INITIAL_PRODUCTS,
  calculateFinancialSummary,
  formatRupiah,
  parseNLPCommand,
  getOutletBillingStatus,
  filterRecordsByPeriod
} from './core.js';
import { MelpudRepository } from './db.js';

function shortDate(iso) {
  if (!iso) return '-';
  const dt = new Date(iso + 'T00:00:00');
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Application State Store backed by Supabase Repository / Clean Local Fallback
class MelpudStore {
  constructor() {
    this.repo = new MelpudRepository();
    this.outlets = [...INITIAL_OUTLETS];
    this.products = [...INITIAL_PRODUCTS];
    this.batches = [];
    this.expenses = [];
    this.summary = calculateFinancialSummary([], []);
    this.currentPeriod = 'all';
    this.currentMonth = todayISO().slice(0, 7);
  }

  async init() {
    const state = await this.repo.loadAll();
    this.outlets = state.outlets;
    this.products = state.products;
    this.batches = state.batches;
    this.expenses = state.expenses;
    this.summary = state.summary;
  }

  snapshot() {
    return {
      outlets: this.outlets,
      products: this.products,
      batches: this.batches,
      expenses: this.expenses
    };
  }

  async refreshSummary() {
    this.summary = await this.repo.fetchSummary(this.batches, this.expenses);
  }

  async addBatch(batch) {
    const newBatch = {
      id: 'batch-' + Date.now(),
      date: batch.date || todayISO(),
      outletId: batch.outletId,
      productId: batch.productId,
      productName: batch.productName || 'Pudding Coklat',
      qtyDrop: parseInt(batch.qtyDrop, 10),
      qtyReturned: null,
      priceUnit: Number(batch.priceUnit) || 5000,
      status: 'ACTIVE',
      paymentStatus: 'UNPAID',
      paidAt: null
    };
    this.batches.unshift(newBatch);
    const saved = await this.repo.createBatch(newBatch, this.snapshot());
    if (saved) this.batches[0] = saved;
    await this.refreshSummary();
  }

  async reconcileBatch(batchId, qtyReturned, paymentStatus) {
    const b = this.batches.find(x => x.id === batchId);
    if (!b) return;
    const paidAt = paymentStatus === 'PAID' ? todayISO() : null;
    b.qtyReturned = parseInt(qtyReturned, 10);
    b.status = 'RECONCILED';
    b.paymentStatus = paymentStatus;
    if (paidAt) b.paidAt = paidAt;

    const updated = await this.repo.reconcileBatch(batchId, b.qtyReturned, paymentStatus, paidAt, this.snapshot());
    if (updated) Object.assign(b, updated);
    await this.refreshSummary();
  }

  async updateBatch(updatedFields) {
    const idx = this.batches.findIndex(x => x.id === updatedFields.id);
    if (idx === -1) return;
    const merged = { ...this.batches[idx], ...updatedFields };
    this.batches[idx] = merged;
    const saved = await this.repo.updateBatch(merged, this.snapshot());
    if (saved) this.batches[idx] = saved;
    await this.refreshSummary();
  }

  async deleteBatch(batchId) {
    this.batches = this.batches.filter(x => x.id !== batchId);
    await this.repo.deleteBatch(batchId, this.snapshot());
    await this.refreshSummary();
  }

  async settleOutlet(outletId) {
    const today = todayISO();
    const targets = this.batches.filter(
      b => b.outletId === outletId && b.paymentStatus === 'UNPAID' && b.status === 'RECONCILED'
    );
    targets.forEach(b => {
      b.paymentStatus = 'PAID';
      b.paidAt = today;
    });
    await this.repo.settleBatches(targets.map(b => b.id), today, this.snapshot());
    await this.refreshSummary();
    return targets.length;
  }

  async settleBatch(batchId) {
    const b = this.batches.find(x => x.id === batchId);
    if (!b) return;
    const today = todayISO();
    b.paymentStatus = 'PAID';
    b.paidAt = today;
    await this.repo.settleBatches([batchId], today, this.snapshot());
    await this.refreshSummary();
  }

  async addExpense(expense) {
    const newExp = {
      id: 'exp-' + Date.now(),
      date: expense.date || todayISO(),
      category: expense.category,
      description: expense.description,
      amount: parseInt(expense.amount, 10)
    };
    this.expenses.unshift(newExp);
    const saved = await this.repo.createExpense(newExp, this.snapshot());
    if (saved) this.expenses[0] = saved;
    await this.refreshSummary();
  }

  async removeExpense(expenseId) {
    this.expenses = this.expenses.filter(x => x.id !== expenseId);
    await this.repo.deleteExpense(expenseId, this.snapshot());
    await this.refreshSummary();
  }

  async addOutlet(name, contact) {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now().toString().slice(-4);
    const outlet = {
      id,
      name: name.toUpperCase(),
      contact: contact || '-',
      active: true
    };
    this.outlets.push(outlet);
    const saved = await this.repo.createOutlet(outlet, this.snapshot());
    if (saved) this.outlets[this.outlets.length - 1] = saved;
  }

  async addProduct(name, price) {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now().toString().slice(-4);
    const product = {
      id,
      name,
      price: parseInt(price, 10)
    };
    this.products.push(product);
    const saved = await this.repo.createProduct(product, this.snapshot());
    if (saved) this.products[this.products.length - 1] = saved;
  }

  getOutletBatches(outletId) {
    return this.batches.filter(b => b.outletId === outletId);
  }

  getFilteredReport() {
    const filtered = filterRecordsByPeriod(
      this.batches,
      this.expenses,
      this.currentPeriod,
      this.currentMonth,
      todayISO()
    );
    return {
      ...filtered,
      summary: calculateFinancialSummary(filtered.batches, filtered.expenses)
    };
  }

  getSummary() {
    return this.summary || calculateFinancialSummary(this.batches, this.expenses);
  }
}

// Global App Instance
const store = new MelpudStore();
let charts = {};
let realtimeReloadTimer = null;

// UI Initializer
document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initModals();
  initAiChatWidget();
  initChartFilters();
  try {
    await store.init();
    renderSyncStatus(store.repo.mode);
    if (store.repo.mode === 'supabase') {
      await store.repo.subscribeRealtime(() => {
        clearTimeout(realtimeReloadTimer);
        realtimeReloadTimer = setTimeout(async () => {
          try {
            await store.init();
            renderAll();
          } catch (e) {
            console.error('Realtime refresh error:', e);
          }
        }, 250);
      });
    }
  } catch (err) {
    console.error(err);
    renderSyncStatus('error', err.message);
    showToast(err.message);
  }

  renderAll();
});

function renderSyncStatus(mode, errorMsg = '') {
  const dot = document.getElementById('syncStatusDot');
  const text = document.getElementById('syncStatusText');
  if (!dot || !text) return;

  dot.classList.remove('local', 'error');
  if (mode === 'supabase') {
    text.textContent = 'Terhubung ke Supabase';
  } else if (mode === 'error') {
    dot.classList.add('error');
    text.textContent = 'Koneksi Supabase Gagal';
    text.title = errorMsg;
  } else {
    dot.classList.add('local');
    text.textContent = 'Mode Lokal (Isi supabase-config.js)';
  }
}

// Render everything
function renderAll() {
  renderSummaryCards();
  renderOutletsGrid();
  renderReportSummaryStrip();
  renderRecentTransactions();
  renderConsignmentTable();
  renderExpensesTable();
  renderMasterTables();
  populateDropdowns();
  renderCharts();
}

// 1. Navigation logic
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.content-view');
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      views.forEach(v => {
        if (v.id === `view-${targetView}`) {
          v.classList.add('active');
        } else {
          v.classList.remove('active');
        }
      });

      if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }

      if (targetView === 'dashboard' || targetView === 'analytics') {
        setTimeout(renderCharts, 50);
      }
    });
  });

  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !mobileBtn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

// 2. Financial Summary Cards (PRD Section 3 & 6)
function renderSummaryCards() {
  const summary = store.getSummary();

  document.getElementById('topbarNetCash').textContent = formatRupiah(summary.netCash);
  document.getElementById('topbarReceivables').textContent = formatRupiah(summary.totalReceivables);

  document.getElementById('metricReceivables').textContent = formatRupiah(summary.totalReceivables);
  document.getElementById('metricCashIn').textContent = formatRupiah(summary.realCashIn);
  document.getElementById('metricExpenses').textContent = formatRupiah(summary.totalExpenses);
  document.getElementById('metricNetCash').textContent = formatRupiah(summary.netCash);
  document.getElementById('metricProfitProjection').textContent = `Proyeksi Laba Bersih: ${formatRupiah(summary.projectedProfit)}`;

  const hasActivity = store.batches.length > 0 || store.expenses.length > 0;
  const alertEl = document.getElementById('lowCashAlert');
  if (hasActivity && summary.lowCashWarning) {
    alertEl.classList.remove('hidden');
  } else {
    alertEl.classList.add('hidden');
  }
}

// 3. Grid Kartu Outlet Mitra (Real-Time Piutang, Terakhir Bayar, & Daftar Transaksi Outlet)
function formatLastPaidLabel(billing) {
  if (billing.daysSinceLastPaid === 0) {
    return `Hari ini (${shortDate(billing.lastPaidAt)})`;
  }
  if (billing.daysSinceLastPaid !== null) {
    return `${billing.daysSinceLastPaid} hari lalu (${shortDate(billing.lastPaidAt)})`;
  }
  if (billing.oldestUnpaidDays !== null) {
    return `Belum setor (piutang ${billing.oldestUnpaidDays} hari)`;
  }
  return 'Belum ada transaksi';
}

function renderOutletsGrid() {
  const grid = document.getElementById('outletsGrid');
  grid.innerHTML = '';
  const today = todayISO();

  store.outlets.forEach(outlet => {
    const billing = getOutletBillingStatus(outlet.id, store.batches, today);
    const activeBatch = billing.activeBatch;
    const unpaidSum = billing.unpaidTotal;

    const card = document.createElement('div');
    card.className = 'outlet-card';

    let statusBadge = '<span class="badge badge-neutral">Siap Drop</span>';
    if (activeBatch) {
      statusBadge = `<span class="badge badge-active">Titip: ${activeBatch.qtyDrop} Cup</span>`;
    } else if (billing.unpaidCount > 0) {
      statusBadge = `<span class="badge badge-unpaid">Piutang ${formatRupiah(unpaidSum)}</span>`;
    } else if (billing.totalBatches > 0) {
      statusBadge = '<span class="badge badge-paid">Lunas</span>';
    }

    const txRowsHtml = billing.transactions.length === 0
      ? '<div class="outlet-tx-empty">Belum ada riwayat transaksi & piutang di outlet ini.</div>'
      : billing.transactions.map(t => {
          let txBadge = '<span class="badge badge-active">ACTIVE</span>';
          if (t.status === 'RECONCILED') {
            txBadge = t.paymentStatus === 'PAID'
              ? `<span class="badge badge-paid">LUNAS ${t.paidAt ? shortDate(t.paidAt) : ''}</span>`
              : '<span class="badge badge-unpaid">UNPAID</span>';
          }
          return `
            <div class="outlet-tx-row">
              <div class="outlet-tx-line">
                <span class="outlet-tx-title">${shortDate(t.date)} • ${escapeHtml(t.productName)}</span>
                ${t.status === 'RECONCILED' ? `<strong class="outlet-tx-right">${formatRupiah(t.bill)}</strong>` : ''}
              </div>
              <div class="outlet-tx-line">
                <span class="outlet-tx-sub">Titip ${t.qtyDrop}${t.qtyReturned !== null ? ` • Sisa ${t.qtyReturned} • Laku ${t.qtySold}` : ' • Berjalan'}</span>
                <div class="outlet-tx-right">
                  ${txBadge}
                  <button type="button" class="btn-tx-edit" data-batch="${escapeHtml(t.id)}" aria-label="Edit transaksi">Edit</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

    card.innerHTML = `
      <div>
        <div class="outlet-card-header">
          <div>
            <h3 class="outlet-name">${escapeHtml(outlet.name)}</h3>
            <span class="outlet-contact">${escapeHtml(outlet.contact)}</span>
          </div>
          <div>${statusBadge}</div>
        </div>
        <div class="outlet-stats-row">
          <div class="outlet-stat-item">
            <span class="outlet-stat-lbl">Total Piutang:</span>
            <span class="outlet-stat-val" style="color: ${unpaidSum > 0 ? 'var(--status-unpaid-text)' : 'inherit'}">
              ${formatRupiah(unpaidSum)}
            </span>
          </div>
          <div class="outlet-stat-item">
            <span class="outlet-stat-lbl">Terakhir Bayar:</span>
            <span class="outlet-stat-val">${formatLastPaidLabel(billing)}</span>
          </div>
          <div class="outlet-stat-item">
            <span class="outlet-stat-lbl">Batch Aktif:</span>
            <span class="outlet-stat-val">${activeBatch ? activeBatch.qtyDrop + ' cup' : 'Tidak ada'}</span>
          </div>
        </div>
        <div class="outlet-tx-list">${txRowsHtml}</div>
      </div>
      <div class="outlet-actions">
        <button class="btn btn-secondary btn-outlet btn-drop" data-outlet="${escapeHtml(outlet.id)}">+ Drop</button>
        ${activeBatch ? `<button class="btn btn-primary btn-outlet btn-rec" data-batch="${escapeHtml(activeBatch.id)}">Retur</button>` : ''}
        ${unpaidSum > 0 ? `<button class="btn btn-primary btn-outlet btn-settle" data-outlet="${escapeHtml(outlet.id)}">Lunasi</button>` : ''}
      </div>
    `;

    grid.appendChild(card);
  });

  grid.querySelectorAll('.btn-tx-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditBatchModal(btn.getAttribute('data-batch')));
  });

  grid.querySelectorAll('.btn-drop').forEach(btn => {
    btn.addEventListener('click', () => openDropModal(btn.getAttribute('data-outlet')));
  });

  grid.querySelectorAll('.btn-rec').forEach(btn => {
    btn.addEventListener('click', () => openReconcileModal(btn.getAttribute('data-batch')));
  });
  grid.querySelectorAll('.btn-settle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const outletId = btn.getAttribute('data-outlet');
      const outlet = store.outlets.find(o => o.id === outletId);
      btn.disabled = true;
      try {
        await store.settleOutlet(outletId);
        showToast(`Pembayaran penuh tercatat di ${outlet ? outlet.name : 'outlet'}!`);
        renderAll();
      } catch (err) {
        showToast('Gagal menyimpan pelunasan: ' + err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// 4. Recent Transactions Log (PRD Section 6)
function renderRecentTransactions() {
  const tbody = document.getElementById('recentTransactionsTableBody');
  tbody.innerHTML = '';

  const report = store.getFilteredReport();
  const list = [];
  report.batches.forEach(b => {
    const outlet = store.outlets.find(o => o.id === b.outletId);
    const sold = b.status === 'RECONCILED' ? Math.max(0, b.qtyDrop - (b.qtyReturned || 0)) : 0;
    const amount = sold * (b.priceUnit || 5000);

    list.push({
      date: b.date,
      type: 'Konsinyasi',
      point: outlet ? outlet.name : b.outletId,
      detail: `${b.productName} (${b.qtyDrop} cup titip${b.qtyReturned !== null ? ', sisa ' + b.qtyReturned : ''})`,
      statusAlur: b.status,
      statusKas: b.paymentStatus,
      amount,
      isExpense: false
    });
  });

  report.expenses.forEach(e => {
    list.push({
      date: e.date,
      type: 'Belanja',
      point: e.category,
      detail: e.description,
      statusAlur: 'SELESAI',
      statusKas: 'DEDUKSI KAS',
      amount: e.amount,
      isExpense: true
    });
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-table-cell">
          Belum ada transaksi pada periode <strong>${escapeHtml(report.periodLabel)}</strong>.
        </td>
      </tr>
    `;
    return;
  }

  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  list.slice(0, 8).forEach(item => {
    const tr = document.createElement('tr');
    const badgeAlur = item.statusAlur === 'ACTIVE'
      ? '<span class="badge badge-active">ACTIVE</span>'
      : (item.statusAlur === 'RECONCILED' ? '<span class="badge badge-neutral">RECONCILED</span>' : '<span class="badge badge-neutral">BELANJA</span>');

    let badgeKas = '-';
    if (!item.isExpense) {
      badgeKas = item.statusKas === 'PAID'
        ? '<span class="badge badge-paid">PAID (Kas Riil)</span>'
        : '<span class="badge badge-unpaid">UNPAID (Piutang)</span>';
    } else {
      badgeKas = '<span class="badge" style="background:#FDF0EE;color:#8E2B1E;border:1px solid #F7CCC6;">AUTO-POTONG</span>';
    }

    const amountDisplay = item.isExpense
      ? `<span style="color:var(--status-expense-text);font-weight:700;">-${formatRupiah(item.amount)}</span>`
      : `<span style="color:var(--status-paid-text);font-weight:700;">+${formatRupiah(item.amount)}</span>`;

    tr.innerHTML = `
      <td>${escapeHtml(item.date)}</td>
      <td><strong>${escapeHtml(item.type)}</strong></td>
      <td>${escapeHtml(item.point)}</td>
      <td>${escapeHtml(item.detail)}</td>
      <td>${badgeAlur}</td>
      <td>${badgeKas}</td>
      <td class="text-right">${item.amount > 0 ? amountDisplay : 'Rp 0'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 5. Consignment Batch Table
function renderConsignmentTable() {
  const tbody = document.getElementById('consignmentTableBody');
  tbody.innerHTML = '';

  if (store.batches.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-table-cell">
          Belum ada data batch konsinyasi. Klik <strong>+ Drop Batch Baru</strong> untuk memulai penitipan ke outlet mitra.
        </td>
      </tr>
    `;
    return;
  }

  store.batches.forEach(b => {
    const outlet = store.outlets.find(o => o.id === b.outletId);
    const sold = b.status === 'RECONCILED' ? Math.max(0, b.qtyDrop - (b.qtyReturned || 0)) : 0;
    const bill = sold * (b.priceUnit || 5000);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(b.date)}</td>
      <td><strong>${escapeHtml(outlet ? outlet.name : b.outletId)}</strong></td>
      <td>${escapeHtml(b.productName)}</td>
      <td>${b.qtyDrop} cup</td>
      <td>${b.qtyReturned !== null ? b.qtyReturned + ' cup' : '<span style="color:var(--text-muted)">Belum Retur</span>'}</td>
      <td><strong>${sold} cup</strong></td>
      <td><strong>${formatRupiah(bill)}</strong></td>
      <td>
        ${b.status === 'ACTIVE'
          ? '<span class="badge badge-active">ACTIVE</span>'
          : '<span class="badge badge-neutral">RECONCILED</span>'}
      </td>
      <td>
        ${b.paymentStatus === 'PAID'
          ? '<span class="badge badge-paid">PAID</span>'
          : '<span class="badge badge-unpaid">UNPAID</span>'}
      </td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-secondary btn-sm table-btn-edit" data-batch="${escapeHtml(b.id)}">Edit</button>
          ${b.status === 'ACTIVE'
            ? `<button class="btn btn-secondary btn-sm table-btn-rec" data-batch="${escapeHtml(b.id)}">Retur</button>`
            : ''}
          ${b.paymentStatus === 'UNPAID' && b.status === 'RECONCILED'
            ? `<button class="btn btn-primary btn-sm table-btn-pay" data-batch="${escapeHtml(b.id)}">Bayar</button>`
            : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.table-btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditBatchModal(btn.getAttribute('data-batch')));
  });

  tbody.querySelectorAll('.table-btn-rec').forEach(btn => {
    btn.addEventListener('click', () => openReconcileModal(btn.getAttribute('data-batch')));
  });

  tbody.querySelectorAll('.table-btn-pay').forEach(btn => {
    btn.addEventListener('click', async () => {
      const batchId = btn.getAttribute('data-batch');
      try {
        await store.settleBatch(batchId);
        showToast('Status pembayaran batch berhasil diubah menjadi PAID!');
        renderAll();
      } catch (err) {
        showToast('Gagal menyimpan pembayaran: ' + err.message);
      }
    });
  });
}

// 6. Expenses Table
function renderExpensesTable() {
  const tbody = document.getElementById('expensesTableBody');
  tbody.innerHTML = '';

  if (store.expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-table-cell">
          Belum ada catatan belanja bahan. Klik <strong>+ Catat Belanja Bahan</strong> atau ketik di AI Quick-Log.
        </td>
      </tr>
    `;
    return;
  }

  store.expenses.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(e.date)}</td>
      <td><span class="badge badge-neutral">${escapeHtml(e.category)}</span></td>
      <td>${escapeHtml(e.description)}</td>
      <td class="text-right" style="color:var(--status-expense-text);font-weight:700;">-${formatRupiah(e.amount)}</td>
      <td><span class="badge badge-paid">Tercatat Memotong Kas</span></td>
      <td>
        <button class="btn-icon-sm exp-del-btn" data-id="${escapeHtml(e.id)}" title="Hapus">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.exp-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Hapus pencatatan pengeluaran ini?')) {
        try {
          await store.removeExpense(id);
          showToast('Catatan pengeluaran dihapus');
          renderAll();
        } catch (err) {
          showToast('Gagal menghapus pengeluaran: ' + err.message);
        }
      }
    });
  });
}

// 7. Master Data Tables (Products & Outlets)
function renderMasterTables() {
  const pBody = document.getElementById('masterProductsTableBody');
  pBody.innerHTML = '';
  store.products.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td class="text-right">${formatRupiah(p.price)} / cup</td>
      <td><span class="badge badge-paid">Aktif Dijual</span></td>
    `;
    pBody.appendChild(tr);
  });

  const oBody = document.getElementById('masterOutletsTableBody');
  oBody.innerHTML = '';
  store.outlets.forEach(o => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(o.name)}</strong></td>
      <td>${escapeHtml(o.contact)}</td>
      <td><span class="badge badge-paid">Mitra Aktif</span></td>
    `;
    oBody.appendChild(tr);
  });
}

function populateDropdowns() {
  ['dropOutlet', 'editBatchOutlet'].forEach(selId => {
    const el = document.getElementById(selId);
    if (!el) return;
    el.innerHTML = '';
    store.outlets.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name;
      el.appendChild(opt);
    });
  });

  ['dropProduct', 'editBatchProduct'].forEach(selId => {
    const el = document.getElementById(selId);
    if (!el) return;
    el.innerHTML = '';
    store.products.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${formatRupiah(p.price)})`;
      el.appendChild(opt);
    });
  });
}

// 8. Interactive Charts (PRD Section 4)
function renderCharts() {
  renderFinancialBarChart('financialBarChart');
  renderFinancialBarChart('financialBarChartDetail');

  renderExpenseDonutChart('expenseDonutChart');
  renderExpenseDonutChart('expenseDonutChartDetail');

  renderCashTrendLineChart('cashTrendLineChart');
  renderCashTrendLineChart('cashTrendLineChartDetail');
}

function renderReportSummaryStrip() {
  const report = store.getFilteredReport();
  const netProfit = report.summary.realCashIn - report.summary.totalExpenses;

  const labelEl = document.getElementById('reportPeriodLabel');
  const cashEl = document.getElementById('reportCashIn');
  const expEl = document.getElementById('reportExpenses');
  const netEl = document.getElementById('reportNetProfit');
  const subEl = document.getElementById('analyticsPeriodSubtitle');

  if (labelEl) labelEl.textContent = report.periodLabel;
  if (cashEl) cashEl.textContent = formatRupiah(report.summary.realCashIn);
  if (expEl) expEl.textContent = formatRupiah(report.summary.totalExpenses);
  if (netEl) netEl.textContent = formatRupiah(netProfit);
  if (subEl) subEl.textContent = `Periode aktif: ${report.periodLabel}`;
}

function initChartFilters() {
  const chips = document.querySelectorAll('.filter-chip');
  const monthInputs = [
    document.getElementById('reportMonthInput'),
    document.getElementById('analyticsMonthInput')
  ].filter(Boolean);

  monthInputs.forEach(inp => {
    inp.value = store.currentMonth;
    inp.addEventListener('change', () => {
      if (inp.value) {
        store.currentMonth = inp.value;
        monthInputs.forEach(other => { other.value = store.currentMonth; });
        if (store.currentPeriod === 'all') {
          store.currentPeriod = 'month';
          chips.forEach(c => c.classList.toggle('active', c.getAttribute('data-period') === 'month'));
        }
        renderReportSummaryStrip();
        renderRecentTransactions();
        renderCharts();
      }
    });
  });

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const period = chip.getAttribute('data-period');
      store.currentPeriod = period;
      chips.forEach(c => c.classList.toggle('active', c.getAttribute('data-period') === period));
      renderReportSummaryStrip();
      renderRecentTransactions();
      renderCharts();
    });
  });
}

// 8.1 Diagram Batang - Kinerja Finansial (PRD 4.1)
function renderFinancialBarChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  const { summary } = store.getFilteredReport();
  const netProfit = summary.realCashIn - summary.totalExpenses;

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  charts[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Kas Masuk (Lunas)', 'Pengeluaran Bahan', 'Laba Bersih Kas'],
      datasets: [{
        label: 'Nominal (Rp)',
        data: [summary.realCashIn, summary.totalExpenses, Math.max(0, netProfit)],
        backgroundColor: ['#245C38', '#8E2B1E', '#5C3A21'],
        borderRadius: 6,
        barThickness: 36
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatRupiah(ctx.raw)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 50000,
          ticks: {
            callback: (v) => 'Rp ' + Math.round(v / 1000) + 'k'
          },
          grid: { color: '#EAE3D9' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

// 8.2 Diagram Donat - Komposisi Pengeluaran (PRD 4.3)
function renderExpenseDonutChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  const { expenses } = store.getFilteredReport();
  let bahan = 0;
  let kemasan = 0;
  let ops = 0;

  expenses.forEach(e => {
    if (e.category === 'Kemasan') kemasan += Number(e.amount) || 0;
    else if (e.category === 'Operasional Lainnya') ops += Number(e.amount) || 0;
    else bahan += Number(e.amount) || 0;
  });

  const total = bahan + kemasan + ops;

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  charts[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: total > 0
        ? ['Bahan Baku Utama', 'Kemasan & Cup', 'Operasional Lainnya']
        : ['Belum Ada Pengeluaran'],
      datasets: [{
        data: total > 0 ? [bahan, kemasan, ops] : [1],
        backgroundColor: total > 0
          ? ['#5C3A21', '#A86B32', '#1C1714']
          : ['#E6DFD5'],
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => total > 0
              ? ` ${ctx.label}: ${formatRupiah(ctx.raw)}`
              : ' Belum ada pengeluaran tercatat'
          }
        }
      },
      cutout: '68%'
    }
  });
}

// 8.3 Diagram Garis - Tren Saldo Kas Harian (PRD 4.2)
function renderCashTrendLineChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  const { batches, expenses } = store.getFilteredReport();
  const dateSet = new Set();
  batches.forEach(b => {
    if (b.paymentStatus === 'PAID') dateSet.add(b.paidAt || b.date);
    else if (b.date) dateSet.add(b.date);
  });
  expenses.forEach(e => {
    if (e.date) dateSet.add(e.date);
  });

  if (dateSet.size === 0) {
    dateSet.add(todayISO());
  }

  const dates = Array.from(dateSet).sort();
  const labels = dates.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return Number.isNaN(dt.getTime())
      ? d
      : dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  });

  const balances = [];
  let running = 0;

  dates.forEach(d => {
    let dayCashIn = 0;
    batches.forEach(b => {
      if (b.paymentStatus === 'PAID' && (b.paidAt === d || (!b.paidAt && b.date === d))) {
        const sold = Math.max(0, b.qtyDrop - (b.qtyReturned || 0));
        dayCashIn += sold * (b.priceUnit || 5000);
      }
    });

    let dayExp = 0;
    expenses.forEach(e => {
      if (e.date === d) dayExp += Number(e.amount) || 0;
    });

    running += (dayCashIn - dayExp);
    balances.push(running);
  });

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  charts[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Saldo Kas Riil (Rp)',
          data: balances,
          borderColor: '#5C3A21',
          backgroundColor: 'rgba(92, 58, 33, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: '#3D2314',
          pointRadius: 4
        },
        {
          label: 'Ambang Batas Minimum (Rp 50k)',
          data: dates.map(() => 50000),
          borderColor: '#C25E34',
          borderDash: [5, 5],
          borderWidth: 1.5,
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => 'Rp ' + (v / 1000) + 'k'
          },
          grid: { color: '#EAE3D9' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

// 9. Floating WA-Style AI Chat Widget
function initAiChatWidget() {
  const fab = document.getElementById('aiFabBtn');
  const panel = document.getElementById('aiChatPanel');
  const closeBtn = document.getElementById('aiChatCloseBtn');
  const messagesEl = document.getElementById('aiChatMessages');
  const input = document.getElementById('aiQuickInput');
  const submitBtn = document.getElementById('aiSubmitBtn');

  let welcomeShown = false;

  function appendMessage(role, html) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`;
    div.innerHTML = html;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function ensureWelcome() {
    if (welcomeShown) return;
    welcomeShown = true;
    appendMessage('bot', `
      <strong>Perintah Asisten AI Melpud:</strong>
      <ol class="chat-cmd-list">
        <li><strong>Lunas semua outlet:</strong> "di outlet p bungin lunas semua"</li>
        <li><strong>Cek hutang &amp; bawaan:</strong> "info p bungin bawa berapa hari ini" atau "tgl 9"</li>
        <li><strong>Catat pengeluaran:</strong> "saya keluarin uang 50rb hari ini untuk belanja gula total 50rb"</li>
        <li><strong>Drop &amp; Retur:</strong> "taruh di p bungin 10 cup coklat" / "di p bungin sisa 2"</li>
      </ol>
    `);
  }

  function toggleChat(forceOpen) {
    const isHidden = panel.classList.contains('hidden');
    const shouldOpen = forceOpen !== undefined ? forceOpen : isHidden;
    if (shouldOpen) {
      panel.classList.remove('hidden');
      ensureWelcome();
      input.focus();
    } else {
      panel.classList.add('hidden');
    }
  }

  fab.addEventListener('click', () => toggleChat());
  closeBtn.addEventListener('click', () => toggleChat(false));
  submitBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  function buildOutletInfoReply(data) {
    const today = todayISO();
    if (data.outletId === 'ALL') {
      const lines = store.outlets.map(o => {
        const b = getOutletBillingStatus(o.id, store.batches, today);
        const onDate = store.batches.filter(x => x.outletId === o.id && x.date === data.targetDate)
          .reduce((s, x) => s + x.qtyDrop, 0);
        return `• <strong>${escapeHtml(o.name)}</strong>: Hutang ${formatRupiah(b.unpaidTotal)} | Bawa (${escapeHtml(data.targetDateLabel)}): ${onDate} cup`;
      }).join('<br>');
      return `<strong>Ringkasan Semua Outlet (${escapeHtml(data.targetDateLabel)}):</strong><br>${lines}`;
    }

    const billing = getOutletBillingStatus(data.outletId, store.batches, today);
    const dateBatches = store.batches.filter(b => b.outletId === data.outletId && b.date === data.targetDate);
    const totalOnDate = dateBatches.reduce((sum, b) => sum + b.qtyDrop, 0);

    let dateDetail = `Belum ada titipan tercatat pada ${escapeHtml(data.targetDateLabel)} (${shortDate(data.targetDate)}).`;
    if (dateBatches.length > 0) {
      const rows = dateBatches.map(b => {
        const sold = b.status === 'RECONCILED' ? Math.max(0, b.qtyDrop - (b.qtyReturned || 0)) : 0;
        return `${b.qtyDrop} cup ${escapeHtml(b.productName)} (${b.status === 'ACTIVE' ? 'Berjalan' : `Sisa ${b.qtyReturned}, Laku ${sold}, ${b.paymentStatus}`})`;
      }).join('<br>');
      dateDetail = `Bawa <strong>${totalOnDate} cup</strong> pada ${escapeHtml(data.targetDateLabel)} (${shortDate(data.targetDate)}):<br>${rows}`;
    }

    return `
      <strong>Info Outlet ${escapeHtml(data.outletName)}</strong><br>
      • <strong>Hutang Belum Dibayar:</strong> ${formatRupiah(billing.unpaidTotal)} (${billing.unpaidCount} nota)<br>
      • <strong>Terakhir Bayar:</strong> ${formatLastPaidLabel(billing)}<br>
      • <strong>Titipan Tanggal Ini:</strong> ${dateDetail}
    `;
  }

  function handleSend() {
    const raw = input.value.trim();
    if (!raw) return;
    input.value = '';
    appendMessage('user', escapeHtml(raw));

    const parsed = parseNLPCommand(raw, store.outlets, store.products, store.batches, todayISO());
    if (!parsed) {
      appendMessage('bot', 'Maaf, perintah belum dikenali. Coba: <em>"info p bungin bawa berapa hari ini"</em>, <em>"di outlet p bungin lunas semua"</em>, atau <em>"keluarin uang 50rb hari ini buat beli susu"</em>.');
      return;
    }

    if (parsed.action === 'PROMPT_CLARIFY') {
      appendMessage('bot', escapeHtml(parsed.summary));
      return;
    }

    if (parsed.action === 'QUERY_OUTLET_INFO') {
      appendMessage('bot', buildOutletInfoReply(parsed.data));
      return;
    }

    const bubble = appendMessage('bot', `
      <strong>${escapeHtml(parsed.title)}</strong><br>
      <span>${escapeHtml(parsed.summary)}</span>
      <div class="chat-confirm-box">
        <div class="chat-confirm-actions">
          <button type="button" class="btn btn-secondary btn-sm chat-btn-cancel">Batal</button>
          <button type="button" class="btn btn-primary btn-sm chat-btn-confirm">Simpan</button>
        </div>
      </div>
    `);

    const confirmBtn = bubble.querySelector('.chat-btn-confirm');
    const cancelBtn = bubble.querySelector('.chat-btn-cancel');
    const box = bubble.querySelector('.chat-confirm-box');

    cancelBtn.addEventListener('click', () => {
      box.innerHTML = '<span style="color:var(--text-muted);font-size:0.75rem;">Dibatalkan.</span>';
    });

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      const data = parsed.data;
      try {
        if (parsed.action === 'CREATE_DROP') {
          await store.addBatch({
            date: todayISO(),
            outletId: data.outletId,
            productId: data.productId,
            productName: data.productName,
            qtyDrop: data.qtyDrop,
            priceUnit: data.priceUnit
          });
          box.innerHTML = `<span style="color:var(--status-paid-text);font-weight:600;font-size:0.75rem;">Tersimpan: ${data.qtyDrop} cup ke ${escapeHtml(data.outletName)}.</span>`;
        } else if (parsed.action === 'RECONCILE_BATCH') {
          const b = store.batches.find(x => x.outletId === data.outletId && x.status === 'ACTIVE')
            || store.batches.find(x => x.outletId === data.outletId);
          if (!b) throw new Error(`Belum ada batch aktif di ${data.outletName}.`);
          await store.reconcileBatch(b.id, data.qtyReturned, data.paymentStatus);
          box.innerHTML = `<span style="color:var(--status-paid-text);font-weight:600;font-size:0.75rem;">Rekonsiliasi ${escapeHtml(data.outletName)} tersimpan.</span>`;
        } else if (parsed.action === 'SETTLE_PAYMENT') {
          const settled = await store.settleOutlet(data.outletId);
          box.innerHTML = `<span style="color:var(--status-paid-text);font-weight:600;font-size:0.75rem;">Selesai! ${settled} tagihan ${escapeHtml(data.outletName)} dilunasi.</span>`;
        } else if (parsed.action === 'RECORD_EXPENSE') {
          await store.addExpense({
            date: data.date || todayISO(),
            category: data.category,
            description: data.description,
            amount: data.amount
          });
          box.innerHTML = `<span style="color:var(--status-paid-text);font-weight:600;font-size:0.75rem;">Pengeluaran ${formatRupiah(data.amount)} masuk ke Buku Kas.</span>`;
        }
        renderAll();
      } catch (err) {
        confirmBtn.disabled = false;
        box.insertAdjacentHTML('beforeend', `<span style="color:var(--status-expense-text);font-size:0.75rem;">Gagal: ${escapeHtml(err.message)}</span>`);
      }
    });
  }
}

// 10. Modals Management
function initModals() {
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
    });
  });

  document.getElementById('btnManualDrop').addEventListener('click', () => openDropModal());
  document.getElementById('btnManualExpense').addEventListener('click', () => openExpenseModal());
  document.getElementById('btnOpenNewOutlet').addEventListener('click', () => openNewOutletModal());
  document.getElementById('btnOpenNewOutlet2').addEventListener('click', () => openNewOutletModal());
  document.getElementById('btnOpenNewProduct').addEventListener('click', () => openNewProductModal());

  // Form Drop Batch Submit
  document.getElementById('formDropBatch').addEventListener('submit', async (e) => {
    e.preventDefault();
    const outletId = document.getElementById('dropOutlet').value;
    const productId = document.getElementById('dropProduct').value;
    const qty = parseInt(document.getElementById('dropQty').value, 10);
    const date = document.getElementById('dropDate').value;
    const prod = store.products.find(p => p.id === productId);

    try {
      await store.addBatch({
        date,
        outletId,
        productId,
        productName: prod ? prod.name : 'Pudding Coklat',
        priceUnit: prod ? prod.price : 5000,
        qtyDrop: qty
      });
      document.getElementById('modalDropBatch').classList.add('hidden');
      showToast('Batch konsinyasi berhasil ditambahkan!');
      renderAll();
    } catch (err) {
      showToast('Gagal menyimpan batch: ' + err.message);
    }
  });

  // Form Reconcile Submit
  const recQtyInput = document.getElementById('recQtyReturned');
  recQtyInput.addEventListener('input', updateReconcilePreview);

  document.getElementById('formReconcile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const batchId = document.getElementById('recBatchId').value;
    const qtyReturned = parseInt(recQtyInput.value, 10);
    const paymentStatus = document.getElementById('recPaymentStatus').value;

    try {
      await store.reconcileBatch(batchId, qtyReturned, paymentStatus);
      document.getElementById('modalReconcile').classList.add('hidden');
      showToast('Rekonsiliasi retur berhasil disimpan!');
      renderAll();
    } catch (err) {
      showToast('Gagal menyimpan rekonsiliasi: ' + err.message);
    }
  });

  // Form Edit Batch Submit & Delete
  const editStatusEl = document.getElementById('editBatchStatus');
  const editQtyDropEl = document.getElementById('editBatchQtyDrop');
  const editQtyRetEl = document.getElementById('editBatchQtyReturned');
  const editProdEl = document.getElementById('editBatchProduct');
  [editStatusEl, editQtyDropEl, editQtyRetEl, editProdEl].forEach(el => {
    el.addEventListener('change', updateEditBatchPreview);
    el.addEventListener('input', updateEditBatchPreview);
  });

  document.getElementById('formEditBatch').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editBatchId').value;
    const date = document.getElementById('editBatchDate').value;
    const outletId = document.getElementById('editBatchOutlet').value;
    const productId = editProdEl.value;
    const prod = store.products.find(p => p.id === productId);
    const qtyDrop = Math.max(1, parseInt(editQtyDropEl.value, 10) || 1);
    const status = editStatusEl.value;
    const qtyReturned = status === 'RECONCILED'
      ? Math.min(qtyDrop, Math.max(0, parseInt(editQtyRetEl.value, 10) || 0))
      : null;
    const paymentStatus = status === 'RECONCILED'
      ? document.getElementById('editBatchPaymentStatus').value
      : 'UNPAID';
    const existing = store.batches.find(x => x.id === id);
    const paidAt = status === 'RECONCILED' && paymentStatus === 'PAID'
      ? (existing?.paidAt || todayISO())
      : null;

    try {
      await store.updateBatch({
        id,
        date,
        outletId,
        productId,
        productName: prod ? prod.name : (existing?.productName || 'Pudding Coklat'),
        priceUnit: prod ? prod.price : (existing?.priceUnit || 5000),
        qtyDrop,
        qtyReturned,
        status,
        paymentStatus,
        paidAt
      });
      document.getElementById('modalEditBatch').classList.add('hidden');
      showToast('Transaksi konsinyasi diperbarui!');
      renderAll();
    } catch (err) {
      showToast('Gagal memperbarui transaksi: ' + err.message);
    }
  });

  document.getElementById('btnDeleteBatch').addEventListener('click', async () => {
    const id = document.getElementById('editBatchId').value;
    try {
      await store.deleteBatch(id);
      document.getElementById('modalEditBatch').classList.add('hidden');
      showToast('Transaksi konsinyasi dihapus.');
      renderAll();
    } catch (err) {
      showToast('Gagal menghapus transaksi: ' + err.message);
    }
  });

  // Form Expense Submit
  document.getElementById('formExpense').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('expDate').value;
    const category = document.getElementById('expCategory').value;
    const desc = document.getElementById('expDesc').value;
    const amount = parseInt(document.getElementById('expAmount').value, 10);

    try {
      await store.addExpense({ date, category, description: desc, amount });
      document.getElementById('modalExpense').classList.add('hidden');
      showToast('Belanja bahan berhasil dicatat dan kas dipotong!');
      renderAll();
    } catch (err) {
      showToast('Gagal menyimpan belanja: ' + err.message);
    }
  });

  // Form New Outlet Submit
  document.getElementById('formNewOutlet').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newOutletName').value.trim();
    const contact = document.getElementById('newOutletContact').value.trim();

    try {
      await store.addOutlet(name, contact);
      document.getElementById('modalNewOutlet').classList.add('hidden');
      document.getElementById('newOutletName').value = '';
      document.getElementById('newOutletContact').value = '';
      showToast(`Outlet ${name} berhasil didaftarkan!`);
      renderAll();
    } catch (err) {
      showToast('Gagal menambah outlet: ' + err.message);
    }
  });

  // Form New Product Submit
  document.getElementById('formNewProduct').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newProductName').value.trim();
    const price = parseInt(document.getElementById('newProductPrice').value, 10);

    try {
      await store.addProduct(name, price);
      document.getElementById('modalNewProduct').classList.add('hidden');
      document.getElementById('newProductName').value = '';
      showToast(`Varian ${name} (@ ${formatRupiah(price)}) berhasil ditambahkan!`);
      renderAll();
    } catch (err) {
      showToast('Gagal menambah varian produk: ' + err.message);
    }
  });
}

function openDropModal(preselectedOutletId) {
  document.getElementById('dropDate').value = todayISO();
  if (preselectedOutletId) {
    document.getElementById('dropOutlet').value = preselectedOutletId;
  }
  document.getElementById('modalDropBatch').classList.remove('hidden');
}

function openReconcileModal(batchId) {
  const b = store.batches.find(x => x.id === batchId);
  if (!b) return;

  const outlet = store.outlets.find(o => o.id === b.outletId);
  document.getElementById('recBatchId').value = b.id;
  document.getElementById('recBatchInfo').innerHTML = `
    <strong>Outlet:</strong> ${escapeHtml(outlet ? outlet.name : b.outletId)} | <strong>Varian:</strong> ${escapeHtml(b.productName)}<br>
    <strong>Qty Titip:</strong> ${b.qtyDrop} cup (@ ${formatRupiah(b.priceUnit || 5000)})
  `;
  document.getElementById('recQtyReturned').value = b.qtyReturned !== null ? b.qtyReturned : 0;
  document.getElementById('recQtyReturned').max = b.qtyDrop;
  document.getElementById('recPaymentStatus').value = b.paymentStatus || 'UNPAID';

  updateReconcilePreview();
  document.getElementById('modalReconcile').classList.remove('hidden');
}

function openEditBatchModal(batchId) {
  const b = store.batches.find(x => x.id === batchId);
  if (!b) return;

  document.getElementById('editBatchId').value = b.id;
  document.getElementById('editBatchDate').value = b.date || todayISO();
  document.getElementById('editBatchOutlet').value = b.outletId;
  document.getElementById('editBatchProduct').value = b.productId;
  document.getElementById('editBatchQtyDrop').value = b.qtyDrop;
  document.getElementById('editBatchStatus').value = b.status;
  document.getElementById('editBatchQtyReturned').value = b.qtyReturned !== null ? b.qtyReturned : 0;
  document.getElementById('editBatchPaymentStatus').value = b.paymentStatus || 'UNPAID';

  updateEditBatchPreview();
  document.getElementById('modalEditBatch').classList.remove('hidden');
}

function updateEditBatchPreview() {
  const status = document.getElementById('editBatchStatus').value;
  const recFields = document.getElementById('editReconciledFields');
  const qtyDrop = Math.max(1, parseInt(document.getElementById('editBatchQtyDrop').value, 10) || 1);
  const qtyRetEl = document.getElementById('editBatchQtyReturned');
  qtyRetEl.max = qtyDrop;

  const prodId = document.getElementById('editBatchProduct').value;
  const prod = store.products.find(p => p.id === prodId);
  const price = prod ? prod.price : 5000;

  if (status === 'ACTIVE') {
    recFields.classList.add('hidden');
    document.getElementById('editCalcSoldQty').textContent = '0 cup (Berjalan)';
    document.getElementById('editCalcTotalBill').textContent = 'Rp 0';
  } else {
    recFields.classList.remove('hidden');
    const qtyRet = Math.min(qtyDrop, Math.max(0, parseInt(qtyRetEl.value, 10) || 0));
    const sold = Math.max(0, qtyDrop - qtyRet);
    document.getElementById('editCalcSoldQty').textContent = `${sold} cup`;
    document.getElementById('editCalcTotalBill').textContent = formatRupiah(sold * price);
  }
}

function updateReconcilePreview() {
  const batchId = document.getElementById('recBatchId').value;
  const b = store.batches.find(x => x.id === batchId);
  if (!b) return;

  const qtyReturned = parseInt(document.getElementById('recQtyReturned').value, 10) || 0;
  const qtySold = Math.max(0, b.qtyDrop - qtyReturned);
  const totalBill = qtySold * (b.priceUnit || 5000);

  document.getElementById('calcSoldQty').textContent = `${qtySold} cup`;
  document.getElementById('calcTotalBill').textContent = formatRupiah(totalBill);
}

function openExpenseModal() {
  document.getElementById('expDate').value = todayISO();
  document.getElementById('expDesc').value = '';
  document.getElementById('expAmount').value = '';
  document.getElementById('modalExpense').classList.remove('hidden');
}

function openNewOutletModal() {
  document.getElementById('modalNewOutlet').classList.remove('hidden');
}

function openNewProductModal() {
  document.getElementById('modalNewProduct').classList.remove('hidden');
}

function showToast(message) {
  const toast = document.getElementById('toastNotification');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3200);
}
