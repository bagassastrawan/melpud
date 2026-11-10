# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Modern Web Application (HTML5, Vanilla JS ES Modules, CSS Custom Properties with Tailwind-grade styling, Chart.js for PRD visual analytics)

## Users
Primary user: Owner Melpud (Pengusaha pudding konsinyasi).
Situation: Operasional lapangan harian saat drop batch ke outlet mitra, rekonsiliasi sisa retur, penagihan piutang, dan pencatatan belanja bahan.

## Product Purpose
Menghilangkan friksi pencatatan operasional lapangan bagi owner Melpud, menyediakan visibilitas arus kas riil secara real-time, dan mengeliminasi risiko piutang yang lupa ditagih di outlet mitra konsinyasi.

## Positioning
Sistem manajemen konsinyasi terpadu berbasis Cash Basis (kas riil bertambah hanya saat PAID, belanja bahan memotong kas penjualan secara auto-deduction, piutang berjalan terlacak jelas per outlet), analitik finansial 3 diagram, dan AI Smart Quick-Log bahasa alami.

## Operating Context
- Lapangan: Kunjungan 5 outlet mitra konsinyasi (P. BUNGIN, P. MOYO CONATO, P. SINGKEP, BUBUH BALI, SKENSA MAMI).
- Transaksi konsinyasi 4 tahap: Drop Batch (ACTIVE) -> Rekonsiliasi & Retur (Hitung Terjual & Tagihan) -> Status Pembayaran (UNPAID/PAID) -> Akumulasi Piutang Berjalan.
- Buku kas belanja bahan: Auto-deduction memotong saldo kas penjualan yang terkumpul.

## Capabilities and Constraints
- Master Outlet: 5 titik awal + tambah outlet baru.
- Master Produk: Varian dasar awal Pudding Coklat @ Rp 5.000 / cup + tambah varian baru dinamis.
- Transaksi Konsinyasi: Drop batch, pencatatan retur, perhitungan Qty Terjual & Total Tagihan otomatis, toggle UNPAID / PAID, akumulasi piutang global & per-outlet.
- Mesin Finansial: Total Piutang Berjalan, Kas Masuk Riil, Total Pengeluaran, Saldo Kas Bersih Riil, Proyeksi Laba Total (Accrual).
- 3 Diagram Visual Interaktif: (1) Bar Chart Kinerja Finansial (Kas Masuk, Pengeluaran, Laba Bersih) dengan filter harian/mingguan/bulanan; (2) Trend Line Saldo Kas harian dengan indikator peringatan ambang batas minimum; (3) Donut Chart Komposisi Pengeluaran (Bahan Baku Utama, Kemasan, Operasional).
- AI Smart Quick-Log: Sticky topbar NLP input untuk aksi CREATE_DROP, RECONCILE_BATCH, SETTLE_PAYMENT, RECORD_EXPENSE dengan dialog konfirmasi 1-klik (Human-in-the-loop).
- STRICT USER CONSTRAINT: Batasan ketat - jangan menambahkan fitur di luar PRD.
- PALETTE CONSTRAINT: Warna coklat (#3D2314, #5C3A21, #8B5A2B, #C49A6C), hitam (#12100E, #1A1614, #26211D), putih (#FFFFFF, #FDFBF7, #F5EFEB).
- MOTION & LAYOUT: Animasi smooth (transitions, state-driven feedback, micro-interactions) dan layout modern dashboard admin.

## Brand Commitments
- Nama: Melpud (Melpud Operational & Consignment Management System).
- Palet Warna: Coklat pudding, hitam premium, putih bersih & krim.
- Tone: Modern, utilitarian, presisi operasional, bersih.

## Evidence on Hand
- PRD_Melpud_Management_System_v2.docx
