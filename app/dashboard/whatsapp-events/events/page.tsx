"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Database, Search, Download, Eye, AlertCircle, RefreshCcw, 
  Calendar, Phone, Tag, ShoppingBag, User, X
} from "lucide-react";
import { toast } from "sonner";

export default function EventsFeedPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: "25",
          search,
          eventType
        });
        const res = await fetch(`/api/whatsapp-events/list?${queryParams.toString()}`);
        const data = await res.json();
        if (res.ok) {
          setEvents(data.events || []);
          setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
        } else {
          toast.error(data.error || "Failed to load events feed.");
        }
      } catch (err) {
        toast.error("Network error loading events feed.");
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, [page, search, eventType, refreshTrigger]);

  const handleExportCSV = () => {
    const queryParams = new URLSearchParams({
      search,
      eventType,
      exportCsv: "true"
    });
    window.open(`/api/whatsapp-events/list?${queryParams.toString()}`);
    toast.success("CSV export triggered successfully.");
  };

  const getSourceBadgeColor = (source: string) => {
    if (source === "web") return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    if (source === "mobile") return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    if (source === "whatsapp") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    return "bg-muted text-muted-foreground border-foreground/10";
  };

  const getStatusBadgeColor = (status: string) => {
    if (status === "forwarded") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    if (status === "processed") return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    if (status === "failed") return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time log of tracked commerce, user accounts, and marketing events.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setRefreshTrigger(p => p + 1)}
            className="p-2.5 bg-foreground/5 hover:bg-foreground/10 text-foreground border border-foreground/10 rounded-xl transition-all"
            title="Refresh Feed"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-foreground font-semibold rounded-xl transition-colors border border-emerald-500/10 shadow-lg text-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by phone, event name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="glass-input pl-10 w-full text-sm"
          />
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
          {[
            { id: "all", label: "All Events" },
            { id: "commerce", label: "Commerce" },
            { id: "customer", label: "Customer" },
            { id: "marketing", label: "Marketing" }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => { setEventType(filter.id); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                eventType === filter.id 
                  ? "bg-foreground/10 text-foreground border-foreground/20 shadow-md"
                  : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed List */}
      <div className="glass-card overflow-hidden">
        {loading && events.length === 0 ? (
          <div className="p-12 flex items-center justify-center">
            <RefreshCcw className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : events.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Database className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-sm font-semibold text-muted-foreground">No events tracked matching search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-foreground/5 bg-foreground/[0.02]">
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Event</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Customer Info</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Source</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Created At</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-foreground/[0.01] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground/90">{evt.eventName}</span>
                        {evt.orderId && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-mono border border-emerald-500/20">
                            #{evt.orderId.replace("ord_", "")}
                          </span>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-foreground/80">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{evt.customerPhone || "N/A"}</span>
                        </div>
                        {evt.customerId && (
                          <span className="text-[10px] text-muted-foreground font-mono">ID: {evt.customerId}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border ${getSourceBadgeColor(evt.eventSource)}`}>
                        {evt.eventSource.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border ${getStatusBadgeColor(evt.status)}`}>
                        {evt.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono">
                      {new Date(evt.createdAt).toLocaleString("en-IN")}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => { setSelectedEvent(evt); setIsModalOpen(true); }}
                        className="p-2 hover:bg-foreground/5 text-muted-foreground hover:text-foreground rounded-lg transition-colors border border-transparent hover:border-foreground/10"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-foreground/5 flex justify-between items-center text-sm text-muted-foreground">
            <span>Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total events)</span>
            
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3.5 py-1.5 bg-foreground/5 hover:bg-foreground/10 text-foreground font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed border border-foreground/10 transition-colors text-xs"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3.5 py-1.5 bg-foreground/5 hover:bg-foreground/10 text-foreground font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed border border-foreground/10 transition-colors text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {isModalOpen && selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card relative max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col z-10 border border-foreground/10 shadow-2xl"
            >
              <div className="flex justify-between items-center px-6 py-4 border-b border-foreground/5 bg-foreground/[0.01]">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-semibold text-lg">Event Payload Inspector</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-foreground/5 text-muted-foreground hover:text-foreground rounded-lg transition-colors border border-transparent hover:border-foreground/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-mono">Event Name</span>
                    <p className="font-semibold">{selectedEvent.eventName}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-mono">Source Channel</span>
                    <p className="font-semibold">{selectedEvent.eventSource.toUpperCase()}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-mono">Customer Phone</span>
                    <p className="font-semibold">{selectedEvent.customerPhone || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-mono">Status</span>
                    <p className="font-semibold">{selectedEvent.status.toUpperCase()}</p>
                  </div>
                </div>

                {/* Metadata JSON Viewer */}
                <div className="space-y-2 pt-2 border-t border-foreground/5">
                  <span className="text-xs text-muted-foreground uppercase font-mono">Event Metadata</span>
                  <div className="bg-background/50 border border-foreground/10 p-4 rounded-xl overflow-x-auto text-xs font-mono select-all text-emerald-400">
                    <pre>{JSON.stringify(JSON.parse(selectedEvent.metadataJson || "{}"), null, 2)}</pre>
                  </div>
                </div>

                {/* Meta API Conversions API Delivery Log */}
                {selectedEvent.logs && selectedEvent.logs.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-foreground/5">
                    <h4 className="text-xs font-bold text-foreground/60 uppercase font-mono">Conversions API Logs</h4>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Status: <strong className={selectedEvent.logs[0].status === 'success' ? 'text-emerald-500' : 'text-rose-500'}>{selectedEvent.logs[0].status.toUpperCase()}</strong></span>
                        <span className="text-muted-foreground font-mono">{new Date(selectedEvent.logs[0].createdAt).toLocaleString("en-IN")}</span>
                      </div>
                      
                      {selectedEvent.logs[0].errorMessage && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs">
                          <strong>Error Message:</strong> {selectedEvent.logs[0].errorMessage}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-muted-foreground uppercase font-mono">CAPI Request Payload</span>
                          <div className="bg-background/30 border border-foreground/5 p-3 rounded-lg overflow-x-auto text-[10px] font-mono text-foreground/80 max-h-36">
                            <pre>{selectedEvent.logs[0].requestPayload || "No payload logged"}</pre>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] text-muted-foreground uppercase font-mono">CAPI Response Payload</span>
                          <div className="bg-background/30 border border-foreground/5 p-3 rounded-lg overflow-x-auto text-[10px] font-mono text-foreground/80 max-h-36">
                            <pre>{selectedEvent.logs[0].responsePayload || "No response logged"}</pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
