"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, Send, CheckCircle2, MessageCircle, DollarSign,
  Percent, BarChart3, RefreshCcw, Sparkles, Megaphone, Calendar
} from "lucide-react";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell 
} from "recharts";
import { toast } from "sonner";

export default function CampaignAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const res = await fetch("/api/whatsapp-events/stats");
        const statsData = await res.json();
        if (res.ok) {
          setData(statsData);
        } else {
          toast.error("Failed to load analytics details.");
        }
      } catch (err) {
        toast.error("Network error loading analytics.");
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Pre-arrange template data for charts
  const chartData = data?.templates?.map((t: any) => ({
    name: t.templateName.replace("zb_", "").replace("zica_", "").replace("_v1", ""),
    revenue: t.revenue,
    conversions: t.conversions
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaign Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Detailed performance tracking, conversions attribution, and templates optimization.</p>
        </div>

        <button 
          onClick={() => setRefreshTrigger(p => p + 1)}
          className="p-2.5 bg-foreground/5 hover:bg-foreground/10 text-foreground border border-foreground/10 rounded-xl transition-all"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Template Revenue Attribution Chart */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-base">Revenue Attribution by Template</h3>
            </div>
            <span className="text-[10px] text-muted-foreground uppercase font-mono">Sales Share</span>
          </div>

          <div className="h-72 w-full pt-4">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No revenue logs recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="currentColor" className="text-[10px] opacity-40" tickLine={false} />
                  <YAxis stroke="currentColor" className="text-[10px] opacity-40" tickLine={false} />
                  <Tooltip contentStyle={{ background: "rgba(0, 0, 0, 0.8)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry: any, index: number) => {
                      const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Campaign conversions Rate Summary */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h3 className="font-semibold text-base">Conversion Summary</h3>
              </div>
              <Percent className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Total Broadcasts</span>
                  <h4 className="text-xl font-bold">{data?.metrics?.totalSent ?? 0}</h4>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Conversion Efficiency</span>
                  <h4 className="text-xl font-bold">{((data?.metrics?.conversionRate ?? 0) * 100).toFixed(2)}%</h4>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-3 bg-teal-500/10 text-teal-500 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Aesthetic Sales Yield</span>
                  <h4 className="text-xl font-bold">₹{(data?.metrics?.totalRevenue ?? 0).toLocaleString('en-IN')}</h4>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-foreground/5 text-xs text-muted-foreground">
            Attributed using direct session checks and Click-to-WhatsApp link referral logging.
          </div>
        </div>

      </div>

      {/* Campaigns list table */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2">
          <Megaphone className="w-4 h-4 text-emerald-500" />
          <h3 className="font-semibold text-base">Recent Campaigns Performance</h3>
        </div>

        <div className="overflow-x-auto">
          {(!data?.recentCampaigns || data.recentCampaigns.length === 0) ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No recent campaigns found. Build a campaign inside the WhatsApp Hub to track metrics.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-foreground/5 bg-foreground/[0.01] text-xs font-bold text-muted-foreground uppercase">
                  <th className="px-5 py-3">Campaign Name</th>
                  <th className="px-5 py-3">Template</th>
                  <th className="px-5 py-3">Target</th>
                  <th className="px-5 py-3">Sent</th>
                  <th className="px-5 py-3">Delivered</th>
                  <th className="px-5 py-3">Read</th>
                  <th className="px-5 py-3">Clicks</th>
                  <th className="px-5 py-3">Conversions</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5 text-sm">
                {data.recentCampaigns.map((camp: any) => {
                  const sent = camp.total_sent || camp.statsSent || 0;
                  const del = camp.delivered || camp.statsDelivered || 0;
                  const read = camp.read_count || camp.statsRead || 0;
                  const clicks = camp.click_count || 0;
                  const convs = camp.conversions || 0;
                  const rev = camp.revenue_generated || 0;

                  return (
                    <tr key={camp.id} className="hover:bg-foreground/[0.01]">
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground/90">{camp.campaign_name || camp.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{camp.status.toUpperCase()}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs">{camp.template_name || camp.templateName}</td>
                      <td className="px-5 py-3 text-xs capitalize">{camp.target_audience || camp.targetSegment}</td>
                      <td className="px-5 py-3 font-bold">{sent}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{sent > 0 ? `${((del / sent) * 100).toFixed(0)}%` : "0%"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5 text-violet-500" />
                          <span>{sent > 0 ? `${((read / sent) * 100).toFixed(0)}%` : "0%"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-semibold text-amber-500">{clicks}</td>
                      <td className="px-5 py-3 font-semibold text-rose-500">{convs}</td>
                      <td className="px-5 py-3 text-right font-bold text-teal-500">₹{rev.toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
