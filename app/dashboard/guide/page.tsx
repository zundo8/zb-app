"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Home, 
  ShoppingBag, 
  ScanLine, 
  BoxSelect, 
  ClipboardList, 
  TrendingUp, 
  Layers2, 
  Building2, 
  Coins, 
  BarChart3, 
  Settings, 
  Search, 
  ArrowUp, 
  CheckCircle2, 
  Info, 
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BookOpen,
  MousePointer2,
  Zap,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SECTIONS = [
  { id: "overview", title: "Overview", icon: Home, emoji: "🏠", category: "Core" },
  { id: "orders", title: "Orders Management", icon: ShoppingBag, emoji: "📦", category: "Core" },
  { id: "scanner", title: "Scanner Hub", icon: ScanLine, emoji: "🔍", category: "Operations" },
  { id: "inventory", title: "Inventory Management", icon: BoxSelect, emoji: "🗂️", category: "Operations" },
  { id: "tasks", title: "Pending Tasks Manager", icon: ClipboardList, emoji: "✅", category: "Operations" },
  { id: "production", title: "Production Tracker", icon: TrendingUp, emoji: "🏭", category: "Manufacturing" },
  { id: "products", title: "Products Management", icon: Layers2, emoji: "👗", category: "Storefront" },
  { id: "vendors", title: "Vendors & Suppliers", icon: Building2, emoji: "🧵", category: "Manufacturing" },
  { id: "ledger", title: "Cost Ledger", icon: Coins, emoji: "💰", category: "Finance" },
  { id: "analytics", title: "Analytics & Reports", icon: BarChart3, emoji: "📊", category: "Intelligence" },
  { id: "settings", title: "System Settings", icon: Settings, emoji: "⚙️", category: "Admin" },
];

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState<string | null>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [readSections, setReadSections] = useState<string[]>([]);
  
  const toggleSection = (id: string) => {
    setActiveSection(activeSection === id ? null : id);
    // Smooth scroll to the section if it's being opened
    if (activeSection !== id) {
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        }
      }, 100);
    }
  };

  const toggleRead = (id: string) => {
    setReadSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const filteredSections = SECTIONS.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const progress = (readSections.length / SECTIONS.length) * 100;

  return (
    <div className="max-w-full overflow-x-hidden">
      {/* Header Section */}
      <div className="mb-12 space-y-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 text-[#D4A853] font-medium text-sm tracking-widest uppercase"
        >
          <BookOpen className="w-4 h-4" />
          Internal Knowledge Base
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl lg:text-6xl font-bold tracking-tight text-foreground"
        >
          Admin <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4A853] to-[#F5D18D]">Dashboard Guide</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-foreground/50 max-w-3xl leading-relaxed"
        >
          Master the Zica Bella operational ecosystem. This interactive reference guide explains every workflow, from raw material procurement to final order fulfillment.
        </motion.p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* --- Sidebar TOC --- */}
        <aside className="w-full lg:w-80 shrink-0 sticky top-24 z-30">
          <div className="glass-card p-6 rounded-[2rem] space-y-6 shadow-2xl border-white/5">
            {/* Progress Card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/40">Your Progress</span>
                <span className="text-[11px] font-bold text-[#D4A853]">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-[#D4A853] to-[#F5D18D]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 50 }}
                />
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
              <input 
                type="text" 
                placeholder="Search modules..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 transition-all placeholder:text-foreground/20"
              />
            </div>

            {/* Nav List */}
            <nav className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 -mr-2">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                const isRead = readSections.includes(section.id);
                
                return (
                  <button
                    key={section.id}
                    onClick={() => toggleSection(section.id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-left transition-all duration-500 group relative overflow-hidden ${
                      isActive 
                        ? "bg-[#D4A853] text-black shadow-xl shadow-[#D4A853]/10" 
                        : "text-foreground/60 hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-black" : "text-foreground/30 group-hover:text-[#D4A853]"}`} />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold truncate">{section.title}</span>
                        <span className={`text-[9px] uppercase tracking-widest font-bold ${isActive ? "text-black/60" : "text-foreground/20"}`}>
                          {section.category}
                        </span>
                      </div>
                    </div>
                    {isRead && <CheckCircle2 className={`w-3.5 h-3.5 relative z-10 ${isActive ? "text-black/60" : "text-green-500"}`} />}
                    {!isRead && isActive && <ChevronRight className="w-3.5 h-3.5 text-black/40" />}
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                <HelpCircle className="w-4 h-4 text-[#D4A853]" />
                <div className="text-[11px] text-foreground/40 leading-snug">
                  Need direct assistance? Contact the <span className="text-foreground">System Admin</span> via the Zica AI chat.
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* --- Main Content Area --- */}
        <div className="flex-1 w-full lg:max-w-[calc(100%-320px)] space-y-6">
          <AnimatePresence mode="popLayout">
            {SECTIONS.filter(s => searchQuery === "" || s.title.toLowerCase().includes(searchQuery.toLowerCase())).map((section) => (
              <GuideSectionCard 
                key={section.id}
                section={section}
                isOpen={activeSection === section.id}
                onToggle={() => toggleSection(section.id)}
                isRead={readSections.includes(section.id)}
                onMarkRead={() => toggleRead(section.id)}
              />
            ))}
          </AnimatePresence>

          {/* Empty State */}
          {filteredSections.length === 0 && (
            <div className="glass-card p-12 rounded-[2.5rem] text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-foreground/20" />
              </div>
              <h3 className="text-xl font-bold">No modules found</h3>
              <p className="text-foreground/40">Try searching for keywords like "orders", "fabric", or "sync".</p>
              <button 
                onClick={() => setSearchQuery("")}
                className="px-6 py-2 bg-[#D4A853] text-black rounded-xl font-bold text-sm hover:scale-105 transition-transform"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-24 pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 hover:opacity-100 transition-opacity duration-700 pb-12">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center font-bold text-[#D4A853]">ZB</div>
          <div className="text-xs uppercase tracking-widest font-bold">Zica Bella Operations v2.4</div>
        </div>
        <div className="text-xs font-medium">Internal Use Only • Confidential Reference</div>
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:text-[#D4A853] transition-colors"
        >
          Return to top <ArrowUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// --- Detailed Section Component ---

function GuideSectionCard({ section, isOpen, onToggle, isRead, onMarkRead }: { 
  section: typeof SECTIONS[0], 
  isOpen: boolean, 
  onToggle: () => void, 
  isRead: boolean, 
  onMarkRead: () => void 
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div 
      id={section.id}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass-card rounded-[2.5rem] overflow-hidden transition-all duration-700 border-white/5 ${
        isOpen ? "shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/10" : "hover:bg-white/[0.02] cursor-pointer"
      }`}
    >
      {/* Card Header (Toggle) */}
      <div 
        onClick={onToggle}
        className="p-6 lg:p-8 flex items-center justify-between group select-none"
      >
        <div className="flex items-center gap-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-all duration-500 ${
            isOpen ? "bg-[#D4A853] scale-110 shadow-lg shadow-[#D4A853]/20" : "bg-white/5"
          }`}>
            {section.emoji}
          </div>
          <div>
            <h2 className={`text-xl lg:text-2xl font-bold tracking-tight transition-colors ${isOpen ? "text-white" : "text-foreground/80 group-hover:text-white"}`}>
              {section.title}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4A853]">Module {section.id.toUpperCase()}</span>
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">{section.category}</span>
            </div>
          </div>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${isOpen ? "bg-white/10 rotate-180" : "bg-white/5 group-hover:bg-white/10"}`}>
          <ChevronDown className={`w-5 h-5 ${isOpen ? "text-white" : "text-foreground/40"}`} />
        </div>
      </div>

      {/* Expandable Content */}
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden"
      >
        <div className="px-6 lg:px-10 pb-10 space-y-10 border-t border-white/5 pt-8">
          {/* Dynamic Content Injection Based on Section ID */}
          <div className="prose prose-invert max-w-none text-foreground/70 leading-relaxed space-y-8">
            {renderSectionContent(section.id)}
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-10 border-t border-white/5">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full bg-white/10 border-2 border-background flex items-center justify-center text-[10px] font-bold">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <span className="text-xs font-medium text-foreground/40">Used by 12+ team members today</span>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead();
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-500 ${
                  isRead 
                    ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                    : "bg-[#D4A853] text-black hover:scale-105 active:scale-95 shadow-lg shadow-[#D4A853]/10"
                }`}
              >
                {isRead ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Completed
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> Mark as Understood
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Content Rendering Logic ---

function renderSectionContent(id: string) {
  switch (id) {
    case "overview":
      return (
        <div className="space-y-6">
          <p className="text-lg">The <strong>Command Center</strong> of Zica Bella. This page aggregates data from Shopify, our mobile app, and the manufacturing floor to give you a 360-degree view of operations.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard title="Real-time Revenue" desc="Tracks Gross Sales vs Net Profit after production costs are deducted." icon={Coins} />
            <InfoCard title="Operational Pulse" desc="Shows items currently 'In Production' and those 'Awaiting Dispatch'." icon={TrendingUp} />
          </div>

          <div className="space-y-4">
            <h4 className="text-white font-bold flex items-center gap-2">
              <MousePointer2 className="w-4 h-4 text-[#D4A853]" /> 
              Key Interaction Points
            </h4>
            <ul className="list-none space-y-4 pl-0">
              <ListItem num="01" title="Date Range Control" text="Located in the top right. Changes the timeframe for all metrics (Sales, Orders, Expenses). Critical for month-end reporting." />
              <ListItem num="02" title="Activity Stream" text="A chronological log of all admin actions. If an order status was changed, it shows WHO did it and WHEN." />
              <ListItem num="03" title="Alert Center" text="Automated notifications for stockouts, overdue production tasks, or failed Shopify syncs." />
            </ul>
          </div>

          <TipBox>
            💡 Use the "Quick Action" buttons for the fastest way to add a walk-in order or log a quick expense.
          </TipBox>
        </div>
      );

    case "orders":
      return (
        <div className="space-y-8">
          <p>This module centralizes every transaction. We distinguish between <strong>Web Orders</strong> (Shopify) and <strong>Mobile App Orders</strong> (Direct).</p>
          
          <div className="space-y-4">
            <h4 className="text-white font-bold">The Fulfillment Lifecycle</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatusBox status="Pending" desc="New order, payment verified, awaiting review." />
              <StatusBox status="Production" desc="Order details sent to factory floor." color="orange" />
              <StatusBox status="Quality Check" desc="Garment finished, verifying measurements." color="purple" />
              <StatusBox status="Shipped" desc="Handed over to Delhivery/Logistic partner." color="cyan" />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-white font-bold underline decoration-[#D4A853]/30 underline-offset-8">Critical Workflows</h4>
            <StepList steps={[
              "Filter by 'Production' to see what needs to be manufactured today.",
              "Use internal notes to flag custom measurement requirements for the stitching team.",
              "Click the 'Order Timeline' to see exactly where a delay is occurring.",
              "Return Management: If a customer returns an item, mark it as 'Returned' to trigger a credit note or refund task automatically."
            ]} />
          </div>

          <WarningBox>
            ⚠️ Never manually update an order to 'Delivered' unless the logistics partner API fails. The system syncs this automatically every 30 minutes.
          </WarningBox>
        </div>
      );

    case "scanner":
      return (
        <div className="space-y-8">
          <p>The <strong>Universal Scanner</strong> turns any device into a warehouse terminal. It is optimized for mobile browser use.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 border-white/5 space-y-4">
              <div className="w-12 h-12 bg-[#D4A853]/10 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#D4A853]" />
              </div>
              <h5 className="font-bold text-white">Production Advance</h5>
              <p className="text-xs text-foreground/50 leading-relaxed">Scan a garment's unique QR code to move it from 'Stitching' to 'Quality Check' in one tap. No typing required.</p>
            </div>
            <div className="glass-card p-6 border-white/5 space-y-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Search className="w-6 h-6 text-blue-500" />
              </div>
              <h5 className="font-bold text-white">Instant Lookup</h5>
              <p className="text-xs text-foreground/50 leading-relaxed">Scan any tag in the warehouse to see its current stock across all sizes, cost price, and active order history.</p>
            </div>
          </div>

          <TipBox>
            💡 For bulk dispatching, use the scanner to scan 50+ packages in minutes to update them all to 'Shipped' status.
          </TipBox>

          <div className="space-y-3">
            <h5 className="text-[11px] font-bold uppercase tracking-widest text-[#D4A853]">Troubleshooting</h5>
            <p className="text-xs opacity-60">If the camera won't start, ensure you have granted 'Camera Permissions' to the browser. In low light, use the manual 'Enter Code' feature.</p>
          </div>
        </div>
      );

    case "inventory":
      return (
        <div className="space-y-8">
          <p>Zica Bella uses a <strong>Multi-Variant Inventory System</strong>. Every garment is tracked by its unique SKU (Stock Keeping Unit).</p>

          <div className="space-y-4">
            <h4 className="text-white font-bold">Inventory Hierarchy</h4>
            <div className="p-6 bg-white/5 rounded-3xl space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-[#D4A853]" />
                <span className="text-sm font-bold">Product Type (e.g., Silk Dress)</span>
              </div>
              <div className="ml-8 flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-white/20" />
                <span className="text-sm">Color Variant (e.g., Midnight Blue)</span>
              </div>
              <div className="ml-16 flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-white/10" />
                <span className="text-sm text-foreground/50">Size Variant (S, M, L, XL, XXL)</span>
              </div>
            </div>
          </div>

          <StepList steps={[
            "Audit Stock: Use the 'Export CSV' to do a monthly physical count vs digital count.",
            "Adjustments: Log reason for adjustments (Damaged, Sampling, Return to Vendor).",
            "Thresholds: Set 'Low Stock' triggers per SKU to ensure you never run out of fabric for top sellers.",
            "Photos: Upload multiple angles. High-res images are automatically synced to the Shopify storefront."
          ]} />
        </div>
      );

    case "tasks":
      return (
        <div className="space-y-6">
          <p>The <strong>Team Kanban</strong> board. Every operational bottleneck is represented here as a task.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white/5 rounded-2xl border-l-4 border-foreground/10">
              <h6 className="text-[10px] font-bold uppercase mb-2">Backlog</h6>
              <p className="text-xs opacity-50">Automated alerts and low priority ideas.</p>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border-l-4 border-[#D4A853]">
              <h6 className="text-[10px] font-bold uppercase mb-2 text-[#D4A853]">Active</h6>
              <p className="text-xs opacity-50">What the team is working on right now.</p>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border-l-4 border-green-500">
              <h6 className="text-[10px] font-bold uppercase mb-2 text-green-500">Done</h6>
              <p className="text-xs opacity-50">Completed and archived history.</p>
            </div>
          </div>

          <ul className="space-y-4">
            <li><strong>Priority System:</strong> Urgent tasks (Red) send push notifications to assignees.</li>
            <li><strong>Smart Tags:</strong> Tasks are automatically tagged by department (Fabric, Tailoring, Logistics).</li>
            <li><strong>Dependencies:</strong> You can link a task to an Order ID so the customer support team knows why a shipment is delayed.</li>
          </ul>
        </div>
      );

    case "production":
      return (
        <div className="space-y-8">
          <p>The <strong>Manufacturing Pipeline</strong>. This tracks the movement from raw fabric to a finished luxury garment.</p>

          <div className="relative py-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
              {["Ready", "Cutting", "Stitching", "Printing", "Embroidery", "Wash", "QC", "Dispatch"].map((s, i) => (
                <div key={s} className="flex items-center gap-2 shrink-0">
                  <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest">{s}</div>
                  {i < 7 && <ChevronRight className="w-3 h-3 text-white/20" />}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-white font-bold">Standard Operating Procedures</h4>
            <ul className="list-disc pl-5 space-y-3">
              <li><strong>Stage Gating:</strong> An item cannot move to 'QC' unless it has passed through 'Wash'.</li>
              <li><strong>Rework:</strong> If QC fails, the item is moved back to 'Returned' (Stage 7) which alerts the floor manager for immediate correction.</li>
              <li><strong>Efficiency Tracking:</strong> The system logs how many hours each garment spends in each stage to identify production bottlenecks.</li>
            </ul>
          </div>

          <TipBox>
            💡 View the 'Worker Leaderboard' in the Analytics section to see which tailors have the highest output and lowest QC failure rates.
          </TipBox>
        </div>
      );

    case "products":
      return (
        <div className="space-y-8">
          <p>The <strong>Catalog Engine</strong>. This is where you define the Zica Bella brand identity through product listings.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ListItem num="01" title="Shopify Bridge" text="Update a price here, and it updates on app.zicabella.com instantly. No double-entry." />
            <ListItem num="02" title="SEO Optimization" text="The product descriptions added here are indexed by Google. Use high-traffic keywords." />
            <ListItem num="03" title="Collection Management" text="Group products into collections (e.g., Summer 2026, Bridal Couture) for the mobile app carousel." />
            <ListItem num="04" title="Archiving" text="Instead of deleting old styles, archive them. This preserves historical sales data while hiding them from customers." />
          </div>
        </div>
      );

    case "vendors":
      return (
        <div className="space-y-6">
          <p>Manage your <strong>Supply Chain</strong>. From fabric mills to thread suppliers.</p>
          
          <ul className="space-y-4">
            <li><strong>Purchase Orders (PO):</strong> Generate professional PDF POs directly from the dashboard and email them to vendors in one click.</li>
            <li><strong>Payment Terms:</strong> Track which vendors are on 'Pre-paid' vs 'Credit' terms.</li>
            <li><strong>Quality Scoring:</strong> Grade vendors based on the quality of raw materials received and delivery punctuality.</li>
          </ul>

          <WarningBox>
            ⚠️ Before paying a vendor, ensure all items from the last PO are marked as 'Received' in the inventory module.
          </WarningBox>
        </div>
      );

    case "ledger":
      return (
        <div className="space-y-8">
          <p>The <strong>Financial Heart</strong>. Every expense must be logged to calculate the 'True Cost' of our garments.</p>

          <div className="p-6 border border-[#D4A853]/20 bg-[#D4A853]/5 rounded-3xl space-y-4">
            <h5 className="font-bold text-[#D4A853] flex items-center gap-2"><Zap className="w-4 h-4" /> Why log everything?</h5>
            <p className="text-sm">If you don't log the cost of thread, packaging, and shipping for an order, your 'Profit' chart in Analytics will be incorrect.</p>
          </div>

          <StepList steps={[
            "Fabric Costs: Link fabric purchase costs to specific product SKUs.",
            "Labor Costs: Log stitching and embroidery charges per garment.",
            "Overheads: Add monthly rent, electricity, and software subscription costs.",
            "Audit Trail: Every entry shows which admin user created it. No anonymous edits."
          ]} />
        </div>
      );

    case "analytics":
      return (
        <div className="space-y-6">
          <p>Turn raw data into <strong>Business Growth</strong>. High-level insights for management.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <h6 className="font-bold text-white mb-2">Best Sellers</h6>
              <p className="text-xs opacity-60">Identifies which sizes and colors are trending to inform the next production run.</p>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <h6 className="font-bold text-white mb-2">Churn Analysis</h6>
              <p className="text-xs opacity-60">Tracks returns and cancellations to identify product quality or sizing issues.</p>
            </div>
          </div>

          <TipBox>
            💡 Export the 'End of Month' report to PDF for the leadership meeting. It summarizes all revenue, costs, and growth metrics.
          </TipBox>
        </div>
      );

    case "settings":
      return (
        <div className="space-y-8">
          <p>The <strong>System Brain</strong>. Configuration and security controls.</p>

          <ul className="list-none p-0 space-y-4">
            <li className="flex gap-4">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0"><Settings className="w-5 h-5" /></div>
              <div>
                <p className="font-bold text-white text-sm">Role-Based Access Control (RBAC)</p>
                <p className="text-xs opacity-50">Limit warehouse staff to 'Scanner' and 'Tasks' while keeping financial data for 'Super Admins' only.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0"><Zap className="w-5 h-5" /></div>
              <div>
                <p className="font-bold text-white text-sm">Shopify API Sync</p>
                <p className="text-xs opacity-50">Manage webhooks that keep the dashboard updated when a customer buys something on the website.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0"><ExternalLink className="w-5 h-5" /></div>
              <div>
                <p className="font-bold text-white text-sm">Audit Log</p>
                <p className="text-xs opacity-50">A permanent, un-editable record of every single change made in the dashboard for security compliance.</p>
              </div>
            </li>
          </ul>
        </div>
      );

    default:
      return <p>Section content coming soon...</p>;
  }
}

// --- Helper Components ---

function InfoCard({ title, desc, icon: Icon }: { title: string, desc: string, icon: any }) {
  return (
    <div className="p-5 bg-white/5 rounded-[1.5rem] border border-white/5 space-y-2 hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-[#D4A853]" />
        <span className="font-bold text-white text-sm">{title}</span>
      </div>
      <p className="text-xs leading-relaxed text-foreground/40">{desc}</p>
    </div>
  );
}

function ListItem({ num, title, text }: { num: string, title: string, text: string }) {
  return (
    <div className="flex gap-4 group">
      <span className="text-[#D4A853] font-black text-lg opacity-40 group-hover:opacity-100 transition-opacity">{num}</span>
      <div>
        <h5 className="font-bold text-white text-sm mb-1">{title}</h5>
        <p className="text-xs leading-relaxed opacity-60">{text}</p>
      </div>
    </div>
  );
}

function ListItemSmall({ title, text }: { title: string, text: string }) {
  return (
    <div className="space-y-1">
      <h6 className="font-bold text-white text-xs">{title}</h6>
      <p className="text-xs opacity-50 leading-relaxed">{text}</p>
    </div>
  );
}

function StatusBox({ status, desc, color = "green" }: { status: string, desc: string, color?: string }) {
  const colors: Record<string, string> = {
    green: "border-green-500/20 bg-green-500/5 text-green-500",
    orange: "border-orange-500/20 bg-orange-500/5 text-orange-500",
    purple: "border-purple-500/20 bg-purple-500/5 text-purple-500",
    cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-500",
  };

  return (
    <div className={`p-4 rounded-2xl border ${colors[color]} space-y-2`}>
      <span className="text-[10px] font-black uppercase tracking-widest">{status}</span>
      <p className="text-[11px] leading-snug opacity-80">{desc}</p>
    </div>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 rounded-[2rem] border-l-8 border-[#D4A853] bg-[#D4A853]/5 flex gap-4 my-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-150 transition-transform duration-1000">
        <Lightbulb className="w-24 h-24 text-[#D4A853]" />
      </div>
      <Lightbulb className="w-6 h-6 text-[#D4A853] shrink-0 mt-0.5" />
      <div className="text-sm text-foreground/80 font-medium leading-relaxed italic relative z-10">{children}</div>
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 rounded-[2rem] border-l-8 border-red-500/50 bg-red-500/5 flex gap-4 my-8">
      <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
      <div className="text-sm text-foreground/80 font-medium leading-relaxed relative z-10">{children}</div>
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
      {steps.map((step, i) => (
        <div key={i} className="p-4 bg-white/5 rounded-2xl flex gap-4 hover:bg-white/10 transition-all border border-white/5">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D4A853]/10 flex items-center justify-center text-[10px] font-black text-[#D4A853]">
            {i + 1}
          </div>
          <p className="text-xs text-foreground/70 leading-relaxed font-medium pt-1">{step}</p>
        </div>
      ))}
    </div>
  );
}
