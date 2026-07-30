/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, Eye,
  Activity, ShoppingCart, Target, BarChart3, Globe as GlobeIcon, Smartphone,
  Monitor, RefreshCw, CreditCard,
  ArrowDownRight, Percent, AlertTriangle, MapPin, Building2,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// Dynamic Client-Only Import of Globe3D to prevent SSR hydration mismatches
const Globe3D = dynamic(() => import("@/components/Globe3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-square flex items-center justify-center bg-foreground/[0.02] rounded-2xl">
      <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground/80 rounded-full animate-spin" />
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────

export interface VisitorPoint {
  countryCode: string;
  country: string;
  city: string;
  lat: number | null;
  lng: number | null;
  count: number;
}

interface OverviewData {
  error?: string;
  period: { from: string; to: string };
  revenue: { total: number; net: number; gross: number; refunds: number; discounts: number; change: number };
  orders: {
    total: number; aov: number; cancelled: number; returned: number; refunded: number; change: number;
    statusBreakdown: { status: string; count: number }[];
    paymentBreakdown: { method: string; count: number; revenue: number }[];
  };
  customers: { total: number; new: number; returning: number; change: number };
  logins: { total: number; new: number; change: number; newChange: number };
  visitors: { total: number; active: number; change: number };
  sessions: { total: number; web: number; app: number; change: number };
  funnel: { pageViews: number; productViews: number; addToCart: number; checkoutStarted: number; paymentInitiated: number; purchases: number };
  carts: { total: number; active: number; abandoned: number; converted: number; abandonmentRate: number };
  rates: { conversion: number; addToCart: number; cartToCheckout: number; checkoutToPurchase: number; cartAbandonment: number };
  platformSplit: {
    web: { orders: number; revenue: number; sessions: number; visitors: number };
    app: { orders: number; revenue: number; sessions: number; visitors: number };
  };
}

interface ChartData {
  error?: string;
  timeSeries: {
    date: string; revenue: number; orders: number; sessions: number;
    visitors: number; add_to_cart: number; begin_checkout: number;
    purchase: number; conversionRate: number; logins: number; newLogins: number;
  }[];
  granularity: string;
}

interface FunnelStage {
  stage: string; sessions: number; users: number;
  conversionFromPrevious: number; conversionFromFirst: number;
  dropOff: number; dropOffCount: number;
}

interface FunnelData {
  error?: string;
  funnel: FunnelStage[];
}

interface TrafficSource {
  source: string; medium: string; sessions: number; visitors: number;
  addToCart: number; checkouts: number; orders: number;
  revenue: number; conversionRate: number;
}

interface TrafficData {
  error?: string;
  sources: TrafficSource[];
}

interface RealtimeData {
  error?: string;
  summary: {
    totalActive: number;
    webActive: number;
    appActive: number;
    newVisitors: number;
    returningVisitors: number;
    unknownCount?: number;
  };
  topPages: { page: string; count: number }[];
  breakdowns: {
    device: Record<string, number>;
    browser: Record<string, number>;
    os?: Record<string, number>;
    country?: Record<string, number>;
  };
  visitorPoints?: VisitorPoint[];
  unknownCount?: number;
}

interface LocationCountry {
  code: string;
  name: string;
  sessions: number;
  visitors: number;
  share: number;
}

interface LocationCity {
  city: string;
  countryCode: string;
  sessions: number;
  visitors: number;
  share: number;
  lat: number | null;
  lng: number | null;
}

interface LocationsData {
  error?: string;
  topCountries: LocationCountry[];
  topCities: LocationCity[];
  visitorPoints: VisitorPoint[];
  summary: {
    totalWithLocation: number;
    totalWithoutLocation: number;
    uniqueCountries: number;
    uniqueCities: number;
  };
}

// ─── Date Presets ─────────────────────────────────────────

const DATE_PRESETS = [
  { label: "Today", getValue: () => { const d = new Date(); return { from: startOfDay(d), to: d }; } },
  { label: "Yesterday", getValue: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { from: startOfDay(d), to: endOfDay(d) }; } },
  { label: "Last 7 Days", getValue: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); return { from: startOfDay(from), to }; } },
  { label: "Last 30 Days", getValue: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29); return { from: startOfDay(from), to }; } },
  { label: "This Month", getValue: () => { const now = new Date(); return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }; } },
  { label: "Last Month", getValue: () => { const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth() - 1, 1); const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); return { from, to }; } },
  { label: "This Year", getValue: () => { const now = new Date(); return { from: new Date(now.getFullYear(), 0, 1), to: now }; } },
];

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

// ─── Formatting Helpers ──────────────────────────────────

function formatCurrency(val: number): string {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toLocaleString("en-IN")}`;
}

function formatNumber(val: number): string {
  if (val >= 100000) return `${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val.toLocaleString("en-IN");
}

function formatChartDate(dateStr: string, granularity: string): string {
  const d = new Date(dateStr);
  if (granularity === "hour") return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (granularity === "day") return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (granularity === "week") return `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleDateString("en-IN", { month: "short" })}`;
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

const FUNNEL_LABELS: Record<string, string> = {
  page_view: "Visitors",
  view_item: "Product Views",
  add_to_cart: "Add to Cart",
  begin_checkout: "Checkout",
  payment_initiated: "Payment",
  purchase: "Purchase",
};

const FUNNEL_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c084fc", "#d946ef", "#10b981"];

// ─── Component ───────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [activePreset, setActivePreset] = useState(2); // Last 7 Days
  const [dateRange, setDateRange] = useState(DATE_PRESETS[2].getValue());
  const [platform, setPlatform] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[] | null>(null);
  const [funnelError, setFunnelError] = useState<string | null>(null);
  const [traffic, setTraffic] = useState<TrafficSource[] | null>(null);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [locations, setLocations] = useState<LocationsData | null>(null);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");
  const [activeChart, setActiveChart] = useState<"revenue" | "orders" | "sessions" | "conversion" | "logins" | "newLogins">("revenue");
  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    // Cancel any in-flight requests
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const params = new URLSearchParams({
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
      ...(platform ? { platform } : {}),
    });

    try {
      const results = await Promise.allSettled([
        fetch(`/api/admin/analytics/overview?${params}`, { signal: controller.signal }).then(r => r.json()),
        fetch(`/api/admin/analytics/charts?${params}`, { signal: controller.signal }).then(r => r.json()),
        fetch(`/api/admin/analytics/funnel?${params}`, { signal: controller.signal }).then(r => r.json()),
        fetch(`/api/admin/analytics/traffic?${params}`, { signal: controller.signal }).then(r => r.json()),
        fetch(`/api/admin/analytics/realtime`, { signal: controller.signal }).then(r => r.json()),
        fetch(`/api/admin/analytics/locations?${params}`, { signal: controller.signal }).then(r => r.json()),
      ]);

      if (controller.signal.aborted) return;

      const getValue = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value : null;

      const ovData: OverviewData | null = getValue(results[0]);
      const chData: ChartData | null = getValue(results[1]);
      const fnData: FunnelData | null = getValue(results[2]);
      const trData: TrafficData | null = getValue(results[3]);
      const rtData: RealtimeData | null = getValue(results[4]);
      const locData: LocationsData | null = getValue(results[5]);

      if (ovData) setOverview(ovData);
      if (chData) setCharts(chData);
      if (fnData) {
        setFunnel(fnData.funnel || []);
        setFunnelError(fnData.error || null);
      }
      if (trData) {
        setTraffic(trData.sources || []);
        setTrafficError(trData.error || null);
      }
      if (rtData) setRealtime(rtData);
      if (locData) {
        setLocations(locData);
        setLocationsError(locData.error || null);
      }

      setLastRefreshedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("[Analytics] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, platform]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh realtime every 20s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/analytics/realtime");
        if (res.ok) {
          const data = await res.json();
          setRealtime(data);
        }
      } catch { /* ignore */ }
    }, 20_000);
    return () => clearInterval(interval);
  }, []);

  const handlePresetChange = (index: number) => {
    setActivePreset(index);
    setDateRange(DATE_PRESETS[index].getValue());
  };

  // Globe points: prefer historical locations data, fall back to realtime
  const globePoints = useMemo<VisitorPoint[]>(() => {
    // Historical data from locations API (covers selected date range)
    if (locations && locations.visitorPoints && locations.visitorPoints.length > 0) {
      return locations.visitorPoints;
    }
    // Fallback to realtime visitor points
    if (realtime && realtime.visitorPoints && realtime.visitorPoints.length > 0) {
      return realtime.visitorPoints;
    }
    return [];
  }, [locations, realtime]);

  // Realtime-only top countries/cities for the live sidebar
  const { realtimeTopCountries, realtimeTopCities } = useMemo(() => {
    if (!realtime) return { realtimeTopCountries: [], realtimeTopCities: [] };

    const pts = realtime.visitorPoints || [];
    const totalPtsCount = pts.reduce((acc, p) => acc + p.count, 0) || 1;

    const cMap = new Map<string, { code: string; name: string; count: number }>();
    pts.forEach((p) => {
      const code = p.countryCode || "XX";
      const name = p.country || code;
      const existing = cMap.get(code) || { code, name, count: 0 };
      existing.count += p.count;
      cMap.set(code, existing);
    });

    const countryList = Array.from(cMap.values())
      .sort((a, b) => b.count - a.count)
      .map((c) => ({ ...c, share: Math.round((c.count / totalPtsCount) * 100) }));

    const cityMap = new Map<string, { city: string; country: string; count: number }>();
    pts.forEach((p) => {
      if (p.city && p.city !== "Unknown" && p.city !== "Centroid") {
        const key = `${p.city}, ${p.countryCode}`;
        const existing = cityMap.get(key) || { city: p.city, country: p.countryCode, count: 0 };
        existing.count += p.count;
        cityMap.set(key, existing);
      }
    });

    const cityList = Array.from(cityMap.values())
      .sort((a, b) => b.count - a.count)
      .map((c) => ({ ...c, share: Math.round((c.count / totalPtsCount) * 100) }));

    return { realtimeTopCountries: countryList, realtimeTopCities: cityList };
  }, [realtime]);

  // ─── Change Badge ──────────────────────────────────────
  const ChangeBadge = ({ value }: { value: number }) => {
    if (value === 0) return <span className="text-[10px] text-foreground/30 font-medium">—</span>;
    const isPositive = value > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
        isPositive ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
      }`}>
        {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
        {Math.abs(value)}%
      </span>
    );
  };

  // ─── Section Inline Error State ────────────────────────
  const SectionError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs my-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
        <span>Failed to load section: {message}</span>
      </div>
      <button onClick={onRetry} className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-[10px] font-semibold transition-colors">
        Retry
      </button>
    </div>
  );

  // ─── KPI Card ──────────────────────────────────────────
  const KpiCard = ({ label, value, change, icon: Icon, prefix = "" }: {
    label: string; value: string; change?: number; icon: any; prefix?: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01, boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)" }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="glass-card p-5 rounded-2xl border border-foreground/5 hover:border-foreground/15 bg-gradient-to-br from-foreground/[0.01] to-foreground/[0.03] backdrop-blur-xl relative overflow-hidden group cursor-pointer"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-foreground/[0.02] rounded-full blur-xl group-hover:bg-foreground/[0.04] transition-all duration-500" />
      <div className="flex items-center justify-between mb-3.5 relative z-10">
        <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-wider">{label}</span>
        <div className="p-1.5 rounded-lg bg-foreground/[0.03] group-hover:bg-foreground/5 transition-colors">
          <Icon className="w-3.5 h-3.5 text-foreground/30 group-hover:text-foreground/60 transition-colors" />
        </div>
      </div>
      <div className="flex items-baseline gap-2 relative z-10">
        <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">{prefix}{value}</span>
        {change !== undefined && <ChangeBadge value={change} />}
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-foreground/40 mt-1">Real-time e-commerce analytics & performance</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshedAt && (
            <span className="text-[11px] text-foreground/40 font-medium">
              Data as of <span className="text-foreground/70">{lastRefreshedAt}</span>
            </span>
          )}
          <button onClick={fetchAll} disabled={loading} className="p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors border border-foreground/10 flex items-center gap-1.5 text-xs font-medium">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── Filters ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Date Presets */}
        <div className="flex flex-wrap gap-1.5 bg-foreground/[0.03] rounded-xl p-1 border border-foreground/5">
          {DATE_PRESETS.map((preset, i) => (
            <button
              key={i}
              onClick={() => handlePresetChange(i)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                activePreset === i
                  ? "bg-foreground text-background shadow-sm"
                  : "text-foreground/50 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Platform Filter */}
        <div className="flex gap-1 bg-foreground/[0.03] rounded-xl p-1 border border-foreground/5">
          {[
            { label: "All", value: null },
            { label: "Web", value: "web", icon: GlobeIcon },
            { label: "App", value: "app", icon: Smartphone },
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => setPlatform(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                platform === opt.value
                  ? "bg-foreground text-background shadow-sm"
                  : "text-foreground/50 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {opt.icon && <opt.icon className="w-3 h-3" />}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Real-time indicator */}
        {realtime && !realtime.error && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[11px] font-medium text-foreground/50">
              {realtime.summary.totalActive} active now
            </span>
          </div>
        )}
      </div>

      {/* ─── Overview Section Error ───────────────────────── */}
      {overview?.error && (
        <SectionError message={overview.error} onRetry={fetchAll} />
      )}

      {/* ─── KPI Cards / Loading Skeletons ──────────────── */}
      {loading && !overview ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="glass-card p-5 rounded-2xl border border-foreground/5 h-24 animate-pulse bg-foreground/[0.02]" />
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <KpiCard label="Total Revenue" value={formatCurrency(overview.revenue.total)} change={overview.revenue.change} icon={DollarSign} />
          <KpiCard label="Net Revenue" value={formatCurrency(overview.revenue.net)} icon={CreditCard} />
          <KpiCard label="Total Orders" value={formatNumber(overview.orders.total)} change={overview.orders.change} icon={ShoppingBag} />
          <KpiCard label="Avg Order Value" value={formatCurrency(overview.orders.aov)} icon={Target} />
          <KpiCard label="Customers" value={formatNumber(overview.customers.total)} change={overview.customers.change} icon={Users} />
          <KpiCard label="Total Logins" value={formatNumber(overview.logins.total)} change={overview.logins.change} icon={Activity} />
          <KpiCard label="New Signups" value={formatNumber(overview.logins.new)} change={overview.logins.newChange} icon={Users} />
          <KpiCard label="Total Visitors" value={formatNumber(overview.visitors.total)} change={overview.visitors.change} icon={Eye} />
          <KpiCard label="Sessions" value={formatNumber(overview.sessions.total)} change={overview.sessions.change} icon={Activity} />
          <KpiCard label="Conversion Rate" value={`${overview.rates.conversion}%`} icon={Percent} />
          <KpiCard label="Add to Cart Rate" value={`${overview.rates.addToCart}%`} icon={ShoppingCart} />
          <KpiCard label="Cart Abandonment" value={`${overview.rates.cartAbandonment}%`} icon={ArrowDownRight} />
        </div>
      ) : null}

      {/* ─── Top Visitor Locations ──────────────────────────── */}
      {locationsError && <SectionError message={locationsError} onRetry={fetchAll} />}
      {loading && !locations ? (
        <div className="glass-card rounded-2xl border border-foreground/5 p-5 h-80 animate-pulse bg-foreground/[0.02]" />
      ) : locations ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-foreground/5 p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <GlobeIcon className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-foreground/70">Top Visitor Locations</h2>
            </div>
            {locations.summary && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-foreground/40 font-medium">
                  {formatNumber(locations.summary.uniqueCountries)} countries · {formatNumber(locations.summary.uniqueCities)} cities
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Globe Column */}
            <div className="lg:col-span-1 flex flex-col items-center justify-center min-h-[280px]">
              <div className="flex items-center gap-1.5 mb-1">
                <GlobeIcon className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">Visitor Map</span>
              </div>
              <Globe3D
                points={globePoints}
                countries={realtime?.breakdowns?.country || {}}
                unknownCount={locations.summary?.totalWithoutLocation || 0}
              />
            </div>

            {/* Top Countries Column */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-1.5 mb-3">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <h3 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">Top Countries</h3>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                {locations.topCountries.slice(0, 10).map((c, idx) => (
                  <div key={c.code} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-foreground/30 w-4">{idx + 1}</span>
                        <span className="text-[11px] font-medium text-foreground/70">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-foreground/40">{formatNumber(c.visitors)} visitors</span>
                        <span className="text-[10px] font-semibold text-foreground/60 bg-foreground/[0.04] px-1.5 py-0.5 rounded">{c.share}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-foreground/[0.04] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(c.share, 2)}%` }}
                        transition={{ duration: 0.6, delay: idx * 0.05 }}
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                      />
                    </div>
                  </div>
                ))}
                {locations.topCountries.length === 0 && (
                  <div className="text-center py-8 text-foreground/20 text-xs">No country data available</div>
                )}
              </div>
            </div>

            {/* Top Cities Column */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-1.5 mb-3">
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                <h3 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">Top Cities</h3>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                {locations.topCities.slice(0, 10).map((c, idx) => (
                  <div key={`${c.city}-${c.countryCode}`} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-foreground/30 w-4">{idx + 1}</span>
                        <div>
                          <span className="text-[11px] font-medium text-foreground/70">{c.city}</span>
                          <span className="text-[10px] text-foreground/30 ml-1">{c.countryCode}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-foreground/40">{formatNumber(c.visitors)} visitors</span>
                        <span className="text-[10px] font-semibold text-foreground/60 bg-foreground/[0.04] px-1.5 py-0.5 rounded">{c.share}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-foreground/[0.04] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(c.share, 2)}%` }}
                        transition={{ duration: 0.6, delay: idx * 0.05 }}
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400"
                      />
                    </div>
                  </div>
                ))}
                {locations.topCities.length === 0 && (
                  <div className="text-center py-8 text-foreground/20 text-xs">No city data available</div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* ─── Charts Section ──────────────────────────────── */}
      {charts?.error && <SectionError message={charts.error} onRetry={fetchAll} />}

      {loading && !charts ? (
        <div className="glass-card rounded-2xl border border-foreground/5 p-5 h-80 animate-pulse bg-foreground/[0.02]" />
      ) : charts && charts.timeSeries.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-foreground/5 p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-foreground/70">Performance Over Time</h2>
            <div className="flex flex-wrap gap-1 bg-foreground/[0.03] rounded-lg p-0.5 border border-foreground/5">
              {(["revenue", "orders", "sessions", "conversion", "logins", "newLogins"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveChart(key)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all capitalize ${
                    activeChart === key ? "bg-foreground text-background" : "text-foreground/40 hover:text-foreground"
                  }`}
                >
                  {key === "newLogins" ? "New Signups" : key}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.timeSeries}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--foreground) / 0.06)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => formatChartDate(v, charts.granularity)}
                  tick={{ fontSize: 10, fill: "hsl(var(--foreground) / 0.4)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--foreground) / 0.4)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => activeChart === "revenue" ? formatCurrency(v) : formatNumber(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--foreground) / 0.1)",
                    borderRadius: "12px",
                    fontSize: "11px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  }}
                  labelFormatter={(v) => formatChartDate(v as string, charts.granularity)}
                  formatter={(value: any) =>
                    activeChart === "revenue" ? [formatCurrency(value), "Revenue"]
                    : activeChart === "conversion" ? [`${value}%`, "Conversion"]
                    : activeChart === "logins" ? [formatNumber(value), "Logins"]
                    : activeChart === "newLogins" ? [formatNumber(value), "New Signups"]
                    : [formatNumber(value), activeChart.charAt(0).toUpperCase() + activeChart.slice(1)]
                  }
                />
                <Area
                  type="monotone"
                  dataKey={
                    activeChart === "revenue" ? "revenue"
                    : activeChart === "orders" ? "orders"
                    : activeChart === "sessions" ? "sessions"
                    : activeChart === "logins" ? "logins"
                    : activeChart === "newLogins" ? "newLogins"
                    : "conversionRate"
                  }
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  fill="url(#chartGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--background))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      ) : null}

      {/* ─── Funnel + Real-time Row ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conversion Funnel */}
        <div className="lg:col-span-1">
          {funnelError && <SectionError message={funnelError} onRetry={fetchAll} />}
          {loading && !funnel ? (
            <div className="glass-card rounded-2xl border border-foreground/5 p-5 h-96 animate-pulse bg-foreground/[0.02]" />
          ) : funnel && funnel.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-foreground/5 p-5 h-full">
              <h2 className="text-sm font-semibold text-foreground/70 mb-5">Conversion Funnel</h2>
              <div className="space-y-2">
                {funnel.map((stage, i) => {
                  const maxSessions = funnel[0]?.sessions || 1;
                  const width = Math.max(20, (stage.sessions / maxSessions) * 100);
                  return (
                    <div key={stage.stage} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-foreground/60">
                          {FUNNEL_LABELS[stage.stage] || stage.stage}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold">{formatNumber(stage.sessions)}</span>
                          {i > 0 && (
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                              stage.conversionFromPrevious >= 50 ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"
                            }`}>
                              {stage.conversionFromPrevious}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-foreground/[0.04] rounded-lg h-7 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          className="h-full rounded-lg flex items-center justify-end pr-2"
                          style={{ backgroundColor: FUNNEL_COLORS[i] || FUNNEL_COLORS[0], opacity: 0.8 }}
                        >
                          {i > 0 && stage.dropOffCount > 0 && (
                            <span className="text-[9px] text-white/80 font-medium">
                              -{formatNumber(stage.dropOffCount)}
                            </span>
                          )}
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
        </div>

        {/* Real-time Activity & 3D Globe */}
        <div className="lg:col-span-2">
          {realtime?.error && <SectionError message={realtime.error} onRetry={fetchAll} />}
          {loading && !realtime ? (
            <div className="glass-card rounded-2xl border border-foreground/5 p-5 h-96 animate-pulse bg-foreground/[0.02]" />
          ) : realtime ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-foreground/5 p-5 flex flex-col justify-between">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                {/* Left Column: Metrics, Pages & Top Ranked Lists */}
                <div className="flex flex-col justify-between h-full space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <h2 className="text-sm font-semibold text-foreground/70">Real-Time Activity</h2>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 mb-4">
                      <div className="text-center p-2.5 rounded-xl bg-foreground/[0.03] border border-foreground/5">
                        <div className="text-lg font-bold">{realtime.summary.totalActive}</div>
                        <div className="text-[9px] text-foreground/40 font-medium uppercase mt-0.5">Active Now</div>
                      </div>
                      <div className="text-center p-2.5 rounded-xl bg-foreground/[0.03] border border-foreground/5">
                        <div className="text-lg font-bold">{realtime.summary.newVisitors}</div>
                        <div className="text-[9px] text-foreground/40 font-medium uppercase mt-0.5">New</div>
                      </div>
                      <div className="text-center p-2.5 rounded-xl bg-foreground/[0.03] border border-foreground/5">
                        <div className="text-lg font-bold">{realtime.summary.returningVisitors}</div>
                        <div className="text-[9px] text-foreground/40 font-medium uppercase mt-0.5">Returning</div>
                      </div>
                    </div>

                    {/* Active Pages */}
                    <h3 className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider mb-1.5">Active Pages</h3>
                    <div className="space-y-1 max-h-[100px] overflow-y-auto mb-4 pr-1 custom-scrollbar">
                      {realtime.topPages.slice(0, 5).map((page, i) => (
                        <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-foreground/[0.03] transition-colors">
                          <span className="text-[11px] text-foreground/60 truncate max-w-[180px]">{page.page}</span>
                          <span className="text-[11px] font-semibold">{page.count}</span>
                        </div>
                      ))}
                      {realtime.topPages.length === 0 && (
                        <div className="text-center py-4 text-foreground/20 text-xs">No active visitors</div>
                      )}
                    </div>
                  </div>

                  {/* Realtime Top Countries & Cities */}
                  <div className="pt-3 border-t border-foreground/5 grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <MapPin className="w-3 h-3 text-indigo-400" />
                        <h3 className="text-[10px] font-semibold text-foreground/50 uppercase tracking-wider">Active Countries</h3>
                      </div>
                      <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1 custom-scrollbar">
                        {realtimeTopCountries.slice(0, 4).map((c) => (
                          <div key={c.code} className="space-y-0.5">
                            <div className="flex justify-between text-[10px] font-medium">
                              <span className="text-foreground/70 truncate max-w-[80px]">{c.name}</span>
                              <span className="text-foreground/40">{c.count} ({c.share}%)</span>
                            </div>
                            <div className="h-1 bg-foreground/[0.04] rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.max(c.share, 4)}%` }} />
                            </div>
                          </div>
                        ))}
                        {realtimeTopCountries.length === 0 && (
                          <div className="text-[10px] text-foreground/30 py-2 text-center">No active visitors</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Building2 className="w-3 h-3 text-purple-400" />
                        <h3 className="text-[10px] font-semibold text-foreground/50 uppercase tracking-wider">Active Cities</h3>
                      </div>
                      <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1 custom-scrollbar">
                        {realtimeTopCities.slice(0, 4).map((c) => (
                          <div key={`${c.city}-${c.country}`} className="space-y-0.5">
                            <div className="flex justify-between text-[10px] font-medium">
                              <span className="text-foreground/70 truncate max-w-[80px]">{c.city}</span>
                              <span className="text-foreground/40">{c.count} ({c.share}%)</span>
                            </div>
                            <div className="h-1 bg-foreground/[0.04] rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.max(c.share, 4)}%` }} />
                            </div>
                          </div>
                        ))}
                        {realtimeTopCities.length === 0 && (
                          <div className="text-[10px] text-foreground/30 py-2 text-center">No active visitors</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Dynamic 3D Earth Globe for Real-time Activity */}
                <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-foreground/5 pt-4 md:pt-0 md:pl-4 min-h-[300px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <GlobeIcon className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">Live Geo Tracking</span>
                  </div>
                  <Globe3D
                    points={realtime.visitorPoints || []}
                    countries={realtime.breakdowns?.country || {}}
                    unknownCount={realtime.unknownCount || 0}
                  />
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      {/* ─── Orders & Payments Row ───────────────────────── */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Order Status Breakdown */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-foreground/5 p-5">
            <h2 className="text-sm font-semibold text-foreground/70 mb-4">Order Status</h2>
            <div className="grid grid-cols-2 gap-2">
              {overview.orders.statusBreakdown.map((s) => (
                <div key={s.status} className="flex items-center justify-between p-3 rounded-xl bg-foreground/[0.03] border border-foreground/5">
                  <span className="text-[11px] text-foreground/50 capitalize">{s.status.replace(/_/g, " ")}</span>
                  <span className="text-sm font-bold">{s.count}</span>
                </div>
              ))}
              {overview.orders.statusBreakdown.length === 0 && (
                <div className="col-span-2 text-center py-6 text-foreground/20 text-xs">No orders in period</div>
              )}
            </div>
          </motion.div>

          {/* Payment Methods */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-foreground/5 p-5">
            <h2 className="text-sm font-semibold text-foreground/70 mb-4">Payment Methods</h2>
            <div className="space-y-2">
              {overview.orders.paymentBreakdown.map((p) => (
                <div key={p.method} className="flex items-center justify-between p-3 rounded-xl bg-foreground/[0.03] border border-foreground/5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-foreground/30" />
                    <span className="text-[11px] font-medium text-foreground/60 capitalize">{p.method || "Other"}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{formatCurrency(p.revenue)}</div>
                    <div className="text-[9px] text-foreground/30">{p.count} orders</div>
                  </div>
                </div>
              ))}
              {overview.orders.paymentBreakdown.length === 0 && (
                <div className="text-center py-6 text-foreground/20 text-xs">No payment data</div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Traffic Sources ─────────────────────────────── */}
      {trafficError && <SectionError message={trafficError} onRetry={fetchAll} />}
      {traffic && traffic.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-foreground/5 p-5">
          <h2 className="text-sm font-semibold text-foreground/70 mb-4">Traffic Sources</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-foreground/40 uppercase tracking-wider border-b border-foreground/5">
                  <th className="text-left py-2 pr-4 font-semibold">Source</th>
                  <th className="text-right py-2 px-2 font-semibold">Sessions</th>
                  <th className="text-right py-2 px-2 font-semibold">Carts</th>
                  <th className="text-right py-2 px-2 font-semibold">Checkouts</th>
                  <th className="text-right py-2 px-2 font-semibold">Orders</th>
                  <th className="text-right py-2 px-2 font-semibold">Revenue</th>
                  <th className="text-right py-2 pl-2 font-semibold">CVR</th>
                </tr>
              </thead>
              <tbody>
                {traffic.slice(0, 15).map((src, i) => (
                  <tr key={i} className="border-b border-foreground/[0.03] hover:bg-foreground/[0.02] transition-colors">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <GlobeIcon className="w-3 h-3 text-foreground/20" />
                        <span className="font-medium text-foreground/70">{src.source}</span>
                        {src.medium && <span className="text-foreground/30">/ {src.medium}</span>}
                      </div>
                    </td>
                    <td className="text-right py-2.5 px-2 font-semibold">{formatNumber(src.sessions)}</td>
                    <td className="text-right py-2.5 px-2">{src.addToCart}</td>
                    <td className="text-right py-2.5 px-2">{src.checkouts}</td>
                    <td className="text-right py-2.5 px-2 font-semibold">{src.orders}</td>
                    <td className="text-right py-2.5 px-2 font-semibold">{formatCurrency(src.revenue)}</td>
                    <td className="text-right py-2.5 pl-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        src.conversionRate > 2 ? "text-emerald-500 bg-emerald-500/10" : "text-foreground/40 bg-foreground/5"
                      }`}>
                        {src.conversionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ─── Platform Split ──────────────────────────────── */}
      {overview && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-foreground/5 p-5">
          <h2 className="text-sm font-semibold text-foreground/70 mb-4">Web vs App Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["web", "app"] as const).map((p) => {
              const data = overview.platformSplit[p];
              const icon = p === "web" ? Monitor : Smartphone;
              const Icon = icon;
              return (
                <div key={p} className="p-5 rounded-2xl bg-gradient-to-br from-foreground/[0.01] to-foreground/[0.02] border border-foreground/5 hover:border-foreground/10 transition-colors">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded-lg bg-foreground/[0.03]">
                      <Icon className="w-4 h-4 text-foreground/60" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">{p === "web" ? "Webstore" : "Mobile App"}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xl font-bold tracking-tight">{formatNumber(data.orders)}</div>
                      <div className="text-[9px] text-foreground/30 uppercase font-semibold mt-0.5">Orders</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold tracking-tight">{formatCurrency(data.revenue)}</div>
                      <div className="text-[9px] text-foreground/30 uppercase font-semibold mt-0.5">Revenue</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold tracking-tight">{formatNumber(data.sessions)}</div>
                      <div className="text-[9px] text-foreground/30 uppercase font-semibold mt-0.5">Sessions</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold tracking-tight">{formatNumber(data.visitors || 0)}</div>
                      <div className="text-[9px] text-foreground/30 uppercase font-semibold mt-0.5">Visitors</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ─── Cart Analytics Summary ──────────────────────── */}
      {overview && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-foreground/5 p-5">
          <h2 className="text-sm font-semibold text-foreground/70 mb-4">Cart Performance</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total Carts", value: overview.carts.total },
              { label: "Active", value: overview.carts.active },
              { label: "Abandoned", value: overview.carts.abandoned },
              { label: "Converted", value: overview.carts.converted },
              { label: "Abandonment Rate", value: `${overview.carts.abandonmentRate}%` },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-foreground/[0.03] border border-foreground/5 text-center">
                <div className="text-lg font-bold">{typeof item.value === "number" ? formatNumber(item.value) : item.value}</div>
                <div className="text-[9px] text-foreground/30 uppercase mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Customer Breakdown ──────────────────────────── */}
      {overview && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-foreground/5 p-5">
          <h2 className="text-sm font-semibold text-foreground/70 mb-4">Customer Analytics</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-foreground/[0.03] border border-foreground/5">
              <div className="text-2xl font-bold">{formatNumber(overview.customers.total)}</div>
              <div className="text-[10px] text-foreground/40 uppercase mt-1">Total Customers</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="text-2xl font-bold text-emerald-500">{formatNumber(overview.customers.new)}</div>
              <div className="text-[10px] text-foreground/40 uppercase mt-1">New Customers</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
              <div className="text-2xl font-bold text-indigo-500">{formatNumber(overview.customers.returning)}</div>
              <div className="text-[10px] text-foreground/40 uppercase mt-1">Returning</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Empty state ─────────────────────────────────── */}
      {!loading && !overview && (
        <div className="text-center py-20">
          <BarChart3 className="w-12 h-12 mx-auto text-foreground/10 mb-4" />
          <h3 className="text-lg font-semibold text-foreground/40">No analytics data yet</h3>
          <p className="text-sm text-foreground/20 mt-1">Analytics events will appear here as visitors browse the store</p>
        </div>
      )}
    </div>
  );
}
