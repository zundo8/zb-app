"use client";

import { useState } from "react";
import { Tag, Edit2, Check, X, Loader2, Plus } from "lucide-react";
import VariantBadge from "@/components/admin/VariantBadge";

const COMMON_SIZES = ["26", "28", "30", "32", "34", "36", "XS", "S", "M", "L", "XL", "XXL", "Free Size"];

interface InlineSizeSelectorProps {
  size?: string | null;
  variantTitle?: string | null;
  itemId?: string; // Exchange ID, Return ID, or OrderItem ID
  itemType?: "original" | "new" | "return" | "orderItem";
  onUpdateSize?: (newSize: string) => Promise<void>;
  editable?: boolean;
  compact?: boolean;
}

export default function InlineSizeSelector({
  size,
  variantTitle,
  itemId,
  itemType = "orderItem",
  onUpdateSize,
  editable = true,
  compact = false,
}: InlineSizeSelectorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [customSize, setCustomSize] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectSize = async (selectedSize: string) => {
    if (!selectedSize || !onUpdateSize) return;
    setLoading(true);
    setError(null);
    try {
      await onUpdateSize(selectedSize.trim().toUpperCase());
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Failed to update size");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customSize.trim()) {
      handleSelectSize(customSize.trim());
    }
  };

  if (!isEditing) {
    if (size) {
      return (
        <div className="inline-flex items-center gap-1 group relative">
          <VariantBadge size={size} variantTitle={variantTitle} />
          {editable && onUpdateSize && (
            <button
              onClick={() => setIsEditing(true)}
              title="Edit Size"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-foreground/10 text-foreground/50 hover:text-foreground"
            >
              <Edit2 className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      );
    }

    // Missing Size State
    return (
      <div className="inline-flex items-center gap-1">
        {editable && onUpdateSize ? (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 hover:text-amber-400 text-[9px] font-mono font-bold uppercase transition-all shadow-sm"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>Set Size</span>
          </button>
        ) : (
          <span className="px-2 py-0.5 rounded bg-foreground/5 text-foreground/30 text-[9px] font-mono font-medium">
            No size
          </span>
        )}
      </div>
    );
  }

  // Editing Popover State
  return (
    <div className="relative inline-block z-30">
      <div className="absolute top-0 left-0 mt-6 min-w-[240px] p-3 rounded-xl bg-background border border-foreground/15 shadow-2xl space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-foreground/10 pb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60 flex items-center gap-1">
            <Tag className="w-3 h-3 text-amber-500" /> Select Size
          </span>
          <button
            onClick={() => setIsEditing(false)}
            disabled={loading}
            className="p-1 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="py-4 flex items-center justify-center gap-2 text-foreground/50 text-[10px]">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            <span>Updating...</span>
          </div>
        ) : (
          <>
            {/* Quick Sizes Grid */}
            <div className="grid grid-cols-4 gap-1.5 max-h-[140px] overflow-y-auto pr-0.5">
              {COMMON_SIZES.map((sz) => (
                <button
                  key={sz}
                  onClick={() => handleSelectSize(sz)}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all border ${
                    size === sz
                      ? "bg-amber-500 text-black border-amber-500 font-extrabold"
                      : "bg-foreground/[0.04] hover:bg-amber-500/20 text-foreground/80 border-foreground/10 hover:border-amber-500/40"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            {/* Custom Size Form */}
            <form onSubmit={handleCustomSubmit} className="flex gap-1 pt-1 border-t border-foreground/10">
              <input
                type="text"
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                placeholder="Custom size..."
                className="flex-1 bg-foreground/[0.04] border border-foreground/15 rounded px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={!customSize.trim()}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold disabled:opacity-40"
              >
                <Check className="w-3 h-3" />
              </button>
            </form>
          </>
        )}

        {error && (
          <p className="text-[9px] font-bold text-rose-500 pt-1">{error}</p>
        )}
      </div>
    </div>
  );
}
