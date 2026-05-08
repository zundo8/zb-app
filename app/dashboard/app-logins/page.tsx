"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Smartphone,
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  History
} from "lucide-react";
import { motion } from "framer-motion";

interface AppLogin {
  id: string;
  phone: string;
  status: string;
  userAgent: string | null;
  createdAt: string;
}

export default function AppLoginsPage() {
  const [logins, setLogins] = useState<AppLogin[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetchLogins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/app-logins?page=${page}&limit=${limit}`);
      const data = await res.json();
      setLogins(data.logins || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load logins", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogins();
  }, [fetchLogins]);

  const totalPages = Math.ceil(total / limit);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-20 space-y-6 relative z-10"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            App Login Logs
          </h1>
          <p className="text-[11px] text-foreground/50 tracking-wide">
            Monitor real-time mobile authentication attempts and Twilio OTP success rates.
          </p>
        </div>

        <button
          onClick={fetchLogins}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-[10px] font-medium uppercase tracking-[0.15em] hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh Logs
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-background border border-foreground/[0.05] p-5 rounded-xl">
          <p className="text-[9px] text-foreground/40 font-semibold uppercase tracking-widest mb-1">Total Attempts</p>
          <p className="text-2xl font-bold text-foreground">{total}</p>
        </div>
        <div className="bg-background border border-foreground/[0.05] p-5 rounded-xl">
          <p className="text-[9px] text-foreground/40 font-semibold uppercase tracking-widest mb-1">Recent Success</p>
          <p className="text-2xl font-bold text-green-500">
            {logins.filter(l => l.status === "SUCCESS").length} <span className="text-[10px] text-foreground/40 font-normal">in this page</span>
          </p>
        </div>
        <div className="bg-background border border-foreground/[0.05] p-5 rounded-xl">
          <p className="text-[9px] text-foreground/40 font-semibold uppercase tracking-widest mb-1">Active Platform</p>
          <p className="text-2xl font-bold text-foreground">Mobile App</p>
        </div>
      </div>

      <div className="bg-background border border-foreground/[0.05] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-foreground/[0.05] bg-foreground/[0.01]">
              <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Timestamp</th>
              <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Identifier</th>
              <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Status</th>
              <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Device / Platform</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/[0.05]">
            {loading && logins.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <Loader2 className="w-4 h-4 text-foreground/20 animate-spin mx-auto mb-2" />
                  <span className="text-[10px] text-foreground/40 uppercase tracking-widest">Loading...</span>
                </td>
              </tr>
            ) : logins.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-[10px] text-foreground/40 uppercase tracking-widest">
                  No login attempts recorded yet.
                </td>
              </tr>
            ) : (
              logins.map((login) => (
                <tr key={login.id} className="hover:bg-foreground/[0.01] transition-colors">
                  <td className="px-6 py-4 text-[11px] text-foreground/60">
                    {new Date(login.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-3 h-3 text-foreground/40" />
                      <span className="text-[12px] font-semibold text-foreground">{login.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-widest ${
                      login.status === "SUCCESS" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                    }`}>
                      {login.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] text-foreground/50 max-w-[200px] truncate">
                    {login.userAgent || "Unknown Mobile Device"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <span className="text-[10px] text-foreground/40 font-medium uppercase tracking-widest">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 bg-foreground/5 rounded-md text-[10px] font-medium text-foreground/60 uppercase tracking-widest hover:bg-foreground/10 disabled:opacity-30"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 bg-foreground/5 rounded-md text-[10px] font-medium text-foreground/60 uppercase tracking-widest hover:bg-foreground/10 disabled:opacity-30"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
