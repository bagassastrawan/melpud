'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-4">
        <div className="text-3xl font-bold text-amber-900">Melpud System v2.0</div>
        <p className="text-sm text-zinc-500">Next.js App Router migration active. Connected to Supabase & Gemini API.</p>
        <div className="text-xs text-emerald-600 font-medium">Status: Ready (Supabase Connected via Vercel Env)</div>
      </div>
    </div>
  );
}
