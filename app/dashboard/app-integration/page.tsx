"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  Smartphone, Wifi, WifiOff, CheckCircle, XCircle, RefreshCw, Loader2,
  ShoppingBag, Users, Package, ShoppingCart, Globe, Zap, Database,
  ArrowRight, Activity, Server, Code, Eye, Settings, Link2, BarChart3,
  Image as ImageIcon, Undo2, ArrowLeftRight, FileText, User, Layers,
  Monitor, Heart, Palette, Navigation, MessageCircle, Shield, Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface EndpointStatus {
  name: string;
  path: string;
  method: string;
  status: 'ok' | 'error' | 'loading';
  responseTime?: number;
  dataCount?: number;
  icon: any;
}

interface SyncStats {
  productsCount: number;
  collectionsCount: number;
  customersCount: number;
  ordersCount: number;
  returnsCount: number;
  exchangesCount: number;
  lastChecked: string;
}

type SettingsTab = 'hero' | 'sections' | 'pdp' | 'social' | 'collections' | 'community' | 'advanced';

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`glass-card rounded-[2rem] overflow-hidden relative z-10 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function StatBlock({ icon: Icon, label, value, sublabel }: { icon: any; label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="flex items-center gap-5 px-8 py-7 border-b border-foreground/5 last:border-0 group/stat hover:bg-foreground/[0.02] transition-all duration-500">
      <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center text-foreground/30 border border-foreground/5 group-hover/stat:bg-foreground group-hover/stat:text-background transition-all duration-700 shadow-xl">
        <Icon className="w-5 h-5" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[22px] font-bold text-foreground tracking-tight leading-none mb-1.5">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/25">{label}</div>
      </div>
      {sublabel && (
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/15 hidden md:block">{sublabel}</span>
      )}
    </div>
  );
}

function EndpointRow({ ep }: { ep: EndpointStatus }) {
  const Icon = ep.icon;
  return (
    <div className="flex items-center gap-5 px-8 py-5 border-b border-foreground/5 last:border-0 group/row hover:bg-foreground/[0.02] transition-all duration-500">
      <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground/30 border border-foreground/5 group-hover/row:bg-foreground group-hover/row:text-background transition-all duration-700">
        <Icon className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            ep.method === 'GET' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
          }`}>{ep.method}</span>
          <span className="text-[13px] font-bold text-foreground/80">{ep.name}</span>
        </div>
        <div className="text-[10px] font-mono text-foreground/25 tracking-tight truncate">{ep.path}</div>
      </div>
      <div className="flex items-center gap-3">
        {ep.responseTime !== undefined && (
          <span className="text-[10px] font-bold font-mono text-foreground/25">{ep.responseTime}ms</span>
        )}
        {ep.dataCount !== undefined && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/15 bg-foreground/5 px-2.5 py-1 rounded-lg">
            {ep.dataCount} items
          </span>
        )}
        {ep.status === 'loading' ? (
          <Loader2 className="w-4 h-4 text-foreground/25 animate-spin" />
        ) : ep.status === 'ok' ? (
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
      </div>
    </div>
  );
}

function SettingsInput({ label, value, onChange, placeholder, mono, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/60 mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all ${mono ? 'font-mono' : ''}`}
        placeholder={placeholder}
      />
      {hint && <p className="text-[10px] text-foreground/30 mt-1.5 ml-1">{hint}</p>}
    </div>
  );
}

function SettingsToggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 rounded accent-foreground" />
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/60">{label}</span>
    </label>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <h4 className="flex items-center gap-2 text-[12px] font-bold text-foreground/80 uppercase tracking-widest mb-6 pb-2 border-b border-foreground/5">
      <Icon className="w-4 h-4" /> {title}
    </h4>
  );
}

export default function AppIntegrationPage() {
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([
    { name: 'Products', path: '/api/app/products', method: 'GET', status: 'loading', icon: ShoppingBag },
    { name: 'Collections', path: '/api/app/collections', method: 'GET', status: 'loading', icon: Package },
    { name: 'Search', path: '/api/app/search?q=test', method: 'GET', status: 'loading', icon: Globe },
    { name: 'App Config', path: '/api/app/config', method: 'GET', status: 'loading', icon: Settings },
    { name: 'Customers', path: '/api/app/customers?all=true&limit=5', method: 'GET', status: 'loading', icon: Users },
    { name: 'Cart', path: '/api/app/cart?cartId=test', method: 'GET', status: 'loading', icon: ShoppingCart },
    { name: 'Orders', path: '/api/app/orders?count=true', method: 'GET', status: 'loading', icon: FileText },
    { name: 'Profile', path: '/api/app/profile?customerId=test', method: 'GET', status: 'loading', icon: User },
    { name: 'Returns', path: '/api/app/returns?customerId=test', method: 'GET', status: 'loading', icon: Undo2 },
    { name: 'Exchanges', path: '/api/app/exchanges?customerId=test', method: 'GET', status: 'loading', icon: ArrowLeftRight },
    { name: 'Public Settings', path: '/api/app/settings', method: 'GET', status: 'loading', icon: Shield },
  ]);

  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [testing, setTesting] = useState(false);

  const [settings, setSettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('hero');

  const testEndpoints = useCallback(async () => {
    setTesting(true);
    const results = await Promise.all(
      endpoints.map(async (ep) => {
        const start = Date.now();
        try {
          const res = await fetch(ep.path);
          const elapsed = Date.now() - start;
          let count: number | undefined;
          try {
            const data = await res.json();
            if (data.products) count = data.products.length;
            else if (data.collections) count = data.collections.length;
            else if (data.customers) count = data.customers.length;
            else if (data.config) count = Object.keys(data.config).length;
            else if (data.returns) count = data.returns.length;
            else if (data.exchanges) count = data.exchanges.length;
            else if (data.total !== undefined) count = data.total;
            else if (data.orders) count = data.orders.length;
          } catch { /* non-json response is fine */ }

          return { ...ep, status: (res.ok || res.status < 500) ? 'ok' as const : 'error' as const, responseTime: elapsed, dataCount: count };
        } catch {
          return { ...ep, status: 'error' as const, responseTime: Date.now() - start };
        }
      })
    );
    setEndpoints(results);
    setTesting(false);
  }, []);

  const fetchSyncStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [products, collections, customers, orders, returns, exchanges] = await Promise.all([
        fetch('/api/app/products?limit=250').then(r => r.json()).catch(() => ({ products: [] })),
        fetch('/api/app/collections?all=true').then(r => r.json()).catch(() => ({ collections: [] })),
        fetch('/api/admin/customers?limit=1').then(r => r.json()).catch(() => ({ total: 0 })),
        fetch('/api/app/orders?count=true').then(r => r.json()).catch(() => ({ total: 0 })),
        fetch('/api/admin/returns').then(r => r.json()).catch(() => ({ summary: { total: 0 } })),
        fetch('/api/admin/exchanges').then(r => r.json()).catch(() => ({ summary: { total: 0 } })),
      ]);

      setSyncStats({
        productsCount: products.products?.length || 0,
        collectionsCount: collections.collections?.length || 0,
        customersCount: customers.total || 0,
        ordersCount: orders.total || 0,
        returnsCount: returns.summary?.total || 0,
        exchangesCount: exchanges.summary?.total || 0,
        lastChecked: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error('Error fetching sync stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }, []);

  useEffect(() => {
    testEndpoints();
    fetchSyncStats();
    fetchSettings();
  }, [testEndpoints, fetchSyncStats, fetchSettings]);

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    setSaveStatus('idle');
    setSaveMessage('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: settings.id,
          ...settings,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveStatus('success');
        setSaveMessage('Settings saved — app will update within 10 seconds');
        testEndpoints();
      } else {
        setSaveStatus('error');
        setSaveMessage(data.error || 'Failed to save settings.');
      }
    } catch (err: any) {
      setSaveStatus('error');
      setSaveMessage(`Save failed: ${err.message}`);
    } finally {
      setSavingSettings(false);
      setTimeout(() => { setSaveStatus('idle'); setSaveMessage(''); }, 4000);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const allHealthy = endpoints.every(ep => ep.status === 'ok');
  const healthyCount = endpoints.filter(e => e.status === 'ok').length;
  const avgResponse = endpoints.filter(ep => ep.responseTime).reduce((sum, ep) => sum + (ep.responseTime || 0), 0) / (endpoints.filter(ep => ep.responseTime).length || 1);

  const tabs: { key: SettingsTab; label: string; icon: any }[] = [
    { key: 'hero', label: 'Hero', icon: Smartphone },
    { key: 'sections', label: 'Sections', icon: Layers },
    { key: 'pdp', label: 'Product Page', icon: Eye },
    { key: 'social', label: 'Social', icon: Globe },
    { key: 'collections', label: 'Collections', icon: Package },
    { key: 'community', label: 'Community', icon: MessageCircle },
    { key: 'advanced', label: 'Advanced', icon: Settings },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-5xl mx-auto space-y-10 pb-20 relative z-10"
    >

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 px-4 pt-10 mb-16 relative z-10">
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-foreground/5 flex items-center justify-center text-foreground/30 border border-foreground/5 shadow-2xl">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground uppercase tracking-tighter leading-none">
                App Integration
              </h1>
              <p className="text-[11px] text-foreground/30 font-bold uppercase tracking-[0.4em] mt-2">
                React Native API Connectivity
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => { testEndpoints(); fetchSyncStats(); }}
          disabled={testing}
          className="flex items-center justify-center gap-3 px-8 py-3 rounded-2xl text-[10px] font-bold tracking-[0.3em] uppercase bg-foreground text-background shadow-xl shadow-foreground/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} strokeWidth={2.5} />
          {testing ? 'Testing...' : 'Run Health Check'}
        </button>
      </div>

      {/* Connection Status Banner */}
      <GlassCard>
        <div className="flex items-center gap-6 px-10 py-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl border transition-all duration-700 ${
            allHealthy
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
          }`}>
            {allHealthy ? <Wifi className="w-7 h-7" /> : <WifiOff className="w-7 h-7" />}
          </div>
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-foreground tracking-tight leading-none mb-2">
              {allHealthy ? 'All Systems Operational' : 'Some Endpoints Unreachable'}
            </h2>
            <p className="text-[11px] text-foreground/30 font-medium">
              {healthyCount} of {endpoints.length} endpoints connected
              {avgResponse > 0 && ` · Avg response: ${Math.round(avgResponse)}ms`}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${allHealthy ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* API Endpoints */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 px-6 mb-5">
            <Server className="w-4 h-4 text-foreground/25" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] text-foreground/25">API Endpoints ({endpoints.length})</h3>
          </div>
          <GlassCard>
            {endpoints.map((ep, i) => (
              <EndpointRow key={i} ep={ep} />
            ))}
          </GlassCard>
        </div>

        {/* Database Sync Stats */}
        <div>
          <div className="flex items-center gap-3 px-6 mb-5">
            <Database className="w-4 h-4 text-foreground/25" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] text-foreground/25">Data Sync</h3>
          </div>
          <GlassCard>
            {loadingStats ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <Loader2 className="w-5 h-5 text-foreground/25 animate-spin" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-foreground/25">Syncing...</span>
              </div>
            ) : syncStats ? (
              <>
                <StatBlock icon={ShoppingBag} label="Products" value={syncStats.productsCount} sublabel="From Shopify" />
                <StatBlock icon={Package} label="Collections" value={syncStats.collectionsCount} sublabel="Active" />
                <StatBlock icon={Users} label="Customers" value={syncStats.customersCount} sublabel="Registered" />
                <StatBlock icon={FileText} label="Orders" value={syncStats.ordersCount} sublabel="Total" />
                <StatBlock icon={Undo2} label="Returns" value={syncStats.returnsCount} sublabel="Requests" />
                <StatBlock icon={ArrowLeftRight} label="Exchanges" value={syncStats.exchangesCount} sublabel="Requests" />
                <div className="px-8 py-4 border-t border-foreground/5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-foreground/15">
                    Last synced: {syncStats.lastChecked}
                  </span>
                </div>
              </>
            ) : (
              <div className="px-8 py-12 text-center text-foreground/25 text-sm">Unable to fetch sync data</div>
            )}
          </GlassCard>
        </div>

        {/* Proxy Configuration Info */}
        <div>
          <div className="flex items-center gap-3 px-6 mb-5">
            <Zap className="w-4 h-4 text-foreground/25" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] text-foreground/25">Proxy Configuration</h3>
          </div>
          <GlassCard>
            <div className="px-8 py-7 border-b border-foreground/5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-bold text-foreground/80">React Native App</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-lg">Connected</span>
              </div>
              <p className="text-[10px] text-foreground/25 font-medium leading-relaxed">
                The ZicaBella React Native app fetches all data through these API proxy endpoints.
                No Shopify credentials are exposed in the mobile app.
              </p>
            </div>
            <div className="px-8 py-5 border-b border-foreground/5 flex items-center justify-between">
              <div>
                <div className="text-[12px] font-bold text-foreground/60 mb-1">API Base URL</div>
                <div className="text-[10px] font-mono text-foreground/25">app.zicabella.com/api/app</div>
              </div>
              <Code className="w-4 h-4 text-foreground/15" />
            </div>
            <div className="px-8 py-5 border-b border-foreground/5 flex items-center justify-between">
              <div>
                <div className="text-[12px] font-bold text-foreground/60 mb-1">Auth Mode</div>
                <div className="text-[10px] font-mono text-foreground/25">Public (no token required)</div>
              </div>
              <Link2 className="w-4 h-4 text-foreground/15" />
            </div>
            <div className="px-8 py-5 border-b border-foreground/5 flex items-center justify-between">
              <div>
                <div className="text-[12px] font-bold text-foreground/60 mb-1">Config Cache TTL</div>
                <div className="text-[10px] font-mono text-foreground/25">10s server / 120s stale-while-revalidate</div>
              </div>
              <Clock className="w-4 h-4 text-foreground/15" />
            </div>
            <div className="px-8 py-5 flex items-center justify-between">
              <div>
                <div className="text-[12px] font-bold text-foreground/60 mb-1">Shopify Admin Token</div>
                <div className="text-[10px] font-mono text-foreground/25">Server-side only (secure)</div>
              </div>
              <Activity className="w-4 h-4 text-foreground/15" />
            </div>
          </GlassCard>
        </div>

        {/* Mobile App Settings Form */}
        <div className="lg:col-span-2 mt-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 mb-5">
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-foreground/25" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] text-foreground/25">Mobile App Content Settings</h3>
            </div>
            <div className="flex items-center gap-3">
              {saveStatus !== 'idle' && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-xl transition-all ${
                  saveStatus === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'
                }`}>
                  {saveMessage}
                </span>
              )}
              {settings && (
                <button
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="text-[10px] font-bold uppercase tracking-[0.3em] bg-foreground text-background px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-xl shadow-foreground/20"
                >
                  {savingSettings && <Loader2 className="w-3 h-3 animate-spin" />}
                  {savingSettings ? 'Saving...' : 'Save App Settings'}
                </button>
              )}
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex items-center gap-1 px-6 mb-5 overflow-x-auto pb-1">
            {tabs.map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSettingsTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] whitespace-nowrap transition-all ${
                    settingsTab === tab.key
                      ? 'bg-foreground text-background shadow-lg'
                      : 'text-foreground/40 hover:bg-foreground/5'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <GlassCard>
            {settings ? (
              <div className="p-8 space-y-6">

                {/* ── Hero Tab ── */}
                {settingsTab === 'hero' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <div className="md:col-span-2">
                      <SectionHeader icon={Smartphone} title="App Homepage Hero" />
                    </div>
                    <SettingsInput label="Hero Image URL" value={settings.heroImage || ''} onChange={v => updateSetting('heroImage', v)} placeholder="https://..." />
                    <SettingsInput label="Hero Video URL" value={settings.heroVideo || ''} onChange={v => updateSetting('heroVideo', v)} placeholder="https://..." />
                    <SettingsInput label="Hero Title" value={settings.heroTitle || ''} onChange={v => updateSetting('heroTitle', v)} placeholder="ZICA BELLA" />
                    <SettingsInput label="Hero Subtitle" value={settings.heroSubtitle || ''} onChange={v => updateSetting('heroSubtitle', v)} placeholder="Enter subtitle..." />
                    <SettingsInput label="Hero Button Text" value={settings.heroButtonText || ''} onChange={v => updateSetting('heroButtonText', v)} placeholder="Discover" />
                    <div className="flex items-end">
                      <SettingsToggle label="Show Hero Text Overlay" checked={settings.showHeroText ?? false} onChange={v => updateSetting('showHeroText', v)} />
                    </div>
                  </div>
                )}

                {/* ── Sections Tab ── */}
                {settingsTab === 'sections' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    {/* Spotlight */}
                    <div className="md:col-span-2">
                      <SectionHeader icon={Eye} title="Spotlight Section" />
                    </div>
                    <SettingsInput label="Spotlight Title" value={settings.spotlightTitle || ''} onChange={v => updateSetting('spotlightTitle', v)} placeholder="AUTHENTIC STREETWEAR" />
                    <SettingsInput label="Spotlight Subtitle" value={settings.spotlightSubtitle || ''} onChange={v => updateSetting('spotlightSubtitle', v)} placeholder="Luxury Indian streetwear..." />
                    <SettingsInput label="Spotlight Collection Handle" value={settings.spotlightCollection || ''} onChange={v => updateSetting('spotlightCollection', v)} placeholder="tshirts" mono hint="The collection handle for the spotlight grid" />
                    <SettingsInput label="Spotlight Products (JSON)" value={settings.spotlightProducts || ''} onChange={v => updateSetting('spotlightProducts', v)} placeholder='["handle1","handle2"]' mono />

                    {/* Flipbook */}
                    <div className="md:col-span-2 pt-6">
                      <SectionHeader icon={ImageIcon} title="Flipbook Section" />
                    </div>
                    <SettingsInput label="Flipbook Image URL" value={settings.flipbookImage || ''} onChange={v => updateSetting('flipbookImage', v)} placeholder="https://..." />
                    <SettingsInput label="Flipbook Video URL" value={settings.flipbookVideo || ''} onChange={v => updateSetting('flipbookVideo', v)} placeholder="https://..." />
                    <SettingsInput label="Flipbook Title" value={settings.flipbookTitle || ''} onChange={v => updateSetting('flipbookTitle', v)} placeholder="Archival Vision" />
                    <SettingsInput label="Flipbook Tag" value={settings.flipbookTag || ''} onChange={v => updateSetting('flipbookTag', v)} placeholder="Core Manifest" />
                    <div className="md:col-span-2">
                      <SettingsInput label="Flipbook Description" value={settings.flipbookDesc || ''} onChange={v => updateSetting('flipbookDesc', v)} placeholder="Engineered for those..." />
                    </div>
                    <SettingsInput label="Flipbook Config (JSON)" value={settings.flipbookConfig || ''} onChange={v => updateSetting('flipbookConfig', v)} placeholder='[{"image":"...","title":"..."}]' mono />

                    {/* Latest Curation */}
                    <div className="md:col-span-2 pt-6">
                      <SectionHeader icon={Heart} title="Latest Curation" />
                    </div>
                    <SettingsInput label="Title" value={settings.latestCurationTitle || ''} onChange={v => updateSetting('latestCurationTitle', v)} placeholder="Latest curation" />
                    <SettingsInput label="Subtitle" value={settings.latestCurationSubtitle || ''} onChange={v => updateSetting('latestCurationSubtitle', v)} placeholder="Season Drop" />
                    <SettingsToggle label="Show Latest Curation" checked={settings.showLatestCuration ?? true} onChange={v => updateSetting('showLatestCuration', v)} />

                    {/* Archive */}
                    <div className="md:col-span-2 pt-6">
                      <SectionHeader icon={Layers} title="Archive Section" />
                    </div>
                    <SettingsInput label="Archive Title" value={settings.archiveTitle || ''} onChange={v => updateSetting('archiveTitle', v)} placeholder="The Archive" />
                    <SettingsInput label="Archive Subtitle" value={settings.archiveSubtitle || ''} onChange={v => updateSetting('archiveSubtitle', v)} placeholder="Organic Evolution" />
                    <SettingsToggle label="Show Archive" checked={settings.showArchive ?? true} onChange={v => updateSetting('showArchive', v)} />

                    {/* Blueprint */}
                    <div className="md:col-span-2 pt-6">
                      <SectionHeader icon={Palette} title="Blueprint Section" />
                    </div>
                    <SettingsInput label="Blueprint Title" value={settings.blueprintTitle || ''} onChange={v => updateSetting('blueprintTitle', v)} placeholder="The blueprint of Zica Bella" />
                    <SettingsInput label="Blueprint Subtitle" value={settings.blueprintSubtitle || ''} onChange={v => updateSetting('blueprintSubtitle', v)} placeholder="Technique & Motion" />
                    <SettingsToggle label="Show Blueprint" checked={settings.showBlueprint ?? true} onChange={v => updateSetting('showBlueprint', v)} />

                    {/* Kinetic Mesh */}
                    <div className="md:col-span-2 pt-6">
                      <SectionHeader icon={Zap} title="Kinetic Mesh" />
                    </div>
                    <SettingsInput label="Title" value={settings.kineticMeshTitle || ''} onChange={v => updateSetting('kineticMeshTitle', v)} placeholder="ARCHIVE EDITION" />
                    <SettingsInput label="Products (JSON)" value={settings.kineticMeshProducts || ''} onChange={v => updateSetting('kineticMeshProducts', v)} placeholder='["handle1"]' mono />

                    {/* Ring Carousel */}
                    <div className="md:col-span-2 pt-6">
                      <SectionHeader icon={BarChart3} title="Ring Carousel" />
                    </div>
                    <SettingsInput label="Ring Carousel Title" value={settings.ringCarouselTitle || ''} onChange={v => updateSetting('ringCarouselTitle', v)} placeholder="RING COLLECTION" />
                    <SettingsInput label="Ring Carousel Items (JSON)" value={settings.ringCarouselItems || ''} onChange={v => updateSetting('ringCarouselItems', v)} placeholder='["ring1","ring2"]' mono />
                    <SettingsToggle label="Show Ring Carousel" checked={settings.showRingCarousel ?? true} onChange={v => updateSetting('showRingCarousel', v)} />

                    {/* Media */}
                    <div className="md:col-span-2 pt-6">
                      <SectionHeader icon={ImageIcon} title="Media Assets" />
                    </div>
                    <SettingsInput label="Featured Media URL" value={settings.featuredMedia || ''} onChange={v => updateSetting('featuredMedia', v)} placeholder="https://..." />
                    <SettingsInput label="Featured Media Image" value={settings.featuredMediaImage || ''} onChange={v => updateSetting('featuredMediaImage', v)} placeholder="https://..." />
                    <SettingsInput label="Collections Media" value={settings.collectionsMedia || ''} onChange={v => updateSetting('collectionsMedia', v)} placeholder="https://..." />
                    <SettingsInput label="Footer Video URL" value={settings.footerVideo || ''} onChange={v => updateSetting('footerVideo', v)} placeholder="https://..." />
                    <SettingsToggle label="Show Tree Text" checked={settings.showTreeText ?? true} onChange={v => updateSetting('showTreeText', v)} />
                  </div>
                )}

                {/* ── PDP Tab ── */}
                {settingsTab === 'pdp' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <div className="md:col-span-2">
                      <SectionHeader icon={Eye} title="Product Detail Page" />
                    </div>
                    <SettingsInput label="PDP Background URL" value={settings.pdpBackground || ''} onChange={v => updateSetting('pdpBackground', v)} placeholder="https://..." />
                    <div />
                    <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <SettingsToggle label="Product Video" checked={settings.showProductVideo ?? true} onChange={v => updateSetting('showProductVideo', v)} />
                      <SettingsToggle label="Size Chart" checked={settings.showSizeChart ?? true} onChange={v => updateSetting('showSizeChart', v)} />
                      <SettingsToggle label="Brand Section" checked={settings.showBrand ?? true} onChange={v => updateSetting('showBrand', v)} />
                      <SettingsToggle label="Shipping & Returns" checked={settings.showShippingReturn ?? true} onChange={v => updateSetting('showShippingReturn', v)} />
                      <SettingsToggle label="Product Details" checked={settings.showDetails ?? true} onChange={v => updateSetting('showDetails', v)} />
                      <SettingsToggle label="Care Instructions" checked={settings.showCare ?? true} onChange={v => updateSetting('showCare', v)} />
                      <SettingsToggle label="Size & Fit" checked={settings.showSizeFit ?? true} onChange={v => updateSetting('showSizeFit', v)} />
                    </div>
                  </div>
                )}

                {/* ── Social Tab ── */}
                {settingsTab === 'social' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <div className="md:col-span-2">
                      <SectionHeader icon={Globe} title="Social Links" />
                    </div>
                    <SettingsInput label="Instagram URL" value={settings.instagramUrl || ''} onChange={v => updateSetting('instagramUrl', v)} placeholder="https://instagram.com/..." />
                    <SettingsInput label="YouTube URL" value={settings.youtubeUrl || ''} onChange={v => updateSetting('youtubeUrl', v)} placeholder="https://youtube.com/..." />
                    <SettingsInput label="Spotify URL" value={settings.spotifyUrl || ''} onChange={v => updateSetting('spotifyUrl', v)} placeholder="https://spotify.com/..." />
                    <SettingsInput label="Apple Music URL" value={settings.appleUrl || ''} onChange={v => updateSetting('appleUrl', v)} placeholder="https://music.apple.com/..." />
                  </div>
                )}

                {/* ── Collections Tab ── */}
                {settingsTab === 'collections' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <div className="md:col-span-2">
                      <SectionHeader icon={Package} title="Collections & Navigation" />
                    </div>
                    <SettingsInput label="Header Collections (JSON)" value={settings.enabledCollectionsHeader || ''} onChange={v => updateSetting('enabledCollectionsHeader', v)} placeholder='["tshirts","hoodies"]' mono hint="Collections shown in the app header" />
                    <SettingsInput label="Page Collections (JSON)" value={settings.enabledCollectionsPage || ''} onChange={v => updateSetting('enabledCollectionsPage', v)} placeholder='["tshirts","hoodies"]' mono hint="Collections shown on the homepage scroll" />
                    <SettingsInput label="Menu Collections (JSON)" value={settings.enabledCollectionsMenu || ''} onChange={v => updateSetting('enabledCollectionsMenu', v)} placeholder='["accessories","rings"]' mono hint="Collections shown in the Explore/Search tabs" />
                    <div />
                    <div className="md:col-span-2 pt-4">
                      <SectionHeader icon={Navigation} title="Menu Handles" />
                    </div>
                    <SettingsInput label="Main Menu Handle" value={settings.mainMenuHandle || ''} onChange={v => updateSetting('mainMenuHandle', v)} placeholder="main-menu" mono />
                    <SettingsInput label="Secondary Menu Handle" value={settings.secondaryMenuHandle || ''} onChange={v => updateSetting('secondaryMenuHandle', v)} placeholder="footer-menu" mono />
                  </div>
                )}

                {/* ── Community Tab ── */}
                {settingsTab === 'community' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <div className="md:col-span-2">
                      <SectionHeader icon={Users} title="Community Section" />
                    </div>
                    <SettingsInput label="Community Title" value={settings.communityTitle || ''} onChange={v => updateSetting('communityTitle', v)} placeholder="Featured Looks" />
                    <SettingsInput label="Community Subtitle" value={settings.communitySubtitle || ''} onChange={v => updateSetting('communitySubtitle', v)} placeholder="Community" />
                    <SettingsToggle label="Show Community" checked={settings.showCommunity ?? true} onChange={v => updateSetting('showCommunity', v)} />
                    <div />
                    <div className="md:col-span-2 pt-4">
                      <SectionHeader icon={Shield} title="Community Rules" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/60 mb-2">Minimum Orders to Join</label>
                      <input
                        type="number"
                        min={0}
                        value={settings.communityMinOrders ?? 1}
                        onChange={e => updateSetting('communityMinOrders', parseInt(e.target.value) || 0)}
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-4 justify-end">
                      <SettingsToggle label="Age Restricted" checked={settings.communityAgeRestricted ?? true} onChange={v => updateSetting('communityAgeRestricted', v)} />
                      <SettingsToggle label="WhatsApp Enabled" checked={settings.communityWhatsAppEnabled ?? true} onChange={v => updateSetting('communityWhatsAppEnabled', v)} />
                    </div>
                    <div className="md:col-span-2 pt-4">
                      <SectionHeader icon={MessageCircle} title="Chat Settings" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/60 mb-2">Chat Access Mode</label>
                      <select
                        value={settings.chatAccessMode || 'open'}
                        onChange={e => updateSetting('chatAccessMode', e.target.value)}
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
                      >
                        <option value="open">Open</option>
                        <option value="members">Members Only</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* ── Advanced Tab ── */}
                {settingsTab === 'advanced' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <div className="md:col-span-2">
                      <SectionHeader icon={Settings} title="Advanced Configuration" />
                      <p className="text-[10px] text-foreground/30 -mt-4 mb-6">These settings control server-side API keys and integrations. Changes here directly affect payment processing and logistics.</p>
                    </div>
                    <SettingsInput label="Shopify Domain" value={settings.shopDomain || ''} onChange={v => updateSetting('shopDomain', v)} placeholder="store.myshopify.com" mono />
                    <SettingsInput label="Webhook Secret" value={settings.webhookSecret || ''} onChange={v => updateSetting('webhookSecret', v)} placeholder="whsec_..." mono />
                    <SettingsInput label="Delhivery API Key" value={settings.delhiveryApiKey || ''} onChange={v => updateSetting('delhiveryApiKey', v)} placeholder="API key..." mono />
                    <SettingsInput label="Shiprocket Email" value={settings.shiprocketEmail || ''} onChange={v => updateSetting('shiprocketEmail', v)} placeholder="email@..." />
                    <SettingsInput label="Shiprocket Token" value={settings.shiprocketToken || ''} onChange={v => updateSetting('shiprocketToken', v)} placeholder="Token..." mono />
                    <SettingsInput label="Razorpay Key ID" value={settings.razorpayKeyId || ''} onChange={v => updateSetting('razorpayKeyId', v)} placeholder="rzp_..." mono />
                    <SettingsInput label="Razorpay Key Secret" value={settings.razorpayKeySecret || ''} onChange={v => updateSetting('razorpayKeySecret', v)} placeholder="Secret..." mono />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-10 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-6 h-6 text-foreground/20 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/30">Loading App Settings...</span>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Integration Reference */}
      <div>
        <div className="flex items-center gap-3 px-6 mb-5">
          <Code className="w-4 h-4 text-foreground/25" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] text-foreground/25">Integration Reference</h3>
        </div>
        <GlassCard>
          <div className="px-8 py-6 space-y-4">
            <p className="text-[11px] text-foreground/30 font-medium leading-relaxed">
              The React Native app communicates exclusively through these proxy endpoints. All Shopify API tokens remain server-side.
            </p>
            <div className="space-y-2">
              {[
                { method: 'GET', path: '/api/app/products', desc: 'List all products (supports ?collection=handle&limit=24)' },
                { method: 'GET', path: '/api/app/products/:handle', desc: 'Single product with metafields' },
                { method: 'GET', path: '/api/app/collections', desc: 'List collections (supports ?location=header|page|menu)' },
                { method: 'GET', path: '/api/app/collections/:handle', desc: 'Collection with products' },
                { method: 'GET', path: '/api/app/search?q=...', desc: 'Search products' },
                { method: 'GET', path: '/api/app/orders?customerId=...', desc: 'Customer orders with returns/exchanges' },
                { method: 'GET', path: '/api/app/orders?count=true', desc: 'Quick order count for dashboard' },
                { method: 'GET', path: '/api/app/customers?phone=...', desc: 'Customer lookup' },
                { method: 'GET', path: '/api/app/profile?customerId=...', desc: 'Customer profile with community' },
                { method: 'GET', path: '/api/app/config', desc: 'App settings & section config (10s cache)' },
                { method: 'GET', path: '/api/app/settings', desc: 'Public settings (excludes sensitive keys)' },
                { method: 'GET', path: '/api/app/returns?customerId=...', desc: 'Customer return requests' },
                { method: 'GET', path: '/api/app/exchanges?customerId=...', desc: 'Customer exchange requests' },
                { method: 'POST', path: '/api/app/orders/return', desc: 'Submit return/exchange request' },
                { method: 'POST', path: '/api/app/cart', desc: 'Cart operations (create, add, remove, update)' },
                { method: 'PATCH', path: '/api/app/profile', desc: 'Update customer profile' },
              ].map((api, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-4 rounded-xl hover:bg-foreground/[0.03] transition-all">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    api.method === 'GET' ? 'bg-blue-500/10 text-blue-400' :
                    api.method === 'POST' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-purple-500/10 text-purple-400'
                  }`}>{api.method}</span>
                  <span className="text-[11px] font-mono font-bold text-foreground/50 flex-1">{api.path}</span>
                  <span className="text-[9px] text-foreground/25 hidden md:block">{api.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Footer Status */}
      <div className="text-center pt-10">
        <div className="inline-flex items-center gap-3 px-6 py-2.5 border border-foreground/[0.08] rounded-full bg-foreground/40 dark:bg-foreground/[0.02] shadow-xl backdrop-blur-md">
          <div className={`w-2 h-2 rounded-full ${allHealthy ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-foreground/30">
            {allHealthy ? 'Integration Active' : 'Integration Degraded'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
