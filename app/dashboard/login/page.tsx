"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, Loader2, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function DashboardLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  
  const [email, setEmail] = useState('admin@zicabella.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const from = searchParams.get('from') || '/dashboard';

  // Redirect if already logged in
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      router.push(from);
    }
  }, [status, session, router, from]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setError('');

    try {
      // Use NextAuth signIn with the admin-login provider
      const result = await signIn('admin-login', {
        email: email.trim(),
        password: password.trim(),
        redirect: false,
        callbackUrl: from,
      });

      if (result?.error) {
        setError(result.error || 'Invalid credentials. Please try again.');
        toast.error(result.error || 'Login failed');
        setLoading(false);
      } else {
        toast.success('Authentication successful. Redirecting...');
        setLoading(true); // Keep loading state
        // Use window.location for a hard redirect to ensure cookies are sent to middleware
        setTimeout(() => {
          window.location.href = from;
        }, 1000);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-foreground dark:bg-[#0A0A0A]">
        <Loader2 className="w-8 h-8 animate-spin text-background dark:text-foreground/20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-sans bg-foreground dark:bg-[#0A0A0A] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.03),transparent_70%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.02),transparent_70%)] pointer-events-none" />
      
      <div className="relative w-full max-w-[380px] mx-4 rounded-[2.5rem] p-12 flex flex-col gap-10 bg-foreground dark:bg-[#0A0A0A] border border-background/5 dark:border-foreground/10 shadow-2xl shadow-black/20 dark:shadow-foreground/5 overflow-hidden">
         {/* Logo and Title */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16 bg-background/[0.03] dark:bg-foreground/5 rounded-[1.5rem] flex items-center justify-center border border-background/5 dark:border-foreground/10 shadow-inner group">
            <Image 
              src="/zb-logo-220px.png" 
              alt="Logo" 
              width={40} 
              height={40} 
              className="object-contain opacity-80 group-hover:scale-110 transition-transform duration-500 dark:brightness-200" 
            />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-[20px] font-black text-slate-900 dark:text-foreground tracking-tighter lowercase leading-none">infrastructure</h1>
            <p className="text-[9px] uppercase tracking-[0.5em] text-slate-400 dark:text-foreground/20 font-black">Authorization Portal</p>
          </div>
        </div>

        {/* Form */}
         <form onSubmit={handleLogin} className="flex flex-col gap-8">
          <div className="space-y-5">
            {/* Email */}
            <div className="space-y-2.5">
              <label className="text-[9px] uppercase tracking-[0.4em] text-slate-400 dark:text-foreground/30 font-bold ml-1">Admin Identity</label>
              <div className="relative">
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@zicabella.com"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-foreground/[0.02] border border-background/5 dark:border-foreground/10 text-slate-900 dark:text-foreground text-[12px] font-bold tracking-wide placeholder:text-slate-300 dark:placeholder:text-foreground/10 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-foreground/10 transition-all"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2.5">
              <label className="text-[9px] uppercase tracking-[0.4em] text-slate-400 dark:text-foreground/30 font-bold ml-1">Access Key</label>
              <div className="relative">
                <input
                  required
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-foreground/[0.02] border border-background/5 dark:border-foreground/10 text-slate-900 dark:text-foreground text-[12px] font-bold tracking-[0.2em] placeholder:text-slate-300 dark:placeholder:text-foreground/10 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-foreground/10 transition-all placeholder:tracking-normal"
                  autoComplete="current-password"
                />
                 <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 p-1 text-slate-400 dark:text-foreground/30 hover:text-slate-900 dark:hover:text-foreground transition-colors"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl"
              >
                <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest text-center">{error}</p>
              </motion.div>
            )}

            {loading && !error && (
              <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-widest text-center animate-pulse">
                Establishing Secure Session...
              </p>
            )}
          </div>

           <button
            type="submit"
            disabled={loading || !password || !email}
            className="w-full py-5 rounded-2xl bg-slate-900 dark:bg-foreground text-foreground dark:text-background text-[11px] font-black uppercase tracking-[0.4em] transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] shadow-2xl shadow-black/20 dark:shadow-foreground/10 flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Authenticate
              </>
            )}
          </button>
        </form>

         <div className="flex flex-col items-center gap-5">
            <div className="h-[1px] w-16 bg-background/5 dark:bg-foreground/10" />
            <div className="flex items-center gap-2 text-[9px] text-slate-300 dark:text-foreground/20 uppercase tracking-[0.6em] font-bold">
              <Lock className="w-3 h-3" />
              Secure Tunnel Active
            </div>
         </div>
      </div>
    </div>
  );
}
