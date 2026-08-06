'use client';

import { useEffect, useState } from 'react';

type Status = {
  connected: boolean;
  phone?: string;
  name?: string;
  quality?: string;
  tier?: string;
  error?: string;
};

export default function WhatsAppStatusCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/whatsapp/status')
      .then(r => r.json())
      .then(data => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => {
        setStatus({ connected: false, error: 'Network error connecting to WhatsApp API service' });
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-foreground/10 p-4 text-sm text-muted-foreground animate-pulse">
        Checking Meta WhatsApp Cloud API connection...
      </div>
    );
  }

  const isQualityGood = !status?.quality || status?.quality === 'GREEN' || status?.quality === 'HIGH';

  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-3 transition-colors ${
        status?.connected
          ? isQualityGood
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-amber-500/30 bg-amber-500/5'
          : 'border-rose-500/30 bg-rose-500/5'
      }`}
    >
      <div
        className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
          status?.connected
            ? isQualityGood
              ? 'bg-emerald-500'
              : 'bg-amber-500'
            : 'bg-rose-500'
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-sm">
            WhatsApp Business — {status?.connected ? 'Connected' : 'Disconnected'}
          </p>
          {status?.quality && (
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              isQualityGood
                ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10'
                : 'border-amber-500/20 text-amber-500 bg-amber-500/10'
            }`}>
              Quality: {status.quality}
            </span>
          )}
        </div>
        {status?.connected ? (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {status.name} · {status.phone} {status.tier ? `· Tier: ${status.tier}` : ''}
          </p>
        ) : (
          <p className="text-xs text-rose-400 mt-0.5 font-medium">{status?.error || 'Not connected'}</p>
        )}
      </div>
    </div>
  );
}
