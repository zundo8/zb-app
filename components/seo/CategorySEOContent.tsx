interface CategorySEOContentProps {
  slug: 'graphic-tees' | 'tshirts-under-5000' | 'oversized-tees'
}

const content: Record<
  string,
  { heading: string; intro: string; faqs: { q: string; a: string }[] }
> = {
  'graphic-tees': {
    heading: 'Heavyweight Graphic Tees & Streetwear Blanks — Zica Bella®',
    intro:
      'Engineered for the subculture. Zica Bella\'s graphic tees represent a collision of luxury streetwear aesthetics, custom boxy silhouettes, and high-density industrial prints. Each piece is crafted in India from 240+ GSM double-yarn pre-shrunk cotton blanks to deliver the ultimate relaxed drop-shoulder drape that maintains its structure.',
    faqs: [
      {
        q: 'What makes Zica Bella graphic tees different from mass-market brands in India?',
        a: 'Zica Bella graphic tees are built from scratch on custom patterns, not standard pre-made wholesale blanks. We use custom-developed 240+ GSM heavyweight double-yarn cotton, dropped shoulder seams, and tight, double-needle stitched ribbed collars that will not warp after washing. Our graphics are applied using premium, high-density screen printing and screen-puff techniques that resist cracking and fading.',
      },
      {
        q: 'Are Zica Bella streetwear graphic tees available under ₹1000?',
        a: 'Yes, select drops and core streetwear graphic tees start at ₹999, featuring the same premium fabric architecture and custom packaging as our limited-edition capsule collections.',
      },
      {
        q: 'What fabric structure and treatments are used for Zica Bella tees?',
        a: 'We use 100% premium combed cotton, treated with silicon and bio-washes for a soft vintage feel. The fabric is pre-shrunk to ensure consistent fitting and shape retention over years of wear.',
      },
      {
        q: 'How should I wash my Zica Bella graphic tees to preserve the print?',
        a: 'For maximum longevity, we recommend washing our tees inside out in cold water on a gentle cycle, and hang drying them. Avoid direct ironing on the high-density graphic prints.',
      },
    ],
  },
  'tshirts-under-5000': {
    heading: 'Best Streetwear & Oversized Tees Under ₹5000 — Zica Bella®',
    intro:
      'High-end streetwear fabric architecture without the luxury markup. Zica Bella offers a curated range of premium heavyweight graphic tees, boxy fits, and statement apparel priced honestly under ₹5000. No fast fashion shortcuts. Crafted in India with absolute quality control.',
    faqs: [
      {
        q: 'Which are the best premium streetwear brands under ₹5000 in India?',
        a: 'Zica Bella stands out as India\'s premier D2C streetwear label offering luxury-tier heavy cotton blanks under ₹5000. By controlling our entire design-to-production chain in-house, we deliver the same heavyweight loopback fleece and drop-shoulder silhouettes as high-end global brands, but at an honest price.',
      },
      {
        q: 'What quality standards do Zica Bella t-shirts under ₹5000 meet?',
        a: 'Every garment passes a rigid multi-point quality check. We inspect stitch density, seam strength, collar elasticity, and print accuracy to guarantee that your t-shirt holds up as a durable streetwear collector\'s piece.',
      },
      {
        q: 'Is shipping free for Zica Bella orders in India?',
        a: 'Yes, we provide free express shipping across India for all orders above ₹999. Most single oversized tee purchases qualify automatically.',
      },
      {
        q: 'Does Zica Bella support returns and exchanges?',
        a: 'We offer an easy 7-day return and exchange window. If your fit isn\'t exactly how you envisioned, we will arrange a free reverse pickup and offer a replacement size or full refund.',
      },
    ],
  },
  'oversized-tees': {
    heading: 'Boxy Drop-Shoulder Oversized Tees — Zica Bella® India',
    intro:
      'Engineered with a relaxed, slouchy body and dropped shoulders, Zica Bella oversized tees are the ultimate streetwear staple. Crafted from heavy-density 100% cotton blanks, they provide a clean boxy drape that hangs perfectly from XS to 3XL.',
    faqs: [
      {
        q: 'How do Zica Bella oversized tees fit compared to standard t-shirts?',
        a: 'Our oversized tees are custom-patterned to be boxy and loose-fitting with dropped shoulders and longer, wider sleeves. We recommend ordering your true size for the intended streetwear drape, or sizing down if you prefer a standard relaxed fit.',
      },
      {
        q: 'Are the oversized tees unisex?',
        a: 'Yes. All Zica Bella oversized garments are designed with a unisex fit architecture, suited for all body types looking to achieve a structured, modern street style.',
      },
    ],
  },
};

export function CategorySEOContent({ slug }: CategorySEOContentProps) {
  const c = content[slug]
  if (!c) return null

  return (
    <section aria-label="About this collection" style={{ marginTop: '3rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
        {c.heading}
      </h2>
      <p style={{ opacity: 0.75, lineHeight: 1.7, maxWidth: '65ch', marginBottom: '2rem' }}>
        {c.intro}
      </p>

      <div itemScope itemType="https://schema.org/FAQPage">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
          Frequently Asked Questions
        </h3>
        {c.faqs.map((faq) => (
          <div
            key={faq.q}
            itemScope
            itemProp="mainEntity"
            itemType="https://schema.org/Question"
            style={{ marginBottom: '1.25rem' }}
          >
            <h4
              itemProp="name"
              style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}
            >
              {faq.q}
            </h4>
            <div
              itemScope
              itemProp="acceptedAnswer"
              itemType="https://schema.org/Answer"
            >
              <p itemProp="text" style={{ opacity: 0.72, fontSize: '0.875rem', lineHeight: 1.7 }}>
                {faq.a}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
