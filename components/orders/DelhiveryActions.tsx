import React, { useState } from 'react';
import { Loader2, Copy, Check, ExternalLink, Printer, Trash2, Zap, Truck } from 'lucide-react';

interface Order {
  id: string;
  shopifyOrderId: string;
  status: string;
  totalPrice: number;
  paymentMethod: string | null;
  delhivery_awb: string | null;
  tracking_status: string | null;
}

interface DelhiveryActionsProps {
  order: Order;
  onRefresh: () => void;
}

export default function DelhiveryActions({ order, onRefresh }: DelhiveryActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateShipment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/delhivery/create-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create shipment');
      }
      onRefresh();
    } catch (err: any) {
      console.error('[DelhiveryActions] Create Shipment Error:', err);
      setError(err.message || 'Fulfillment request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelShipment = async () => {
    if (!window.confirm('Are you sure you want to cancel this Delhivery shipment?')) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/delhivery/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ awb: order.delhivery_awb })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel shipment');
      }
      onRefresh();
    } catch (err: any) {
      console.error('[DelhiveryActions] Cancel Shipment Error:', err);
      setError(err.message || 'Cancellation request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!order.delhivery_awb) return;
    try {
      await navigator.clipboard.writeText(order.delhivery_awb);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-rose-500 text-[11px] uppercase tracking-widest font-bold">
          {error}
        </p>
      )}

      {!order.delhivery_awb ? (
        <div className="flex flex-col items-center justify-center py-6 space-y-6 border border-dashed border-foreground/10 rounded-[32px]">
          <Truck className="w-10 h-10 text-foreground/5" />
          <div className="text-center space-y-2">
            <p className="text-[11px] font-bold text-foreground/20 uppercase tracking-[0.2em]">Node Awaiting Shipment</p>
            <p className="text-[13px] text-foreground/40 max-w-xs mx-auto">No active shipment record exists for this transaction profile.</p>
          </div>
          <button
            onClick={handleCreateShipment}
            disabled={loading || order.status === 'cancelled' || order.status === 'payment_failed'}
            className="flex items-center gap-3 px-10 py-4 bg-foreground text-background rounded-2xl text-[11px] font-bold uppercase tracking-[0.3em] hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-background" />}
            Create Shipment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 rounded-[24px] bg-foreground/[0.03] border border-foreground/5 space-y-6">
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-foreground/20 uppercase tracking-widest">Tracking Status</p>
              <StatusBadge status={order.tracking_status || 'manifested'} />
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-bold text-foreground/20 uppercase tracking-widest">AWB Number</p>
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-foreground/5 border border-foreground/10">
                <span className="font-mono text-xs font-bold text-foreground select-all">{order.delhivery_awb}</span>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-foreground/10 transition-colors text-foreground/40 hover:text-foreground"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 justify-center">
            <a
              href={`/api/delhivery/label?awb=${order.delhivery_awb}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 py-4 bg-foreground/5 hover:bg-foreground hover:text-background border border-foreground/10 rounded-[20px] text-[11px] font-bold uppercase tracking-widest transition-all group"
            >
              <Printer className="w-4 h-4 text-foreground/40 group-hover:text-background transition-colors" />
              Print Label
            </a>

            <a
              href={`https://www.delhivery.com/track/package/${order.delhivery_awb}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 py-4 bg-foreground/5 hover:bg-foreground hover:text-background border border-foreground/10 rounded-[20px] text-[11px] font-bold uppercase tracking-widest transition-all group"
            >
              <ExternalLink className="w-4 h-4 text-foreground/40 group-hover:text-background transition-colors" />
              Track Shipment
            </a>

            <button
              onClick={handleCancelShipment}
              disabled={loading}
              className="flex items-center justify-center gap-2.5 py-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-[20px] text-[11px] font-bold uppercase tracking-widest text-rose-500 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Cancel Shipment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const norm = status.toLowerCase();
  let color = "text-foreground/40";
  let bg = "bg-foreground/5";
  let dot = "bg-foreground/20";
  let label = status.replace('_', ' ');

  if (norm.includes('deliver') || norm.includes('paid') || norm.includes('success')) {
    color = "text-emerald-500";
    bg = "bg-emerald-500/10";
    dot = "bg-emerald-500";
  } else if (norm.includes('transit') || norm.includes('ship') || norm.includes('manifest')) {
    color = "text-blue-500";
    bg = "bg-blue-500/10";
    dot = "bg-blue-500";
  } else if (norm.includes('pending') || norm.includes('awaiting')) {
    color = "text-amber-500";
    bg = "bg-amber-500/10";
    dot = "bg-amber-500";
  } else if (norm.includes('cancel') || norm.includes('failed') || norm.includes('rto')) {
    color = "text-rose-500";
    bg = "bg-rose-500/10";
    dot = "bg-rose-500";
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-foreground/5 ${bg}`}>
      <div className={`w-1 h-1 rounded-full ${dot}`} />
      <span className={`text-[9px] font-bold uppercase tracking-widest ${color}`}>
        {label}
      </span>
    </div>
  );
}
