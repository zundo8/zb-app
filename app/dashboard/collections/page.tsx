"use client";

import { useState, useEffect } from "react";
import { 
  Package, 
  Save, 
  Search,
  Check,
  Loader2,
  PanelTop,
  Layers,
  Menu as MenuIcon,
  Eye,
  EyeOff
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export default function CollectionsAdminPage() {
  const [collections, setCollections] = useState<any[]>([]);
  const [enabled, setEnabled] = useState<{
    header: string[];
    page: string[];
    menu: string[];
  }>({
    header: [],
    page: [],
    menu: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch("/api/admin/collections");
      const data = await res.json();
      if (data.allCollections) {
        setCollections(data.allCollections);
        setEnabled(data.enabled);
      }
    } catch (err) {
      console.error("Failed to fetch collections:", err);
    } finally {
      setLoading(false);
    }
  }

  const toggleLocation = (handle: string, location: 'header' | 'page' | 'menu') => {
    setEnabled(prev => ({
      ...prev,
      [location]: prev[location].includes(handle)
        ? prev[location].filter(h => h !== handle)
        : [...prev[location], handle]
    }));
  };
  
  const syncAll = () => {
    const allHandles = collections.map(c => c.handle);
    setEnabled({
      header: allHandles,
      page: allHandles,
      menu: allHandles
    });
  };

  const saveChanges = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enabled),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save changes:", err);
    } finally {
      setSaving(false);
    }
  };

  const filteredCollections = collections.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Synchronizing Collections...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header Area */}
       <div className="flex items-end justify-between gap-4 mb-2">
        <div>
          <div className="px-2 py-0.5 bg-foreground/[0.03] rounded-md text-[7px] font-normal text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/30 uppercase tracking-[0.3em] w-fit mb-2">visibility matrix</div>
          <h1 className="font-normal text-lg tracking-[0.2em] text-foreground uppercase mb-0.5 leading-none">Collections</h1>
          <p className="text-[9px] text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20 font-normal uppercase tracking-[0.2em] mt-1">
            Control storefront visibility for each node.
          </p>
        </div>
        
        <button 
          onClick={saveChanges}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-2 rounded-md font-normal text-[8px] uppercase tracking-[0.2em] transition-all ${
            success 
              ? "bg-green-500/10 text-green-500 border border-green-500/10" 
              : "bg-foreground text-background shadow-md shadow-foreground/5 hover:opacity-90 active:scale-95 disabled:opacity-50"
          }`}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : success ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" strokeWidth={1.5} />}
          {saving ? "SAVING..." : success ? "SAVED" : "SAVE"}
        </button>

        <button 
          onClick={syncAll}
          className="flex items-center gap-2 px-4 py-2 rounded-md font-normal text-[8px] uppercase tracking-[0.2em] bg-foreground/5 text-foreground hover:bg-foreground/10 transition-all border border-foreground/5"
        >
          <Layers className="w-3 h-3" strokeWidth={1.5} />
          SYNC SPECTRUM
        </button>
      </div>

       {/* Search Bar */}
      <div className="relative group max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20 group-focus-within:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 transition-colors" />
        <input 
          type="text" 
          placeholder="FILTER SPECTRUM..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-md bg-foreground/[0.02] border border-foreground/[0.05] focus:border-foreground/10 focus:bg-foreground/[0.04] transition-all outline-none text-[10px] font-normal uppercase tracking-[0.1em] placeholder:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/10"
        />
      </div>

      {/* Collections Table-like Grid */}
       <div className="bg-white/50 dark:bg-white/[0.02] border border-foreground/[0.05] rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1fr,80px,80px,80px] gap-2 px-5 py-3 border-b border-foreground/[0.02] bg-foreground/[0.01]">
          <span className="text-[7px] uppercase tracking-[0.3em] font-normal text-foreground/15">Collection & Info</span>
          <div className="flex items-center justify-center gap-1.5">
            <PanelTop className="w-2.5 h-2.5 text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/10" strokeWidth={1.5} />
            <span className="text-[7px] uppercase tracking-[0.3em] font-normal text-foreground/15">Header</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <Layers className="w-2.5 h-2.5 text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/10" strokeWidth={1.5} />
            <span className="text-[7px] uppercase tracking-[0.3em] font-normal text-foreground/15">List</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <MenuIcon className="w-2.5 h-2.5 text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/10" strokeWidth={1.5} />
            <span className="text-[7px] uppercase tracking-[0.3em] font-normal text-foreground/15">Menu</span>
          </div>
        </div>

        <div className="divide-y divide-foreground/[0.03]">
          <AnimatePresence mode="popLayout">
            {filteredCollections.map((collection) => (
                <motion.div
                layout
                key={collection.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-[1fr,80px,80px,80px] gap-2 px-5 py-2 items-center hover:bg-foreground/[0.01] transition-colors"
              >
                {/* Collection Info */}
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-foreground/[0.03] border border-foreground/[0.02]">
                    {collection.image?.src ? (
                      <Image 
                        src={collection.image.src} 
                        alt={collection.title} 
                        fill 
                        className="object-cover grayscale opacity-70"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-3 h-3 text-foreground/5" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[9px] font-normal uppercase tracking-[0.1em] text-foreground lowercase leading-none">{collection.title}</h3>
                    <p className="text-[7px] text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/40 dark:text-foreground/20 font-normal uppercase tracking-[0.2em] mt-1">{collection.products?.length || 0} Pieces</p>
                  </div>
                </div>

                {/* Toggles */}
                <VisibilityToggle 
                  active={enabled.header.includes(collection.handle)}
                  onClick={() => toggleLocation(collection.handle, 'header')}
                />
                <VisibilityToggle 
                  active={enabled.page.includes(collection.handle)}
                  onClick={() => toggleLocation(collection.handle, 'page')}
                />
                <VisibilityToggle 
                  active={enabled.menu.includes(collection.handle)}
                  onClick={() => toggleLocation(collection.handle, 'menu')}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {filteredCollections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">No Collections Found</p>
        </div>
      )}
    </div>
  );
}

 function VisibilityToggle({ active, onClick }: { active: boolean, onClick: () => void }) {
  return (
    <div className="flex justify-center">
      <button 
        onClick={onClick}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 border ${
          active 
            ? "bg-foreground text-background border-foreground shadow-sm" 
            : "bg-foreground/[0.02] text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/30 dark:text-foreground/10 border-foreground/[0.05] hover:border-foreground/10 hover:text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40"
        }`}
      >
        {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      </button>
    </div>
  );
}
