"use client";

import { motion } from "framer-motion";
import { CreditCard, Wallet, ArrowRightLeft, History, PlusCircle, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function PaymentsPage() {
  const modules = [
    {
      title: "Razorpay Transactions",
      description: "Live Razorpay captured payments API cross-referenced against local database records.",
      icon: CreditCard,
      href: "/dashboard/transactions",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      stats: "Ground Truth"
    },
    {
      title: "Store Credits",
      description: "Manage customer wallet balances, manual adjustments, and credit history.",
      icon: Wallet,
      href: "/dashboard/payments/store-credits",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      stats: "Manage Wallets"
    },
    {
      title: "Refunds",
      description: "View and track all refunds issued through returns or manual processes.",
      icon: ArrowRightLeft,
      href: "/dashboard/refunds",
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      stats: "Track Refunds"
    },
    {
      title: "Transaction History",
      description: "Complete logs of all payment-related activities and adjustments.",
      icon: History,
      href: "/dashboard/payments/history",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      stats: "Audit Logs"
    }
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-8 pb-20 relative z-10">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Payment Module</h1>
        <p className="text-[11px] text-foreground/50 tracking-wide">Manage financial interactions, customer credits, and refund workflows.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m, i) => (
          <Link key={m.title} href={m.href}>
            <motion.div 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="glass-card p-6 rounded-2xl group cursor-pointer border border-foreground/[0.05] hover:border-foreground/10 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center`}>
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                </div>
                <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest">{m.stats}</span>
              </div>
              <h2 className="text-sm font-semibold text-foreground mb-2 group-hover:text-foreground/80 transition-colors">{m.title}</h2>
              <p className="text-[10px] text-foreground/50 leading-relaxed tracking-wide">{m.description}</p>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Quick Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12">
        <div className="glass-card p-6 rounded-2xl border border-foreground/[0.05]">
          <h3 className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.2em] mb-6">Financial Overview</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] text-foreground/60">Total Store Credits Outstanding</p>
                <p className="text-2xl font-bold tracking-tighter">₹4,20,500</p>
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="h-[1px] bg-foreground/[0.05] w-full" />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] text-foreground/60">Refunds Processed (30d)</p>
                <p className="text-2xl font-bold tracking-tighter">₹85,200</p>
              </div>
              <div className="px-2 py-1 bg-rose-500/10 text-rose-500 rounded text-[8px] font-bold uppercase tracking-widest">
                -12% vs last month
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
