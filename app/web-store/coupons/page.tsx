"use client";

import { useState, useEffect } from "react";
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Sparkles,
  X,
  Save,
  Percent,
  DollarSign,
  Calendar,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderValue: number;
  usageLimit?: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
}

export default function WebStoreCouponsList() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form states
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("0");
  const [usageLimit, setUsageLimit] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/web-store/coupons");
      if (!res.ok) throw new Error("Failed to load coupons");
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const openAddModal = () => {
    setEditingCoupon(null);
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("");
    setMinOrderValue("0");
    setUsageLimit("");
    setValidFrom("");
    setValidUntil("");
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setDiscountType(coupon.discountType);
    setDiscountValue(String(coupon.discountValue));
    setMinOrderValue(String(coupon.minOrderValue));
    setUsageLimit(coupon.usageLimit ? String(coupon.usageLimit) : "");
    
    // Format dates to match datetime-local inputs (YYYY-MM-DDTHH:MM)
    const formatToInputDate = (dateStr: string) => {
      const d = new Date(dateStr);
      const pad = (num: number) => String(num).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setValidFrom(formatToInputDate(coupon.validFrom));
    setValidUntil(formatToInputDate(coupon.validUntil));
    setIsActive(coupon.isActive);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const res = await fetch(`/api/web-store/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: !coupon.isActive,
        }),
      });

      if (!res.ok) throw new Error("Failed to toggle status");
      toast.success(`Coupon ${!coupon.isActive ? "activated" : "deactivated"}`);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || "Error toggling status");
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    try {
      const res = await fetch(`/api/web-store/coupons/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete coupon");
      toast.success("Coupon deleted successfully");
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || "Error deleting coupon");
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !discountType || !discountValue || !validFrom || !validUntil) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitLoading(true);
    try {
      const method = editingCoupon ? "PATCH" : "POST";
      const endpoint = editingCoupon ? `/api/web-store/coupons/${editingCoupon.id}` : "/api/web-store/coupons";

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          discountType,
          discountValue,
          minOrderValue,
          usageLimit: usageLimit || null,
          validFrom,
          validUntil,
          isActive,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save coupon");
      }

      toast.success(editingCoupon ? "Coupon updated successfully" : "Coupon created successfully");
      setIsModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || "Error saving coupon");
    } finally {
      setSubmitLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-inter flex items-center gap-2">
            Coupons & Promos <Sparkles className="w-5 h-5 text-amber-500" />
          </h1>
          <p className="text-[12px] text-foreground/50 mt-1">
            Configure percentages or fixed discounts, minimum values, validity periods, and usage limits.
          </p>
        </div>
        
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 py-3 px-5 rounded-2xl bg-amber-500 text-black text-xs font-bold hover:opacity-95 transition-all shadow-lg shadow-amber-500/10 shrink-0"
        >
          <Plus className="w-4 h-4" /> Create Coupon
        </button>
      </div>

      {/* Coupons grid list */}
      <div className="glass rounded-[2rem] border border-foreground/5 overflow-hidden">
        {loading ? (
          <div className="p-12 space-y-4 animate-pulse">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="h-10 bg-foreground/5 rounded-xl w-full" />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center">
            <Tag className="w-16 h-16 text-foreground/15 mb-4" />
            <h3 className="text-sm font-bold text-foreground mb-1">No Coupons Created</h3>
            <p className="text-xs text-foreground/45 max-w-xs mb-6">Create promotional discount codes to incentivize checkouts on the storefront.</p>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 py-2.5 px-5 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Code
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-foreground/5 text-[10px] font-bold text-foreground/40 uppercase tracking-wider">
                  <th className="py-4 px-6">Promo Code</th>
                  <th className="py-4 px-4">Discount</th>
                  <th className="py-4 px-4">Min. Criteria</th>
                  <th className="py-4 px-4">Usages</th>
                  <th className="py-4 px-4">Validity Range</th>
                  <th className="py-4 px-6 w-12 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {coupons.map((coupon) => (
                  <tr
                    key={coupon.id}
                    className={`group hover:bg-foreground/[0.01] transition-colors ${!coupon.isActive ? "opacity-60" : ""}`}
                  >
                    <td className="py-4 px-6">
                      <span className="font-mono text-[12px] font-bold text-foreground bg-foreground/5 border border-foreground/5 px-2.5 py-1 rounded-xl">
                        {coupon.code}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[12px] font-bold text-foreground">
                      <span className="inline-flex items-center gap-1">
                        {coupon.discountType === "percentage" ? (
                          <><Percent className="w-3.5 h-3.5 text-amber-500" /> {coupon.discountValue}% Off</>
                        ) : (
                          <><DollarSign className="w-3.5 h-3.5 text-amber-500" /> {formatCurrency(coupon.discountValue)} Off</>
                        )}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[11px] font-medium text-foreground/60">
                      {coupon.minOrderValue > 0 ? `Orders above ${formatCurrency(coupon.minOrderValue)}` : "No min criteria"}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-extrabold text-foreground">{coupon.usedCount}</span>
                        <span className="text-[9px] text-foreground/40 mt-0.5 uppercase tracking-wider">
                          Limit: {coupon.usageLimit ? `${coupon.usageLimit} total` : "Unlimited"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col space-y-0.5 text-[10px] text-foreground/60 font-medium">
                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Starts {formatDateTime(coupon.validFrom)}</span>
                        <span className="flex items-center gap-1.5 text-rose-400"><X className="w-3.5 h-3.5 text-rose-500/50" /> Ends {formatDateTime(coupon.validUntil)}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <button
                          onClick={() => handleToggleActive(coupon)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${coupon.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25" : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/25"}`}
                        >
                          {coupon.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => openEditModal(coupon)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center bg-foreground/5 text-foreground/60 border border-foreground/10 hover:bg-foreground/10 hover:text-foreground transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(coupon.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-black transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Coupon Popup Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="glass max-w-xl w-full rounded-[2.5rem] border border-foreground/10 shadow-3xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-foreground/5 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground font-inter">
                    {editingCoupon ? "Edit Discount Coupon" : "Add Discount Coupon"}
                  </h3>
                  <p className="text-[10px] text-foreground/40 mt-1">Configure code parameters, percentage rates, and usage caps.</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center bg-foreground/5 text-foreground/45 hover:text-foreground hover:bg-foreground/10 transition-colors"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Form content */}
              <form onSubmit={handleSaveCoupon} className="p-6 md:p-8 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs font-semibold">
                
                {/* Promo Code input */}
                <div className="space-y-1.5">
                  <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">Coupon Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ZBWEB20"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground font-mono focus:outline-none focus:border-amber-500/30 transition-all"
                    disabled={!!editingCoupon} // Disallow coupon code edits (must delete & recreate)
                    required
                  />
                </div>

                {/* Discount Type & Value */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">Discount Type</label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all appearance-none cursor-pointer"
                    >
                      <option value="percentage" className="bg-[#0e0e0e]">Percentage (%)</option>
                      <option value="fixed" className="bg-[#0e0e0e]">Fixed Amount (₹)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">
                      Discount Value {discountType === "percentage" ? "(%)" : "(₹)"}
                    </label>
                    <input
                      type="number"
                      placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 500"}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Min order criteria & Usage limit */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">Min Order Value (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 1999"
                      value={minOrderValue}
                      onChange={(e) => setMinOrderValue(e.target.value)}
                      className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">Usage Limit (Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 100 uses"
                      value={usageLimit}
                      onChange={(e) => setUsageLimit(e.target.value)}
                      className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all"
                    />
                  </div>
                </div>

                {/* Validity dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">Valid From</label>
                    <input
                      type="datetime-local"
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-foreground/45 text-[10px] font-bold uppercase tracking-wider block">Valid Until</label>
                    <input
                      type="datetime-local"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500/30 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Active Toggle status */}
                <div className="flex items-center justify-between p-4 bg-foreground/[0.02] border border-foreground/5 rounded-2xl">
                  <div>
                    <span className="text-[12px] font-bold text-foreground">Activate Code</span>
                    <p className="text-[10px] text-foreground/40 mt-1">If enabled, customers can apply this code at checkout.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-amber-500 bg-transparent border-foreground/20 focus:ring-0 focus:ring-offset-0 w-5 h-5 cursor-pointer"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-foreground/5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-3 rounded-xl text-foreground/60 bg-foreground/5 hover:bg-foreground/10 transition-colors font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-black hover:opacity-95 transition-opacity font-bold"
                  >
                    <Save className="w-4 h-4" /> {submitLoading ? "Saving Coupon..." : "Save Coupon"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
