import React from 'react';
import prisma from '@/lib/db';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function WebhooksPage() {
  const events = await prisma.webhookEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 uppercase italic">Webhook Registry</h1>
          <p className="text-foreground/40 text-sm">Monitor real-time incoming signals from Razorpay and Logistics.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-foreground/20 uppercase tracking-widest mb-1">Active Endpoint</p>
          <code className="bg-foreground/5 px-3 py-1.5 rounded border border-foreground/10 text-emerald-400 text-xs">
            https://app.zicabella.com/api/webhooks/razorpay
          </code>
        </div>
      </div>

      <div className="grid gap-4">
        {events.length === 0 ? (
          <div className="bg-foreground/5 border border-foreground/10 rounded-2xl p-12 text-center">
            <p className="text-foreground/20 italic">No webhook signals detected yet.</p>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="bg-foreground/5 border border-foreground/10 rounded-2xl overflow-hidden">
              <div className="p-4 flex items-center justify-between border-b border-foreground/10">
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${
                    event.source === 'razorpay' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {event.source}
                  </span>
                  <span className="text-foreground font-mono text-sm tracking-tight">{event.eventType}</span>
                </div>
                <span className="text-foreground/20 text-xs font-mono">
                  {format(new Date(event.createdAt), 'MMM dd, HH:mm:ss')}
                </span>
              </div>
              <div className="p-4 bg-background/40">
                <pre className="text-[11px] text-foreground/40 overflow-x-auto font-mono max-h-32">
                  {JSON.stringify(JSON.parse(event.payload), null, 2)}
                </pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
