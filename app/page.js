import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Redirect or mount full Melpud dashboard UI
    window.location.href = '/index.html';
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-900 text-white font-sans">
      <div className="text-center space-y-2">
        <div className="text-xl font-bold animate-pulse">Memuat Sistem Melpud v2.0...</div>
        <p className="text-xs text-zinc-400">Menghubungkan ke Supabase & AI Engine</p>
      </div>
    </div>
  );
}
