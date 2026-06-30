"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Activity,
  Copy,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Database,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

const AUTO_REFRESH_INTERVAL = 60_000; // 60 seconds

interface SyncMeta {
  timestamp: string;
  api_version: string;
  pixel_ok: boolean;
  stats_ok: boolean;
  last_fired_ok: boolean;
}

interface ConnectionCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  detail?: string;
}

interface ConnectionTestResult {
  overall: "pass" | "fail" | "warn";
  checks: ConnectionCheck[];
  api_version: string;
  timestamp: string;
}

export default function MetaPixelPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastSyncFailed, setLastSyncFailed] = useState<string | null>(null);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL / 1000);

  // Connection test state
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [showTest, setShowTest] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (isAutoRefresh = false) => {
    if (!isAutoRefresh) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta/event-stats");
      const json = await res.json();
      if (!res.ok) {
        throw json.error || { summary: "Failed to fetch", detail: json.error?.message || "Unknown error" };
      }
      setData(json);
      setLastSync(new Date().toISOString());
      setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL / 1000);
    } catch (err: any) {
      console.error(err);
      const errorObj =
        typeof err === "object" && err.summary
          ? err
          : { summary: "Connection Error", detail: err.message || "Error connecting to Meta API" };
      setError(errorObj);
      setLastSyncFailed(new Date().toISOString());
      if (isAutoRefresh) {
        // Don't blank the screen on auto-refresh failure — keep stale data
        toast.error("Meta sync failed — showing cached data");
      }
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, []);

  const runConnectionTest = useCallback(async () => {
    setTestLoading(true);
    setShowTest(true);
    try {
      const res = await fetch("/api/meta/connection-test");
      const json = await res.json();
      setTestResult(json);
    } catch (err: any) {
      setTestResult({
        overall: "fail",
        checks: [{ name: "Network", status: "fail", message: err.message || "Failed to reach connection test endpoint" }],
        api_version: "unknown",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setTestLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchData();

    intervalRef.current = setInterval(() => {
      fetchData(true);
    }, AUTO_REFRESH_INTERVAL);

    countdownRef.current = setInterval(() => {
      setAutoRefreshCountdown((prev) => (prev <= 1 ? AUTO_REFRESH_INTERVAL / 1000 : prev - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchData]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Pixel ID copied to clipboard");
  };

  const handleManualRefresh = () => {
    fetchData();
    setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL / 1000);
  };

  // ── Loading State ──────────────────────────
  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/20" />
      </div>
    );
  }

  // ── Error State ─────────────────────────────
  if (error && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Meta Pixel & Dataset Status</h1>
            <p className="text-sm text-muted-foreground mt-1">Direct integration diagnostics from Meta Graph API</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runConnectionTest}
              disabled={testLoading}
              className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 rounded-xl px-4 py-2 text-sm transition-all disabled:opacity-50"
            >
              {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Test Connection
            </button>
            <button
              onClick={handleManualRefresh}
              className="flex items-center gap-2 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl px-4 py-2 text-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        </div>

        <div className="glass-card p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-xl mx-auto mt-8 border-red-500/20 bg-red-500/[0.02]">
          <div className="p-4 bg-red-500/10 rounded-full text-red-500">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold text-lg">{error.summary || "Failed to Connect with Meta"}</h2>
            <p className="text-sm text-muted-foreground max-w-sm">{error.detail || "Unknown error"}</p>
            {error.fix && (
              <p className="text-xs text-muted-foreground/70 max-w-sm mt-2 border-t border-foreground/5 pt-2">
                <span className="font-medium text-foreground/60">Fix: </span>
                {error.fix}
              </p>
            )}
            {error.code && typeof error.code === "number" && (
              <p className="text-xs text-muted-foreground/50 font-mono mt-1">
                Meta Error #{error.code}
                {error.subcode ? `.${error.subcode}` : ""}
                {error.endpoint ? ` on ${error.endpoint}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Connection Test Results */}
        <AnimatePresence>
          {showTest && <ConnectionTestPanel result={testResult} loading={testLoading} />}
        </AnimatePresence>
      </div>
    );
  }

  // ── Success State ───────────────────────────
  const creationDate = data?.creation_time
    ? new Date(data.creation_time).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";

  const lastFiredDate = data?.last_fired_time
    ? new Date(
        typeof data.last_fired_time === "number" && data.last_fired_time < 1e12
          ? data.last_fired_time * 1000
          : data.last_fired_time
      ).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";

  // Extract stats arrays safely
  const eventStats = data?.stats?.data || [];
  const syncMeta: SyncMeta | null = data?._sync || null;

  const connectionStatus = syncMeta?.pixel_ok ? "connected" : "partial";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Meta Pixel & Dataset</h1>
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-amber-500/10 text-amber-500"
              }`}
            >
              {connectionStatus === "connected" ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              {connectionStatus === "connected" ? "Connected" : "Partial"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time tracking and server-side integration quality logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runConnectionTest}
            disabled={testLoading}
            className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 rounded-xl px-4 py-2 text-sm transition-all disabled:opacity-50"
          >
            {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Test Connection
          </button>
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-2 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-xl px-4 py-2 text-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Sync Status Bar */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
        <div className="flex items-center gap-4">
          {lastSync && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Last sync: {new Date(lastSync).toLocaleTimeString("en-IN")}
            </span>
          )}
          {lastSyncFailed && (
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-400" />
              Last failed: {new Date(lastSyncFailed).toLocaleTimeString("en-IN")}
            </span>
          )}
          {syncMeta?.api_version && (
            <span className="font-mono opacity-60">API {syncMeta.api_version}</span>
          )}
        </div>
        <span className="flex items-center gap-1 opacity-60">
          <Clock className="w-3 h-3" />
          Auto-refresh in {autoRefreshCountdown}s
        </span>
      </div>

      {/* Connection Test Results */}
      <AnimatePresence>
        {showTest && <ConnectionTestPanel result={testResult} loading={testLoading} />}
      </AnimatePresence>

      {/* Main Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase">
              Dataset Name
            </span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">{data?.name || "Zica Bella Pixel"}</h3>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground font-mono">
              <span>ID: {data?.id}</span>
              <button
                onClick={() => handleCopy(data?.id)}
                className="hover:text-foreground transition-colors p-0.5"
                title="Copy ID"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase">
              Last Event Received
            </span>
            <Activity className="w-5 h-5 text-indigo-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">{lastFiredDate}</h3>
            <span className="text-xs text-muted-foreground mt-2 block">Source: Browser/Server direct sync</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-foreground/50 tracking-wider uppercase">Created On</span>
            <Calendar className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">{creationDate}</h3>
            <span className="text-xs text-muted-foreground mt-2 block">Direct integration Dataset API</span>
          </div>
        </motion.div>
      </div>

      {/* Dataset Event Stats / Event Match Quality */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight mt-8">Active Event Metrics</h2>

        {eventStats.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">
            No active event history returned within the Meta attribution window. Keep testing client actions to populate
            stats.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eventStats.map((event: any, i: number) => {
              const qualityScore = event.match_quality || 100;
              const qualityColor =
                qualityScore >= 90 ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10";

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="glass-card p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-foreground/5 text-foreground/75">
                        <Database className="w-4 h-4" />
                      </div>
                      <h3 className="font-semibold text-md">{event.event_type}</h3>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${qualityColor}`}>
                      {qualityScore}% Match Quality
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2 border-t border-foreground/5 font-mono">
                    <div>
                      <div className="text-[10px] text-muted-foreground font-sans font-semibold uppercase tracking-wider">
                        Browser Events
                      </div>
                      <div className="text-lg font-bold mt-1">{event.browser_count || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground font-sans font-semibold uppercase tracking-wider">
                        Server Events
                      </div>
                      <div className="text-lg font-bold mt-1">{event.server_count || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground font-sans font-semibold uppercase tracking-wider">
                        Deduplicated
                      </div>
                      <div className="text-lg font-bold mt-1">{event.deduplicated_count || 0}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Connection Test Panel ──────────────────
function ConnectionTestPanel({
  result,
  loading,
}: {
  result: ConnectionTestResult | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="glass-card p-6 space-y-4 border-indigo-500/20 bg-indigo-500/[0.02]"
      >
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-sm font-medium">Running connection diagnostics...</span>
        </div>
      </motion.div>
    );
  }

  if (!result) return null;

  const statusIcon = {
    pass: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    fail: <XCircle className="w-5 h-5 text-red-500" />,
    warn: <AlertCircle className="w-5 h-5 text-amber-500" />,
  };

  const overallColors = {
    pass: "border-emerald-500/20 bg-emerald-500/[0.02]",
    fail: "border-red-500/20 bg-red-500/[0.02]",
    warn: "border-amber-500/20 bg-amber-500/[0.02]",
  };

  const overallLabels = {
    pass: "All Checks Passed",
    fail: "Connection Failed",
    warn: "Partial Issues Detected",
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className={`glass-card p-6 space-y-4 ${overallColors[result.overall]}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {statusIcon[result.overall]}
          <div>
            <h3 className="font-semibold text-sm">{overallLabels[result.overall]}</h3>
            <p className="text-xs text-muted-foreground">
              Graph API {result.api_version} •{" "}
              {new Date(result.timestamp).toLocaleTimeString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {result.checks.map((check, i) => (
          <div
            key={i}
            className="flex items-start gap-3 py-2 px-3 rounded-lg bg-foreground/[0.02] border border-foreground/5"
          >
            <div className="mt-0.5">
              {check.status === "pass" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {check.status === "fail" && <XCircle className="w-4 h-4 text-red-500" />}
              {check.status === "warn" && <AlertCircle className="w-4 h-4 text-amber-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold">{check.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 break-words">{check.message}</div>
              {check.detail && (
                <div className="text-[11px] text-muted-foreground/60 mt-1 break-words font-mono">
                  {check.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
