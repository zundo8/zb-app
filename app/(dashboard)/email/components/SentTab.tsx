'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function SentTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const fetchLogs = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/logs?page=${p}&limit=20`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.pages || 1);
      setPage(p);
    } catch (error) {
      toast.error('Failed to load email logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleCancelScheduled = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled email?')) return;
    try {
      const res = await fetch(`/api/email/logs?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Scheduled email cancelled');
        fetchLogs(page);
      } else {
        toast.error('Failed to cancel');
      }
    } catch (e) {
      toast.error('Failed to cancel');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white">Sent Emails</h2>
        <button onClick={() => fetchLogs(page)} className="text-gray-400 hover:text-white transition">
          ↻ Refresh
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/20 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/10">
              <th className="px-6 py-4">Subject</th>
              <th className="px-6 py-4">Template</th>
              <th className="px-6 py-4">Recipients</th>
              <th className="px-6 py-4">Sent / Scheduled At</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-full"></div></td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">
                  No emails have been sent yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-white max-w-[200px] truncate">{log.subject}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{log.templateName || 'Custom'}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{log.recipientName}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {log.triggerEvent ? new Date(log.triggerEvent).toLocaleString() : new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                      log.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                      log.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition"
                      >
                        Details
                      </button>
                      {log.status === 'scheduled' && (
                        <button
                          onClick={() => handleCancelScheduled(log.id)}
                          className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-400 px-3 py-1.5 rounded transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex justify-between items-center bg-black/20">
            <button 
              disabled={page === 1} 
              onClick={() => fetchLogs(page - 1)}
              className="px-4 py-2 text-xs bg-white/10 rounded hover:bg-white/20 disabled:opacity-50 text-white"
            >
              Previous
            </button>
            <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
            <button 
              disabled={page === totalPages} 
              onClick={() => fetchLogs(page + 1)}
              className="px-4 py-2 text-xs bg-white/10 rounded hover:bg-white/20 disabled:opacity-50 text-white"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#161616]">
              <h2 className="text-base font-medium text-white">Email Log Details</h2>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-white p-2">✕</button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 block mb-1">Subject</span>
                  <span className="text-white">{selectedLog.subject}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Template</span>
                  <span className="text-white">{selectedLog.templateName || 'Custom'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Recipients Count</span>
                  <span className="text-white">{selectedLog.recipientName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Status</span>
                  <span className={`capitalize ${selectedLog.status === 'failed' ? 'text-red-400' : 'text-green-400'}`}>
                    {selectedLog.status}
                  </span>
                </div>
              </div>
              
              {selectedLog.errorMessage && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-mono break-all">
                  {selectedLog.errorMessage}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/10 bg-[#161616] flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
