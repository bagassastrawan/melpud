'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Dynamic import of app.js bootstrap so the full Vanilla JS app logic runs seamlessly inside Next.js
    import('../app.js').then((app) => {
      if (typeof app.initApp === 'function') {
        app.initApp();
      }
    }).catch(() => {});
  }, []);

  return (
    <div dangerouslySetInnerHTML={{
      __html: `
        <div class="app-layout">
          <header class="mobile-topbar">
            <button id="mobileMenuBtn" class="btn-icon" aria-label="Buka Menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div class="brand-inline">
              <span class="brand-title">MELPUD</span>
              <span class="brand-badge">Ops v2.0</span>
            </div>
            <div class="topbar-user-mini">
              <span class="user-avatar-mini">M</span>
            </div>
          </header>

          <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
              <div class="brand-wrapper">
                <div class="brand-symbol">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a9 9 0 0 0-9 9c0 4.97 4.03 9 9 9s9-4.03 9-9a9 9 0 0 0-9-9z"></path>
                    <path d="M12 6v6l4 2"></path>
                  </svg>
                </div>
                <div class="brand-text">
                  <h1 class="brand-name">MELPUD</h1>
                  <p class="brand-tagline">Consignment & Operations</p>
                </div>
              </div>
            </div>

            <nav class="sidebar-nav">
              <button class="nav-item active" data-view="dashboard">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>
                <span>Ringkasan Dashboard</span>
              </button>
              <button class="nav-item" data-view="consignment">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                <span>Konsinyasi & Outlet</span>
              </button>
              <button class="nav-item" data-view="expenses">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"></path><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="12" y2="16"></line></svg>
                <span>Buku Kas Belanja</span>
              </button>
              <button class="nav-item" data-view="master">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-7"></path><path d="M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>
                <span>Master Produk & Outlet</span>
              </button>
              <button class="nav-item" data-view="analytics">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                <span>Analitik Diagram</span>
              </button>
              <button onclick="openAiLearningModal()" class="nav-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <span>AI Learning Center (<span id="pendingAiCount">0</span>)</span>
              </button>
            </nav>

            <div class="sidebar-footer">
              <div class="system-status-panel">
                <div class="status-row">
                  <span class="status-label">Metode Kas:</span>
                  <span class="status-val">Cash Basis Riil</span>
                </div>
                <div class="status-row">
                  <span class="status-label">Siklus:</span>
                  <span class="status-val">4 Tahap Konsinyasi</span>
                </div>
                <div class="system-sync-pill" id="syncStatusPill">
                  <span class="sync-dot" id="syncStatusDot"></span>
                  <span id="syncStatusText">Memuat koneksi...</span>
                </div>
              </div>
            </div>
          </aside>

          <main class="main-content">
            <header class="topbar">
              <div class="topbar-stats">
                <div class="topbar-stat-chip chip-cash">
                  <span class="chip-label">Saldo Kas Bersih:</span>
                  <strong class="chip-value" id="topbarNetCash">Rp 0</strong>
                </div>
                <div class="topbar-stat-chip chip-receivable">
                  <span class="chip-label">Piutang Berjalan:</span>
                  <strong class="chip-value" id="topbarReceivables">Rp 0</strong>
                </div>
              </div>

              <div class="topbar-actions">
                <div class="user-pill">
                  <div class="user-avatar">M</div>
                  <div class="user-meta">
                    <span class="user-name">Melpud Owner</span>
                    <span class="user-role">Administrator</span>
                  </div>
                </div>
              </div>
            </header>

            <div id="view-dashboard" class="content-view active">
              <section class="metrics-grid">
                <div class="metric-card metric-receivable">
                  <div class="metric-top">
                    <span class="metric-title">Total Piutang Belum Dibayar</span>
                    <span class="metric-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 1h16v-4"></path><path d="M18 12h.01"></path></svg>
                    </span>
                  </div>
                  <div class="metric-value" id="metricReceivables">Rp 0</div>
                  <div class="metric-foot">Akumulasi tagihan outlet belum lunas</div>
                </div>
                <div class="metric-card metric-cash">
                  <div class="metric-top">
                    <span class="metric-title">Total Kas Masuk (Lunas)</span>
                    <span class="metric-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    </span>
                  </div>
                  <div class="metric-value" id="metricCashIn">Rp 0</div>
                  <div class="metric-foot">Kas riil dari penjualan lunas</div>
                </div>
                <div class="metric-card metric-expense">
                  <div class="metric-top">
                    <span class="metric-title">Total Belanja Bahan</span>
                    <span class="metric-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                    </span>
                  </div>
                  <div class="metric-value" id="metricExpenses">Rp 0</div>
                  <div class="metric-foot">Total pengeluaran bahan & operasional</div>
                </div>
                <div class="metric-card metric-net">
                  <div class="metric-top">
                    <span class="metric-title">Saldo Kas Bersih Riil</span>
                    <span class="metric-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                    </span>
                  </div>
                  <div class="metric-value" id="metricNetCash">Rp 0</div>
                  <div class="metric-foot" id="metricProfitProjection">Proyeksi Laba Bersih: Rp 0</div>
                </div>
              </section>

              <div id="lowCashAlert" class="alert-box alert-warning hidden">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <div class="alert-content">
                  <strong>Peringatan Saldo Kas Kritis:</strong> Saldo kas operasional berada di bawah batas minimum (Rp 50.000). Segera rekonsiliasi dan tagih piutang outlet mitra.
                </div>
              </div>

              <section class="section-block">
                <div class="section-header">
                  <div>
                    <h2 class="section-title">5 Titik Outlet Mitra Terdaftar</h2>
                    <p class="section-subtitle">Status konsinyasi lapangan dan piutang berjalan per titik mitra</p>
                  </div>
                  <button class="btn btn-secondary btn-sm" id="btnOpenNewOutlet">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>Tambah Outlet Baru</span>
                  </button>
                </div>
                <div class="outlets-grid" id="outletsGrid"></div>
              </section>

              <section class="section-block">
                <div class="section-header">
                  <div>
                    <h2 class="section-title">Visualisasi Analitik & Laporan Periodik</h2>
                    <p class="section-subtitle">Laporan mingguan, bulanan per bulan, dan kuartalan beserta tren kas real-time</p>
                  </div>
                  <div class="report-controls">
                    <input type="month" id="reportMonthInput" class="report-month-input" aria-label="Pilih Bulan Laporan">
                    <div class="chart-filter-group">
                      <button class="filter-chip" data-period="week">Mingguan</button>
                      <button class="filter-chip" data-period="month">Bulanan</button>
                      <button class="filter-chip" data-period="quarter">Kuartalan</button>
                    </div>
                  </div>
                </div>

                <div class="charts-grid">
                  <div class="chart-card">
                    <div class="chart-header">
                      <h3>Kinerja Finansial (Kas vs Belanja vs Laba)</h3>
                      <span class="chart-tag" id="chartPeriodLabel">Minggu Ini</span>
                    </div>
                    <div class="chart-container">
                      <canvas id="financialBarChart"></canvas>
                    </div>
                  </div>
                  <div class="chart-card">
                    <div class="chart-header">
                      <h3>Komposisi Pengeluaran Bahan</h3>
                      <span class="chart-tag">Akumulasi</span>
                    </div>
                    <div class="chart-container">
                      <canvas id="expenseDonutChart"></canvas>
                    </div>
                  </div>
                </div>

                <div class="report-summary-box" id="reportSummaryBox">
                  <div class="report-title" id="reportTitle">Laporan Periode Aktif</div>
                  <div class="report-metrics" id="reportMetricsGrid"></div>
                </div>
              </section>

              <section class="section-block">
                <div class="section-header">
                  <div>
                    <h2 class="section-title">Log Transaksi & Riwayat Operasional</h2>
                    <p class="section-subtitle">Daftar seluruh riwayat drop batch, retur, pelunasan piutang, dan belanja</p>
                  </div>
                  <div class="flex gap-2">
                    <button class="btn btn-secondary btn-sm" id="btnOpenNewDrop">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      <span>Catat Drop</span>
                    </button>
                    <button class="btn btn-primary btn-sm" id="btnOpenNewExpense">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      <span>Catat Belanja</span>
                    </button>
                  </div>
                </div>

                <div class="table-container">
                  <table class="data-table" id="transactionsTable">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Outlet / Keterangan</th>
                        <th>Produk / Kategori</th>
                        <th>Detail (Titip / Retur / Qty)</th>
                        <th>Tagihan / Nominal</th>
                        <th>Status</th>
                        <th class="text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody id="transactionsTbody">
                      <!-- Rendered dynamically -->
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </main>
        </div>
      `
    }} />
  );
}
