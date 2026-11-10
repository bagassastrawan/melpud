/**
 * Konfigurasi Koneksi Supabase untuk Web Melpud
 *
 * Langkah menghubungkan ke website Supabase Anda:
 * 1. Jalankan isi file `supabase/schema.sql` di Supabase Dashboard -> SQL Editor.
 * 2. Buka Supabase Dashboard -> Project Settings -> API (atau Connect).
 * 3. Isi `url` dengan Project URL dan `publishableKey` dengan Publishable / anon public key.
 *    PERINGATAN KEAMANAN: JANGAN PERNAH memasukkan `service_role` atau `sb_secret_...` di sini.
 */
export const SUPABASE_CONFIG = {
  url: '',
  publishableKey: ''
};
