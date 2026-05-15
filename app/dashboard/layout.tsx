"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  Package,
  ShoppingCart,
  ArrowLeftRight,
  Undo2,
  ScanLine,
  Settings,
  Bell,
  Monitor,
  BoxSelect,
  Users,
  ShoppingBag,
  Newspaper,
  Menu,
  FileText,
  MessageSquare,
  Smartphone,
  Building2,
  Layers2,
  ArrowDownUp,
  ClipboardList,
  Coins,
  Truck,
  X,
  TrendingUp,
  Sparkles,
  Megaphone,
  Mail,
  MessageCircle,
  CreditCard,
  Tag,
  History,
  Heart,
  Wallet
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useRealtimeSync } from "@/lib/hooks/useRealtime";
import ThemeToggle from "@/components/ThemeToggle";
import ZicaAI from "@/components/ZicaAI";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const navScrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  useRealtimeSync();

  // Close mobile sidebar on navigation — but DON'T touch scroll
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  // Mandatory password change check
  useEffect(() => {
    if (session?.user && (session.user as any).needsPasswordChange && pathname !== '/dashboard/change-password') {
      router.push('/dashboard/change-password');
    }
  }, [session, pathname, router]);

  // Scroll the active link into view on mount and when pathname changes
  useEffect(() => {
    requestAnimationFrame(() => {
      activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [pathname]);

  const coreNav = [
    { name: "Overview", href: "/dashboard", icon: BarChart3, module: 'DASHBOARD_HOME' },
    { name: "Support", href: "/dashboard/support", icon: MessageCircle, module: 'SUPPORT' },
    { name: "Orders", href: "/dashboard/orders", icon: ShoppingBag, module: 'ORDERS' },
    { name: "Mobile Orders", href: "/dashboard/mobile-orders", icon: Smartphone, module: 'MOBILE_ORDERS' },
    { name: "Customers", href: "/dashboard/customers", icon: Users, module: 'CUSTOMERS' },
    { name: "Products", href: "/dashboard/products", icon: Layers2, module: 'PRODUCTS' },
    { name: "Guide", href: "/dashboard/guide", icon: FileText },
  ];

  const operationalNav = [
    { name: "Collections", href: "/dashboard/collections", icon: Package, module: 'PRODUCTS' },
    { name: "Inventory", href: "/dashboard/inventory", icon: BoxSelect, module: 'INVENTORY' },
    { name: "Scanner", href: "/dashboard/inventory/scanner", icon: ScanLine, module: 'INVENTORY' },
    { name: "Scanner Records", href: "/dashboard/scanner-records", icon: FileText, module: 'INVENTORY' },
    { name: "Returns", href: "/dashboard/returns", icon: Undo2, module: 'RETURNS_EXCHANGES' },
    { name: "Exchanges", href: "/dashboard/exchanges", icon: ArrowLeftRight, module: 'RETURNS_EXCHANGES' },
    { name: "Logistics", href: "/dashboard/logistics", icon: Truck, module: 'LOGISTICS' },
  ];

  const aestheticNav = [
    { name: "Storefront", href: "/dashboard/storefront", icon: Monitor, module: 'STOREFRONT' },
    { name: "Chat Management", href: "/dashboard/community/chat", icon: MessageSquare, module: 'COMMUNITY' },
    { name: "Community", href: "/dashboard/community", icon: Users, module: 'COMMUNITY' },
    { name: "Blogs", href: "/dashboard/blogs", icon: Newspaper, module: 'COMMUNITY' },
    { name: "Policies", href: "/dashboard/policies", icon: FileText, module: 'STOREFRONT' },
  ];

  const integrationNav = [
    { name: "App Integration", href: "/dashboard/app-integration", icon: Smartphone, module: 'INTEGRATIONS' },
    { name: "Live Carts", href: "/dashboard/live-carts", icon: ShoppingCart, module: 'INTEGRATIONS' },
    { name: "App Login Logs", href: "/dashboard/app-logins", icon: History, module: 'INTEGRATIONS' },
    { name: "Razorpay", href: "/dashboard/payments/razorpay", icon: CreditCard, module: 'INTEGRATIONS' },
  ];

  const intelligenceNav = [
    { name: "Zica AI", href: "/dashboard/ai", icon: Sparkles, module: 'AI_SERVICES' },
  ];

  const manufacturingNav = [
    { name: "Pending Tasks", href: "/dashboard/manufacturing/tasks", icon: ClipboardList, module: 'MANUFACTURING' },
    { name: "Production Tracker", href: "/dashboard/manufacturing/production", icon: TrendingUp, module: 'MANUFACTURING' },
    { name: "Fabric Inventory", href: "/dashboard/manufacturing/fabric", icon: Layers2, module: 'MANUFACTURING' },
    { name: "Fabric Movement", href: "/dashboard/manufacturing/movement", icon: ArrowDownUp, module: 'MANUFACTURING' },
    { name: "Manufacturing Vendors", href: "/dashboard/manufacturing/vendors", icon: Building2, module: 'MANUFACTURING' },
    { name: "Cost Ledger", href: "/dashboard/manufacturing/costs", icon: Coins, module: 'MANUFACTURING' },
  ];

  const marketingNav = [
    { name: "Omnichannel Analytics", href: "/dashboard/marketing/analytics", icon: BarChart3, module: 'MARKETING' },
    { name: "Wishlist Management", href: "/dashboard/wishlist", icon: Heart, module: 'MARKETING' },
    { name: "Push Notifications", href: "/dashboard/notifications", icon: Bell, module: 'MARKETING' },
    { name: "Discounts", href: "/dashboard/marketing/discounts", icon: Tag, module: 'MARKETING' },
    { name: "WhatsApp Hub", href: "/dashboard/marketing/whatsapp", icon: MessageCircle, module: 'MARKETING' },
    { name: "Email Center", href: "/dashboard/marketing/email", icon: Mail, module: 'MARKETING' },
    { name: "SMS Campaigns", href: "/dashboard/marketing/sms", icon: MessageSquare, module: 'MARKETING' },
  ];

  const financialNav = [
    { name: "Payments", href: "/dashboard/payments", icon: CreditCard, module: 'FINANCIAL' },
    { name: "Store Credits", href: "/dashboard/payments/store-credits", icon: Wallet, module: 'FINANCIAL' },
    { name: "Refunds", href: "/dashboard/payments/refunds", icon: ArrowLeftRight, module: 'FINANCIAL' },
  ];

  const userPermissions = (session?.user as any)?.permissions || [];
  const userRole = (session?.user as any)?.role;

  const hasPermission = useCallback((moduleName: string) => {
    if (userRole === 'SUPER_ADMIN') return true;
    const perm = userPermissions.find((p: any) => p.module === moduleName);
    return perm?.canView;
  }, [userRole, userPermissions]);

  const filterNav = (navItems: any[]) => {
    return navItems.filter(item => !item.module || hasPermission(item.module));
  };

  const isSuperAdmin = (session?.user as any)?.role === 'SUPER_ADMIN';

  const systemNav = isSuperAdmin ? [
    { name: "Admin Users", href: "/dashboard/admin-users", icon: Users },
    { name: "Audit Log", href: "/dashboard/audit-log", icon: History },
  ] : [];

  const isActive = useCallback(
    (href: string) =>
      pathname === href || (href !== "/dashboard" && pathname.startsWith(href)),
    [pathname]
  );

  const NavLink = useCallback(
    ({ item }: { item: { name: string; href: string; icon: any } }) => {
      const active = isActive(item.href);
      const Icon = item.icon;
      return (
        <Link
          ref={active ? activeRef : undefined}
          href={item.href}
          className={`group flex items-center gap-4 px-5 py-2.5 rounded-2xl transition-all duration-300 relative overflow-hidden ${
            active
              ? "text-foreground bg-foreground/10 shadow-lg border border-foreground/10"
              : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
          }`}
        >
          <Icon
            className={`w-[18px] h-[18px] shrink-0 transition-colors duration-300 ${
              active ? "text-foreground" : "opacity-40 group-hover:opacity-100"
            }`}
            strokeWidth={active ? 2 : 1.5}
          />
          <span className="text-[12px] font-medium relative z-10 truncate">{item.name}</span>
          {active && (
            <motion.div
              layoutId="activeNav"
              className="absolute inset-0 bg-gradient-to-r from-foreground/5 to-transparent -z-10"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
        </Link>
      );
    },
    [isActive]
  );

  const SectionLabel = ({ children: label }: { children: React.ReactNode }) => (
    <div className="mb-2 px-5">
      <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider font-inter">
        {label}
      </span>
    </div>
  );

  const isLoginPage = pathname === "/dashboard/login";
  if (isLoginPage) return <>{children}</>;

  const pageTitle =
    pathname === "/dashboard"
      ? "Overview"
      : pathname
          .split("/")
          .filter(Boolean)
          .pop()
          ?.replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="min-h-[100dvh] flex text-foreground bg-background dark:bg-[#0A0A0A] font-sans selection:bg-foreground/20 selection:text-foreground">
      {/* Subtle background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-background" aria-hidden="true">
        <div
          className="absolute inset-0 bg-center opacity-[0.03] dark:opacity-[0.05]"
          style={{ backgroundImage: "url('/grid.svg')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--primary),0.05),transparent_70%),radial-gradient(circle_at_bottom_right,rgba(var(--primary),0.05),transparent_70%)] opacity-60" />
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-background/60 backdrop-blur-md z-[55] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ──────── Sidebar ──────── */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 lg:m-4 lg:rounded-[2.5rem] glass overflow-hidden border-r lg:border border-foreground/5 shadow-3xl z-[60] flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full px-4 lg:px-6 pt-6 lg:pt-10 pb-4 lg:pb-8">
          {/* Brand + close button (mobile) */}
          <div className="mb-8 lg:mb-10 px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-foreground/5 text-foreground rounded-2xl flex items-center justify-center shadow-lg border border-foreground/10 backdrop-blur-md">
                <Image
                  src="/zb-logo-220px.png"
                  alt="Logo"
                  width={30}
                  height={30}
                  priority
                  className="dark:brightness-200 dark:grayscale dark:contrast-200"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-foreground/90 font-inter">
                  Zica Bella
                </span>
                <span className="text-[10px] text-foreground/40 mt-0.5 font-medium font-inter">
                  System Configurator
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 rounded-xl text-foreground/40 hover:text-foreground hover:bg-foreground/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable nav — ref preserved across renders */}
          <div
            ref={navScrollRef}
            className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar space-y-6 pr-1 -mr-1"
          >
            <div>
              <SectionLabel>Core Services</SectionLabel>
              <div className="space-y-0.5">
                {filterNav(coreNav).map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Logistics</SectionLabel>
              <div className="space-y-0.5">
                {filterNav(operationalNav).map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Experience</SectionLabel>
              <div className="space-y-0.5">
                {filterNav(aestheticNav).map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Financial</SectionLabel>
              <div className="space-y-0.5">
                {filterNav(financialNav).map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Integration</SectionLabel>
              <div className="space-y-0.5">
                {filterNav(integrationNav).map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 px-5 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-violet-400" strokeWidth={2} />
                <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider font-inter">
                  Intelligence
                </span>
              </div>
              <div className="space-y-0.5">
                {filterNav(intelligenceNav).map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 px-5 flex items-center gap-2">
                <Megaphone className="w-3 h-3 text-foreground/40" strokeWidth={2} />
                <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider font-inter">
                  Marketing
                </span>
              </div>
              <div className="space-y-0.5">
                {filterNav(marketingNav).map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 px-5 flex items-center gap-2">
                <Building2 className="w-3 h-3 text-foreground/40" strokeWidth={2} />
                <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider font-inter">
                  Manufacturing
                </span>
              </div>
              <div className="space-y-0.5">
                {filterNav(manufacturingNav).map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            </div>

            {isSuperAdmin && (
              <div>
                <SectionLabel>System Management</SectionLabel>
                <div className="space-y-0.5">
                  {systemNav.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Settings — always visible at bottom */}
          <div className="mt-4 pt-3 border-t border-foreground/[0.06]">
            <Link
              ref={pathname === "/dashboard/settings" ? activeRef : undefined}
              href="/dashboard/settings"
              className={`flex items-center gap-3 px-5 py-2.5 rounded-xl transition-all duration-300 ${
                pathname === "/dashboard/settings"
                  ? "bg-foreground text-background shadow-lg shadow-black/10"
                  : "text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04]"
              }`}
            >
              <Settings
                className="w-4 h-4"
                strokeWidth={pathname === "/dashboard/settings" ? 2 : 1.5}
              />
              <span className="text-[12px] font-medium font-inter">Settings</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* ──────── Main content ──────── */}
      <main className="flex-1 lg:ml-80 flex flex-col min-h-[100dvh] relative z-10 overflow-x-hidden">
        {/* Header */}
        <header className="h-14 lg:h-16 flex items-center justify-between px-4 lg:px-8 m-2 lg:mx-8 lg:my-6 rounded-3xl glass shadow-2xl sticky top-2 lg:top-6 z-40 border border-foreground/5 shrink-0">
          <div className="flex items-center gap-3 lg:gap-6 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-2xl bg-foreground/5 text-foreground/60 hover:text-foreground transition-colors border border-foreground/10"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-[14px] lg:text-[16px] font-semibold text-foreground font-inter truncate">
              {pageTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <ThemeToggle />
            <div className="hidden sm:block w-[1px] h-4 bg-foreground/10" />
            <button className="hidden sm:flex w-9 h-9 items-center justify-center rounded-2xl bg-foreground/5 text-foreground/40 hover:text-foreground transition-all border border-foreground/5">
              <Bell className="w-[18px] h-[18px]" />
            </button>
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2 lg:gap-3 p-1 lg:p-1.5 pl-3 lg:pl-4 bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 transition-all rounded-full group shadow-inner"
            >
              <span className="hidden sm:inline text-[12px] font-medium text-foreground/60 group-hover:text-foreground transition-colors font-inter">
                Admin
              </span>
              <div className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105 duration-500">
                <span className="text-[10px] font-medium font-inter">ZB</span>
              </div>
            </Link>
          </div>
        </header>

        {/* Content area — scrollable */}
        <div className="flex-1 px-4 lg:px-8 py-4 lg:py-8 overflow-y-auto overflow-x-hidden custom-scrollbar relative w-full">
          <div className="max-w-[1400px] w-full mx-auto relative overflow-x-clip">{children}</div>
        </div>
      </main>

      {/* Zica AI — Floating Command Center */}
      <ZicaAI />
    </div>
  );
}
