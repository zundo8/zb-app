"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, CreditCard, ExternalLink, KeyRound, Webhook } from "lucide-react";

type PaymentStatus = { razorpayReady: boolean; source: "database" | "environment" | "none" };

export default function RazorpayPaymentsPage() {
  const [status, setStatus] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    fetch("/api/admin/payment-status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ razorpayReady: false, source: "none" }));
  }, []);

  const ready = status?.razorpayReady === true;
  const sourceLabel =
    status?.source === "database"
      ? "Infrastructure (dashboard)"
      : status?.source === "environment"
        ? "Server environment variables"
        : "Not configured";

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      <div>
        <h1 className="text-3xl font-bold text-foreground uppercase tracking-tight">Razorpay</h1>
        <p className="text-[11px] text-foreground/50 font-medium uppercase tracking-[0.25em] mt-2">
          Payments for the mobile app and checkout API
        </p>
      </div>

      <div
        className={`rounded-2xl border p-6 flex gap-4 ${
          ready ? "bg-emerald-500/10 border-emerald-500/25" : "bg-amber-500/10 border-amber-500/25"
        }`}
      >
        {ready ? (
          <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" strokeWidth={1.5} />
        ) : (
          <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" strokeWidth={1.5} />
        )}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            {ready ? "Razorpay is ready" : "Action required"}
          </h2>
          <p className="text-xs text-foreground/70 mt-2 leading-relaxed">
            {ready
              ? `Live payments can be created and verified. Keys are loaded from: ${sourceLabel}.`
              : "Add your Razorpay Key ID and Key Secret under Settings → Payment Gateways, then save. Alternatively set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your deployment environment (both must match the same Razorpay account)."}
          </p>
          {!ready && (
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-2 mt-4 text-[11px] font-bold uppercase tracking-widest text-foreground underline-offset-4 hover:underline"
            >
              <KeyRound className="w-4 h-4" />
              Open Infrastructure / Settings
            </Link>
          )}
        </div>
      </div>

      <div className="glass-card rounded-[2rem] border border-foreground/5 overflow-hidden">
        <div className="px-8 py-6 border-b border-foreground/5 flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-foreground/50" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-foreground/60">Mobile app</h3>
        </div>
        <div className="px-8 py-6 space-y-3 text-xs text-foreground/70 leading-relaxed">
          <p>
            The React Native app must use the <strong className="text-foreground">same</strong> Key ID as the server.
            The checkout flow reads the public key from the create-order response; set{" "}
            <code className="bg-foreground/10 px-1.5 py-0.5 rounded text-[10px]">EXPO_PUBLIC_RAZORPAY_KEY_ID</code> in{" "}
            <code className="bg-foreground/10 px-1.5 py-0.5 rounded text-[10px]">ZicaBella/.env</code> to that Key ID
            for consistency.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-[2rem] border border-foreground/5 overflow-hidden">
        <div className="px-8 py-6 border-b border-foreground/5 flex items-center gap-3">
          <Webhook className="w-5 h-5 text-foreground/50" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-foreground/60">Webhooks</h3>
        </div>
        <div className="px-8 py-6 space-y-4 text-xs text-foreground/70">
          <p className="leading-relaxed">
            In Razorpay Dashboard, add a webhook pointing to your production URL and set{" "}
            <code className="bg-foreground/10 px-1.5 py-0.5 rounded text-[10px]">RAZORPAY_WEBHOOK_SECRET</code> to the
            secret Razorpay shows.
          </p>
          <div className="rounded-xl bg-foreground/5 p-4 font-mono text-[10px] break-all">
            https://app.zicabella.com/api/payments/webhook
          </div>
          <Link
            href="/dashboard/webhooks"
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-foreground underline-offset-4 hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Webhooks overview
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/orders"
          className="px-5 py-3 rounded-xl bg-foreground text-background text-[10px] font-bold uppercase tracking-widest"
        >
          Orders
        </Link>
        <Link
          href="/dashboard/mobile-orders"
          className="px-5 py-3 rounded-xl border border-foreground/15 text-[10px] font-bold uppercase tracking-widest"
        >
          Mobile orders
        </Link>
      </div>
    </div>
  );
}
