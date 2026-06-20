"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Tag, Plus, Trash2, Calendar, Percent, Banknote, 
  Search, Filter, ChevronRight, X, CheckCircle2,
  AlertCircle, Sparkles, Clock, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    code: "",
    type: "percentage",
    value: "",
    minOrderAmount: "0",
    maxDiscount: "",
    endDate: "",
    usageLimit: "",
    isActive: true,
    description: "",
    cashbackEnabled: false,
    cashbackType: "percentage",
    cashbackValue: ""
  });

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async (silent = false) => {
    try {
      if (!silent && discounts.length === 0) setLoading(true);
      const res = await fetch("/api/discounts");
      const data = await res.json();
      if (data.success) {
        setDiscounts(data.discounts);
      }
    } catch (err) {
      if (!silent) toast.error("Failed to load discounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleSync = () => {
      fetchDiscounts(true);
    };
    window.addEventListener("realtime-sync", handleSync);
    return () => window.removeEventListener("realtime-sync", handleSync);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Discount code created!");
        setIsModalOpen(false);
        setFormData({
          code: "",
          type: "percentage",
          value: "",
          minOrderAmount: "0",
          maxDiscount: "",
          endDate: "",
          usageLimit: "",
          isActive: true,
          description: "",
          cashbackEnabled: false,
          cashbackType: "percentage",
          cashbackValue: ""
        });
        fetchDiscounts();
      } else {
        toast.error(data.error || "Failed to create discount");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch(`/api/discounts?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Discount deleted");
        fetchDiscounts();
      }
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const [filterType, setFilterType] = useState("all");

  const filteredDiscounts = discounts.filter(d => {
    const matchesSearch = d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filterType === "cashback") return d.cashbackEnabled;
    if (filterType === "double") return d.cashbackEnabled && Number(d.value) > 0;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-500/10 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
             </div>
             <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500">Revenue Optimization Active</span>
          </div>
          <h1 className="text-5xl font-bold text-foreground uppercase tracking-tighter leading-none">
            Promo <span className="text-foreground/30">Architect</span>
          </h1>
          <p className="text-[11px] text-foreground/50 font-bold uppercase tracking-[0.4em] max-w-xl leading-relaxed">
            Configure dynamic pricing incentives. Manage promo codes, seasonal discounts, and VIP rewards.
          </p>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-foreground text-background h-14 px-10 rounded-2xl font-bold text-[10px] uppercase tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-4"
        >
          <Plus className="w-4 h-4" />
          <span>Generate New Code</span>
        </button>
      </div>

      {/* Stats / Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-3xl border-foreground/[0.03] flex items-center gap-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Tag className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-black">{discounts.length}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">Active Campaigns</div>
          </div>
        </div>
        
        <div className="md:col-span-2 glass-card p-4 rounded-3xl border-foreground/[0.03] flex items-center gap-4">
          <Search className="w-5 h-5 text-foreground/20 ml-2" />
          <input 
            type="text" 
            placeholder="Filter by code or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-foreground/20"
          />
          <div className="h-8 w-px bg-foreground/5" />
          <Filter className="w-5 h-5 text-foreground/20" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-transparent border-none outline-none text-[10px] font-bold uppercase tracking-wider text-foreground/60 cursor-pointer pr-4"
          >
            <option value="all" className="bg-[#0e0e0e] text-foreground">All Codes</option>
            <option value="cashback" className="bg-[#0e0e0e] text-foreground">Cashback Only</option>
            <option value="double" className="bg-[#0e0e0e] text-foreground">Double Discounts</option>
          </select>
        </div>
      </div>

      {/* Discounts List */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border-foreground/[0.03]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-foreground/[0.05] bg-foreground/[0.02]">
                <th className="px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Promo Code</th>
                <th className="px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Configuration</th>
                <th className="px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Validity</th>
                <th className="px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Usage</th>
                <th className="px-8 py-6 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <Clock className="w-8 h-8 animate-spin" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Accessing Secure Vault...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDiscounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <Tag className="w-8 h-8" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">No promotions defined</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDiscounts.map((discount) => (
                  <tr key={discount.id} className="hover:bg-foreground/[0.02] transition-colors group">
                    <td className="px-8 py-8">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <span className="px-4 py-1.5 bg-foreground text-background text-[11px] font-black rounded-lg tracking-widest uppercase">
                            {discount.code}
                          </span>
                          {!discount.isActive && (
                            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-foreground/40 max-w-[150px] truncate">{discount.description || 'No description'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex flex-col gap-1.5">
                        {discount.value > 0 && (
                          <div className="flex items-center gap-2">
                            {discount.type === 'percentage' ? <Percent className="w-3 h-3 text-emerald-500" /> : <Banknote className="w-3 h-3 text-emerald-500" />}
                            <span className="text-[14px] font-black">
                              {discount.type === 'percentage' ? `${discount.value}%` : `₹${discount.value}`}
                            </span>
                            <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-tighter">Off</span>
                          </div>
                        )}
                        {discount.cashbackEnabled && (
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500 animate-pulse" />
                            <span className="text-[12px] font-black text-amber-500">
                              {discount.cashbackType === 'percentage' ? `${discount.cashbackValue}%` : `₹${discount.cashbackValue}`}
                            </span>
                            <span className="text-[8px] font-bold text-amber-500/60 uppercase tracking-wider">Cashback</span>
                            {discount.value > 0 && (
                              <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Double</span>
                            )}
                          </div>
                        )}
                        {discount.value === 0 && !discount.cashbackEnabled && (
                          <span className="text-[11px] font-bold text-foreground/30">Free Tier</span>
                        )}
                        <span className="text-[10px] font-bold text-foreground/30 uppercase">Min Order: ₹{discount.minOrderAmount}</span>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-foreground/70">
                          <Calendar className="w-3 h-3 opacity-30" />
                          <span>{discount.endDate ? format(new Date(discount.endDate), "MMM d, yyyy") : 'Infinite'}</span>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${new Date(discount.endDate) < new Date() ? 'text-red-500/50' : 'text-emerald-500/50'}`}>
                          {discount.endDate && new Date(discount.endDate) < new Date() ? 'Expired' : 'Live'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex flex-col gap-2">
                        <div className="w-24 h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500" 
                            style={{ width: discount.usageLimit ? `${(discount.usageCount / discount.usageLimit) * 100}%` : '5%' }} 
                          />
                        </div>
                        <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">
                          {discount.usageCount} / {discount.usageLimit || '∞'} Redemptions
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-8 text-right">
                      <button 
                        onClick={() => handleDelete(discount.id)}
                        className="p-3 bg-red-500/5 hover:bg-red-500/10 text-red-500/30 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Liquid Glass Morphism Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/60 backdrop-blur-xl"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl glass-card rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.2)] overflow-hidden border-foreground/5"
            >
              <div className="p-10 space-y-8">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black uppercase tracking-tight">Code Generation</h2>
                    <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.2em]">Define incentive logic and constraints</p>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center hover:bg-foreground/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-widest text-foreground/40 ml-1">Promo Identifier</label>
                      <input 
                        required
                        type="text" 
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                        placeholder="SUMMER25"
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-sm font-bold uppercase tracking-widest outline-none focus:border-foreground/20"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-widest text-foreground/40 ml-1">Incentive Type</label>
                      <div className="flex bg-foreground/[0.03] p-1 rounded-2xl border border-foreground/[0.05]">
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, type: 'percentage'})}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${formData.type === 'percentage' ? 'bg-foreground text-background shadow-lg' : 'opacity-40'}`}
                        >Percentage</button>
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, type: 'fixed'})}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${formData.type === 'fixed' ? 'bg-foreground text-background shadow-lg' : 'opacity-40'}`}
                        >Fixed Amount</button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-widest text-foreground/40 ml-1">Value ({formData.type === 'percentage' ? '%' : '₹'})</label>
                      <input 
                        required
                        type="number" 
                        value={formData.value}
                        onChange={(e) => setFormData({...formData, value: e.target.value})}
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-foreground/20"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-widest text-foreground/40 ml-1">Min Order</label>
                      <input 
                        type="number" 
                        value={formData.minOrderAmount}
                        onChange={(e) => setFormData({...formData, minOrderAmount: e.target.value})}
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-foreground/20"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-widest text-foreground/40 ml-1">Max Disc.</label>
                      <input 
                        type="number" 
                        disabled={formData.type === 'fixed'}
                        value={formData.maxDiscount}
                        onChange={(e) => setFormData({...formData, maxDiscount: e.target.value})}
                        placeholder={formData.type === 'fixed' ? 'N/A' : '0'}
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-foreground/20 disabled:opacity-20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-widest text-foreground/40 ml-1">Expiration Date</label>
                      <input 
                        type="date" 
                        value={formData.endDate}
                        onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-foreground/20"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-widest text-foreground/40 ml-1">Usage Limit</label>
                      <input 
                        type="number" 
                        value={formData.usageLimit}
                        onChange={(e) => setFormData({...formData, usageLimit: e.target.value})}
                        placeholder="Infinite"
                        className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-foreground/20"
                      />
                    </div>
                  </div>

                  {/* Cashback settings */}
                  <div className="p-6 rounded-[2rem] bg-foreground/[0.02] border border-foreground/[0.05] space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[12px] font-bold text-foreground">Store Credit Cashback Reward</span>
                        <p className="text-[10px] text-foreground/40 font-medium">Issue store credits cashback upon successful order checkout (valid for 90 days).</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={formData.cashbackEnabled}
                        onChange={(e) => setFormData({...formData, cashbackEnabled: e.target.checked})}
                        className="w-5 h-5 rounded border-foreground/10 text-emerald-500 bg-transparent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                    </div>

                    {formData.cashbackEnabled && (
                      <div className="grid grid-cols-2 gap-6 pt-2">
                        <div className="space-y-3">
                          <label className="text-[9px] font-black uppercase tracking-widest text-foreground/40 ml-1">Cashback Type</label>
                          <div className="flex bg-foreground/[0.03] p-1 rounded-2xl border border-foreground/[0.05]">
                            <button 
                              type="button"
                              onClick={() => setFormData({...formData, cashbackType: 'percentage'})}
                              className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${formData.cashbackType === 'percentage' ? 'bg-foreground text-background shadow-lg' : 'opacity-40'}`}
                            >Percentage</button>
                            <button 
                              type="button"
                              onClick={() => setFormData({...formData, cashbackType: 'fixed'})}
                              className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${formData.cashbackType === 'fixed' ? 'bg-foreground text-background shadow-lg' : 'opacity-40'}`}
                            >Fixed</button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[9px] font-black uppercase tracking-widest text-foreground/40 ml-1">
                            Cashback Value ({formData.cashbackType === 'percentage' ? '%' : '₹'})
                          </label>
                          <input 
                            required={formData.cashbackEnabled}
                            type="number"
                            value={formData.cashbackValue}
                            onChange={(e) => setFormData({...formData, cashbackValue: e.target.value})}
                            className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-foreground/20"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-foreground/40 ml-1">Internal Description</label>
                    <textarea 
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-foreground/[0.03] border border-foreground/[0.05] rounded-[1.5rem] px-6 py-4 text-sm font-medium outline-none focus:border-foreground/20 resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full h-16 bg-foreground text-background rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] hover:scale-[1.01] active:scale-[0.99] transition-all shadow-2xl flex items-center justify-center gap-4 mt-4"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                    Deploy Promotion
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
