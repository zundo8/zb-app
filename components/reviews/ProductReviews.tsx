import { getProductAggregateRating, getProductReviews } from '@/lib/reviews/getProductAggregateRating';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`text-[10px] ${
            star <= rating
              ? 'text-amber-400'
              : 'text-foreground/10'
          }`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export async function ProductReviews({
  productId,
}: {
  productId: string;
}) {
  const [aggregate, reviews] = await Promise.all([
    getProductAggregateRating(productId),
    getProductReviews(productId, { limit: 10 }),
  ]);

  if (!aggregate || reviews.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Customer Reviews"
      className="mt-8 space-y-4"
    >
      {/* Summary */}
      <div className="flex items-center gap-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/50">
          Customer Reviews
        </h3>
        <div className="flex items-center gap-1.5">
          <StarRating rating={Math.round(aggregate.value)} />
          <span className="text-[9px] text-foreground/40">
            {aggregate.value} ({aggregate.count}{' '}
            {aggregate.count === 1 ? 'review' : 'reviews'})
          </span>
        </div>
      </div>

      {/* Review List */}
      <div className="space-y-3">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="p-3 rounded-lg border border-foreground/[0.04] bg-foreground/[0.01]"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <StarRating rating={review.rating} />
                {review.verifiedPurchase && (
                  <span className="text-[7px] font-bold uppercase tracking-wider text-emerald-500/70 bg-emerald-500/5 px-1.5 py-0.5 rounded-full">
                    Verified Buyer
                  </span>
                )}
              </div>
              <span className="text-[8px] text-foreground/25">
                {formatDate(review.createdAt)}
              </span>
            </div>
            {review.title && (
              <p className="text-[9.5px] font-semibold text-foreground/70 mb-0.5">
                {review.title}
              </p>
            )}
            <p className="text-[9px] text-foreground/50 leading-relaxed">
              {review.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
