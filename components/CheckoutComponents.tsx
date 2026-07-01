"use client";

import React from "react";
import { useTheme } from "next-themes";
import { useCart } from "@/lib/cart-context";
import Link from "next/link";
import { ChevronLeft, Moon, Sun, ShoppingBag, ArrowRight, Loader2 } from "lucide-react";

/* ─── CheckoutHeader ─── */
interface CheckoutHeaderProps {
  step: 1 | 2;
  onBack: () => void;
}

export function CheckoutHeader({ step, onBack }: CheckoutHeaderProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { count } = useCart();

  return (
    <header className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto bg-white rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-150/40 px-3 py-1.5 flex items-center justify-between">
      {/* Left side */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-650 hover:bg-slate-100/50 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" strokeWidth={2.5} />
        </button>

        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-black text-slate-800 select-none">
          {step}
        </div>

        <span className="font-mono tracking-widest text-[9.5px] text-slate-450 font-bold uppercase ml-1.5 select-none">
          CHECKOUT
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100/50 active:scale-95 transition-all"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-4 h-4 text-slate-700" strokeWidth={2} />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" strokeWidth={2} />
          )}
        </button>

        <Link
          href="/cart"
          aria-label="View Cart"
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100/50 active:scale-95 transition-all relative"
        >
          <ShoppingBag className="w-4 h-4 text-slate-700" strokeWidth={2} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-black text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center tracking-tighter scale-90">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

/* ─── CheckoutInput ─── */
interface CheckoutInputProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function CheckoutInput({
  id,
  label,
  icon,
  error,
  children,
  className = "",
}: CheckoutInputProps) {
  return (
    <div className={`w-full flex flex-col ${className}`}>
      <div
        className={`bg-white rounded-2xl p-3 shadow-[0_4px_16px_rgba(0,0,0,0.02)] border transition-all flex items-center gap-3 w-full ${
          error
            ? "border-red-300 bg-red-50/5 focus-within:border-red-400"
            : "border-slate-100 focus-within:border-slate-350 focus-within:shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
        }`}
      >
        {/* Left Icon Chip */}
        <div className="w-[42px] h-[42px] rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 select-none">
          {icon}
        </div>

        {/* Input content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <label
            htmlFor={id}
            className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono select-none mb-0.5"
          >
            {label}
          </label>
          <div className="flex items-center min-h-[20px]">{children}</div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <span className="text-[9.5px] text-red-500 font-bold mt-1 ml-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {error}
        </span>
      )}
    </div>
  );
}

/* ─── StickyCTA ─── */
interface StickyCTAProps {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}

export function StickyCTA({
  label,
  disabled = false,
  loading = false,
  onClick,
  type = "button",
}: StickyCTAProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-45 bg-white/80 backdrop-blur-md border-t border-slate-100/80 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.03)]">
      <div className="max-w-md mx-auto w-full">
        <button
          type={type}
          onClick={onClick}
          disabled={disabled || loading}
          className="w-full h-14 bg-black disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-[10.5px] font-bold uppercase tracking-widest rounded-2xl flex items-center justify-between px-6 transition-all active:scale-[0.98] disabled:scale-100 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
        >
          <span className="font-extrabold">{label}</span>
          <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-sm">
            {loading ? (
              <Loader2 className="w-4.5 h-4.5 animate-spin text-black" strokeWidth={2.5} />
            ) : (
              <ArrowRight className="w-4.5 h-4.5 text-black" strokeWidth={3} />
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
