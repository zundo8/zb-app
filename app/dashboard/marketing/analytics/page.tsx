"use client";

import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Users, MousePointerClick, MessageCircle, Mail, Bell, MessageSquare } from "lucide-react";

export default function AnalyticsHubPage() {
  const channels = [
    { name: "WhatsApp", icon: MessageCircle, color: "text-emerald-500", bg: "bg-emerald-500/10", metrics: { sent: "12.4K", open: "86%", click: "14%" } },
    { name: "Email", icon: Mail, color: "text-blue-500", bg: "bg-blue-500/10", metrics: { sent: "45.2K", open: "24%", click: "3.2%" } },
    { name: "Push Notifications", icon: Bell, color: "text-foreground", bg: "bg-foreground/10", metrics: { sent: "124K", open: "12%", click: "4.8%" } },
    { name: "SMS", icon: MessageSquare, color: "text-purple-500", bg: "bg-purple-500/10", metrics: { sent: "8.1K", open: "98%", click: "6.1%" } },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Omnichannel Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Cross-channel marketing performance and engagement</p>
        </div>
        <select className="bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2 text-sm outline-none">
          <option>Last 30 Days</option>
          <option>Last 7 Days</option>
          <option>This Month</option>
          <option>Year to Date</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Reach", value: "189.7K", change: "+12.5%", icon: Users },
          { label: "Total Engagement", value: "32.4K", change: "+8.2%", icon: MousePointerClick },
          { label: "Avg Conversion", value: "4.8%", change: "+1.1%", icon: TrendingUp },
          { label: "Marketing ROI", value: "342%", change: "+24%", icon: BarChart3 },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase">{stat.label}</span>
              <stat.icon className="w-4 h-4 text-foreground/40" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
              <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                {stat.change}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <h2 className="text-lg font-semibold tracking-tight mt-8 mb-4">Channel Performance</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((channel, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className={`p-3 rounded-xl ${channel.bg}`}>
                <channel.icon className={`w-6 h-6 ${channel.color}`} />
              </div>
              <h3 className="font-semibold text-lg">{channel.name}</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-foreground/50 font-medium mb-1">Sent</div>
                <div className="text-xl font-bold">{channel.metrics.sent}</div>
              </div>
              <div>
                <div className="text-xs text-foreground/50 font-medium mb-1">Open Rate</div>
                <div className="text-xl font-bold">{channel.metrics.open}</div>
              </div>
              <div>
                <div className="text-xs text-foreground/50 font-medium mb-1">CTR</div>
                <div className="text-xl font-bold">{channel.metrics.click}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
