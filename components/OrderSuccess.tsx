"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Package, ArrowRight, Sparkles } from "lucide-react";
import { lockScroll, unlockScroll } from "@/lib/utils/scroll-lock";

interface Props {
  onContinue: () => void;
}

export default function OrderSuccess({ onContinue }: Props) {
  // Prevent body scroll while shown
  useEffect(() => {
    lockScroll();
    return () => unlockScroll();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* Ambient glow orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[10%] w-[60vw] h-[60vw] rounded-full glow-orb-3 opacity-30" />
        <div className="absolute bottom-[-5%] right-[-10%] w-[50vw] h-[50vw] rounded-full glow-orb-1 opacity-20" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-sm">

        {/* Checkmark animation */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.1 }}
          className="mb-8"
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center relative"
            style={{
              background: "linear-gradient(135deg, hsla(var(--glass-bg), 0.8) 0%, hsla(var(--glass-bg), 0.4) 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid hsla(var(--glass-border), 0.15)",
              boxShadow: "0 8px 40px -8px hsla(var(--glass-shadow), 0.3), 0 0 0 1px hsla(var(--glass-border), 0.08) inset",
            }}
          >
            <CheckCircle2 className="w-12 h-12 text-green-400" strokeWidth={1.5} />
            {/* Sparkle dots */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="absolute -top-2 -right-2"
            >
              <Sparkles className="w-5 h-5 text-yellow-400/70" />
            </motion.div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mb-3"
        >
          <p className="text-[8px] font-bold uppercase tracking-[0.55em] text-foreground/30 mb-2">Order Confirmed</p>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] leading-none text-foreground mb-2">
            You&rsquo;re all set!
          </h1>
          <p className="text-[10px] font-light text-foreground/40 leading-relaxed tracking-wide">
            Your order has been placed and will be processed shortly.
          </p>
        </motion.div>

        {/* Info card */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.38 }}
          className="w-full mb-8 mt-6 rounded-2xl p-4"
          style={{
            background: "hsla(var(--glass-bg), 0.55)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid hsla(var(--glass-border), 0.1)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "hsla(var(--glass-bg), 0.6)", border: "1px solid hsla(var(--glass-border), 0.1)" }}
            >
              <Package className="w-5 h-5 text-foreground/50" />
            </div>
            <div className="text-left">
              <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-foreground/50 mb-0.5">What&rsquo;s next?</p>
              <p className="text-[9px] text-foreground/40 leading-relaxed">
                Check your email for the order confirmation and tracking info.
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.48 }}
          onClick={onContinue}
          className="w-full py-4 rounded-2xl bg-foreground text-background text-[9px] font-bold uppercase tracking-[0.4em] hover:opacity-90 active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-2"
        >
          Continue Shopping
          <ArrowRight className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </motion.div>
  );
}
