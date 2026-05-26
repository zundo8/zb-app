'use client';

import { useEffect, useState } from 'react';

type Status = {
  connected: boolean;
  phone?: string;
  name?: string;
  quality?: string;
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
        setStatus({ connected: false, error: 'Network error' });
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-foreground/10 p-4 text-sm text-muted-foreground animate-pulse">
        Checking WhatsApp connection...
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-3 transition-colors ${
        status?.connected
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-red-500/30 bg-red-500/5'
      }`}
    >
      <div
        className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
          status?.connected ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
      <div className="min-w-0">
        <p className="font-medium text-sm">
          WhatsApp Business — {status?.connected ? 'Connected' : 'Disconnected'}
        </p>
        {status?.connected ? (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {status.name} · {status.phone} · Quality: {status.quality}
          </p>
        ) : (
          <p className="text-xs text-red-400 mt-0.5">{status?.error || 'Not connected'}</p>
        )}
      </div>
    </div>
  );
}
