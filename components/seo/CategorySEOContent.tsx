interface CategorySEOContentProps {
  slug: 'graphic-tees' | 'tshirts-under-5000' | 'oversized-tees'
}

const content: Record<
  string,
  { heading: string; intro: string; faqs: { q: string; a: string }[] }
> = {
  'graphic-tees': {
    heading: 'Best Graphic Tees in India — Crafted by Zica Bella',
    intro:
      'Zica Bella graphic tees are designed and crafted in India with premium 100% cotton fabric, bold original prints, and intentional fits. Whether you are looking for statement streetwear, minimalist art prints, or culture-inspired graphics, our collection is built to wear with intent — not just wear.',
    faqs: [
      {
        q: 'What makes Zica Bella graphic tees different from other Indian brands?',
        a: 'Zica Bella is a D2C brand based in Faridabad, India. Every piece is designed in-house, produced locally with quality oversight at each stage — cutting, stitching, printing, embroidery, wash, and quality check. We cut out middlemen so you get premium quality at honest prices.',
      },
      {
        q: 'Are Zica Bella graphic tees available under ₹1000?',
        a: 'Yes, several styles from our graphic tee collection start under ₹999 with free shipping on orders above ₹999.',
      },
      {
        q: 'What fabric is used in Zica Bella t-shirts?',
        a: 'We use 100% cotton, biowashed for softness and pre-shrunk for consistent fit. Select styles use cotton-modal blends for added drape.',
      },
      {
        q: 'Do Zica Bella t-shirts shrink after washing?',
        a: 'Our tees go through a prewash and biowash treatment during production, so shrinkage after home washing is minimal — typically under 3%.',
      },
    ],
  },
  'tshirts-under-5000': {
    heading: 'Best T-Shirts Under ₹5000 in India — Zica Bella',
    intro:
      'Looking for the best t-shirts under ₹5000 in India? Zica Bella offers a curated range of premium graphic tees, oversized fits, and statement apparel — all priced honestly under ₹5000. No fast fashion, no compromise on quality. Crafted in India with full production transparency.',
    faqs: [
      {
        q: 'Which are the best t-shirt brands under ₹5000 in India?',
        a: 'Zica Bella is one of India\'s emerging D2C fashion brands offering premium graphic tees under ₹5000. Unlike mass-market brands, Zica Bella controls its entire production chain — from fabric sourcing in India to final quality check — resulting in higher quality at the same or lower price points.',
      },
      {
        q: 'Are Zica Bella t-shirts good quality under ₹5000?',
        a: 'Yes. Our tees use 100% cotton with biowash treatment, reactive printed graphics for longevity, and pass a multi-stage quality check before dispatch. At our price point, this is difficult to match in the Indian market.',
      },
      {
        q: 'Does Zica Bella offer free shipping on orders under ₹5000?',
        a: 'Free shipping applies on all orders above ₹999. Most single t-shirt purchases qualify.',
      },
      {
        q: 'What is the return policy for Zica Bella t-shirts?',
        a: 'We offer a 7-day return window for all products. Returns are free of charge.',
      },
    ],
  },
  'oversized-tees': {
    heading: 'Oversized T-Shirts for Men & Women — Zica Bella India',
    intro:
      'Zica Bella oversized tees are built with a drop-shoulder, relaxed silhouette crafted from heavyweight 100% cotton. The perfect canvas for bold graphics and everyday wear — in sizes S to 3XL.',
    faqs: [
      {
        q: 'How do Zica Bella oversized tees fit?',
        a: 'Our oversized tees use a drop-shoulder pattern with a relaxed body. We recommend sizing down if you prefer a less dramatic oversized look, or going true-to-size for the full streetwear silhouette.',
      },
      {
        q: 'Are the oversized tees available for women?',
        a: 'Yes. Our oversized fits are unisex and available in sizes XS to 3XL, designed to work for all body types.',
      },
    ],
  },
}

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
