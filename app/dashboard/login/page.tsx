"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock } from 'lucide-react';
import Image from 'next/image';

export default function DashboardLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const from = searchParams.get('from') || '/dashboard';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError('');

    // Safety timeout: if redirect takes too long, let the user try again
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Login successful, but redirect is taking too long. Please refresh.');
      }
    }, 5000);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        clearTimeout(timeout);
        // Smoother SPA redirect
        router.push(from);
        router.refresh(); // Ensure the layout/middleware picks up the new cookie
      } else {
        clearTimeout(timeout);
        setError(data.error || 'Invalid credentials. Please try again.');
        setLoading(false);
      }
    } catch {
      clearTimeout(timeout);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans bg-foreground dark:bg-[#0A0A0A] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.03),transparent_70%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.02),transparent_70%)] pointer-events-none" />
      <div className="relative w-full max-w-[340px] mx-4 rounded-[2rem] p-10 flex flex-col gap-8 bg-foreground dark:bg-[#0A0A0A] border border-background/5 dark:border-foreground/10 shadow-2xl shadow-black/5 dark:shadow-foreground/5 relative overflow-hidden">
         {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-12 h-12 bg-background/[0.03] dark:bg-foreground/5 rounded-2xl flex items-center justify-center border border-background/5 dark:border-foreground/10 shadow-inner">
            <Image src="/zica-bella-logo_8.png" alt="Logo" fill className="object-contain p-2 opacity-80 dark:invert" />
          </div>
          <div className="text-center mt-2">
            <h1 className="text-[16px] font-black text-slate-900 dark:text-foreground tracking-tighter lowercase leading-none">infrastructure</h1>
            <p className="text-[8px] uppercase tracking-[0.5em] text-slate-400 dark:text-foreground/20 font-black mt-2">Authorization Portal</p>
          </div>
        </div>

        {/* Form */}
         <form onSubmit={handleLogin} className="flex flex-col gap-6">
          <div className="space-y-4">
            {/* Username */}
            <div className="space-y-2">
              <label className="text-[8px] uppercase tracking-[0.4em] text-slate-400 dark:text-foreground/30 font-bold ml-1">Identity</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-foreground/[0.02] border border-background/5 dark:border-foreground/10 text-slate-900 dark:text-foreground text-[11px] font-bold tracking-wide placeholder:text-slate-300 dark:placeholder:text-foreground/10 focus:outline-none focus:border-slate-200 dark:focus:border-foreground/20 transition-all"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[8px] uppercase tracking-[0.4em] text-slate-400 dark:text-foreground/30 font-bold ml-1">Access Key</label>
              <div className="relative flex items-center">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-foreground/[0.02] border border-background/5 dark:border-foreground/10 text-slate-900 dark:text-foreground text-[11px] font-bold tracking-[0.2em] placeholder:text-slate-300 dark:placeholder:text-foreground/10 focus:outline-none focus:border-slate-200 dark:focus:border-foreground/20 transition-all placeholder:tracking-normal"
                  autoComplete="current-password"
                />
                 <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  className="absolute right-4 p-1 text-slate-400 dark:text-foreground/30 hover:text-slate-900 dark:hover:text-foreground transition-colors"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest text-center mt-2">{error}</p>
            )}
          </div>

           <button
            type="submit"
            disabled={loading || !password || !username}
            className="w-full py-4 rounded-xl bg-slate-900 dark:bg-foreground text-foreground dark:text-background text-[10px] font-black uppercase tracking-[0.3em] transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] mt-4 shadow-xl shadow-black/10 dark:shadow-foreground/5"
          >
            {loading ? 'Validating...' : 'Authenticate'}
          </button>
        </form>

         <div className="flex flex-col items-center gap-4">
            <div className="h-[1px] w-12 bg-background/5 dark:bg-foreground/10" />
            <p className="text-[8px] text-slate-300 dark:text-foreground/20 uppercase tracking-[0.6em] font-bold">Secure Tunnel Active</p>
         </div>
      </div>
    </div>
  );
}
