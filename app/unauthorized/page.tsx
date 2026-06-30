"use client";

import React from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-background dark:bg-[#0A0A0A] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic background grid & gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 bg-center opacity-[0.03] dark:opacity-[0.05]"
          style={{ backgroundImage: "url('/grid.svg')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.06),transparent_50%)] animate-pulse" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card max-w-md w-full p-8 lg:p-10 rounded-[2.5rem] border border-foreground/[0.08] shadow-3xl text-center space-y-8 relative z-10"
      >
        {/* Animated Warning Icon */}
        <div className="relative w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20 shadow-inner">
          <ShieldAlert className="w-10 h-10 text-red-500" strokeWidth={1.5} />
          <div className="absolute inset-0 bg-red-500/10 rounded-full animate-ping opacity-20" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">Access Restricted</h1>
          <p className="text-foreground/50 text-[10px] font-bold leading-relaxed uppercase tracking-widest">
            You do not have the required permissions to view this resource. 
            If you believe this is an error, please reach out to your System Administrator.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link 
            href="/dashboard"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-foreground text-background dark:bg-white dark:text-black rounded-xl text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-foreground/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            Workspace
          </Link>
          
          <button 
            onClick={() => signOut({ callbackUrl: '/dashboard/login' })}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-background dark:bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl text-[10px] font-bold uppercase tracking-wider text-foreground/60 hover:bg-foreground/[0.02] hover:text-foreground transition-all active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={2} />
            Log Out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
