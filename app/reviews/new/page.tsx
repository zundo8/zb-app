"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Star, CheckCircle2, ShoppingBag, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import WriteReviewForm from "@/components/reviews/WriteReviewForm";

type ReviewableItem = {
  productId: string;
  title: string;
  image: string | null;
  reviewed?: boolean;
};

function ReviewSubmissionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReviewableItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReviewableItems() {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          const order = data.order || data;
          if (order && order.items) {
            setItems(
              order.items.map((item: any) => ({
                productId: item.productId || item.id,
                title: item.title || item.name,
                image: item.image || item.featuredImage || null,
              }))
            );
          }
        } else {
          setError("Order not found or invalid order ID");
        }
      } catch (err) {
        console.error("Error loading order for review:", err);
        setError("Failed to load order items. Please log in or check your account.");
      } finally {
        setLoading(false);
      }
    }

    loadReviewableItems();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-foreground">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
        <p className="text-xs text-foreground/60">Loading your purchased items...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Back button */}
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1.5 text-xs text-foreground/50 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to My Orders</span>
      </Link>

      <div className="space-y-2 border-b border-foreground/10 pb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">Leave a Product Review</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            Verified Customer
          </span>
        </div>
        <p className="text-xs text-foreground/60">
          {orderId
            ? `Sharing feedback for Order #${orderId}. Your honest opinion helps fellow shoppers.`
            : "Select a product you have purchased to submit your review."}
        </p>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 rounded-2xl bg-foreground/[0.02] border border-foreground/10 text-center space-y-3">
          <ShoppingBag className="w-10 h-10 text-foreground/30 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">No Items Found to Review</h3>
          <p className="text-xs text-foreground/50 max-w-sm mx-auto">
            Please log in to your account or view your recent delivered orders to write a review.
          </p>
          <Link
            href="/account/orders"
            className="inline-block mt-2 px-5 py-2 rounded-xl bg-foreground text-background text-xs font-bold transition-opacity hover:opacity-90"
          >
            View My Orders
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <div
              key={item.productId}
              className="p-5 rounded-2xl bg-foreground/[0.02] border border-foreground/10 space-y-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-foreground/5 overflow-hidden relative shrink-0 border border-foreground/10">
                  {item.image ? (
                    <Image src={item.image} alt={item.title} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-foreground/30">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                  <p className="text-[10px] text-foreground/40 mt-0.5">Product ID: {item.productId}</p>
                </div>
              </div>

              <WriteReviewForm
                productId={item.productId}
                orderId={orderId || `ORDER-${Date.now()}`}
                productTitle={item.title}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewNewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-foreground">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <p className="text-xs text-foreground/60">Loading review form...</p>
        </div>
      }
    >
      <ReviewSubmissionContent />
    </Suspense>
  );
}
