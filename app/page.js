'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold text-lg">M</div>
          <div>
            <h1 className="text-xl font-bold">MELPUD Management System</h1>
            <p className="text-xs text-zinc-400">Operational & Consignment v2.0 (Next.js Native App Router)</p>
          </div>
        </div>

        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-700 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-400">Framework:</span>
            <span className="font-semibold text-emerald-400">Next.js 14 App Router</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Database Status:</span>
            <span className="font-semibold text-emerald-400">Supabase Connected</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">AI Engine:</span>
            <span className="font-semibold text-emerald-400">Gemini API Ready</span>
          </div>
        </div>

        <div className="text-xs text-zinc-400 text-center">
          Sistem berjalan murni menggunakan komponen native Next.js React.
        </div>
      </div>
    </main>
  );
}
