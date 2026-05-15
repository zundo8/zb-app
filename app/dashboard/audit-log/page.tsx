"use client";

import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Shield, 
  Activity,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-logs?page=${page}&limit=${limit}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs);
        setTotal(data.total);
      } else {
        toast.error(data.error || 'Failed to fetch audit logs');
      }
    } catch (error) {
      toast.error('An error occurred while fetching audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (action.includes('DELETE')) return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (action.includes('UPDATE')) return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    if (action.includes('LOGIN')) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-foreground/40 bg-foreground/5 border-foreground/10';
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
            System Audit Log
          </h1>
          <p className="text-foreground/50 text-sm">
            Track all administrative actions and security events.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-foreground/5 border border-foreground/10 rounded-xl text-sm font-medium hover:bg-foreground/10 transition-all">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card rounded-[2.5rem] border border-foreground/5 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-foreground/[0.03]">
                <th className="px-8 py-5 text-[11px] font-bold text-foreground/40 uppercase tracking-wider">Timestamp</th>
                <th className="px-8 py-5 text-[11px] font-bold text-foreground/40 uppercase tracking-wider">User</th>
                <th className="px-8 py-5 text-[11px] font-bold text-foreground/40 uppercase tracking-wider">Action</th>
                <th className="px-8 py-5 text-[11px] font-bold text-foreground/40 uppercase tracking-wider">Module</th>
                <th className="px-8 py-5 text-[11px] font-bold text-foreground/40 uppercase tracking-wider">Details</th>
                <th className="px-8 py-5 text-[11px] font-bold text-foreground/40 uppercase tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-foreground/20" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <History className="w-12 h-12 mx-auto text-foreground/10 mb-2" />
                    <p className="text-foreground/40">No audit logs found.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr 
                    key={log.id}
                    className="border-b border-foreground/[0.03] hover:bg-foreground/[0.01] transition-colors"
                  >
                    <td className="px-8 py-4 whitespace-nowrap text-foreground/60">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-foreground/5 flex items-center justify-center text-[10px] font-bold border border-foreground/5">
                          {log.user?.name?.substring(0, 2).toUpperCase() || 'SY'}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{log.user?.name || 'System'}</span>
                          <span className="text-[10px] text-foreground/40">{log.user?.email || 'automated'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-8 py-4 font-medium text-foreground/60 uppercase text-[11px]">
                      {log.module || '—'}
                    </td>
                    <td className="px-8 py-4 max-w-xs truncate text-foreground/60" title={JSON.stringify(log.metadata)}>
                      {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata)}
                    </td>
                    <td className="px-8 py-4 text-foreground/40 font-mono text-[11px]">
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && total > limit && (
          <div className="px-8 py-4 bg-foreground/[0.02] border-t border-foreground/5 flex items-center justify-between">
            <span className="text-[12px] text-foreground/40 font-medium">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} events
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl border border-foreground/10 hover:bg-foreground/5 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= total}
                className="p-2 rounded-xl border border-foreground/10 hover:bg-foreground/5 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.01);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .dark .glass-card {
          background: rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}
