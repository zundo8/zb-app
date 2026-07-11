import { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import PolicyClient from "./PolicyClient";

interface PolicyPageProps {
  params: {
    handle: string;
  };
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const policy = await prisma.policy.findUnique({
    where: { handle: params.handle },
    select: { title: true }
  });

  if (!policy) return { title: "Policy Not Found - Zica Bella" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com';

  return {
    title: `${policy.title} | Zica Bella - Premium Luxury Streetwear`,
    description: `Official ${policy.title} for Zica Bella luxury streetwear. Crafted with premium loopback fabrics, Italian design elements, and modern architectural standards.`,
    alternates: {
      canonical: `${appUrl}/policies/${params.handle}`
    },
    openGraph: {
      title: `${policy.title} | Zica Bella - Premium Luxury Streetwear`,
      description: `Official ${policy.title} for Zica Bella luxury streetwear.`,
      url: `${appUrl}/policies/${params.handle}`,
      siteName: "Zica Bella",
      locale: "en_IN",
      type: "website"
    }
  };
}

function generateSchema(policy: { handle: string; title: string; content: string; updatedAt: Date }) {
  const isContact = policy.handle === "contact-information";
  
  if (isContact) {
    return {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "ZICA BELLA PRIVATE LIMITED",
      "alternateName": "Zica Bella",
      "url": "https://zicabella.com",
      "logo": "https://zicabella.com/zb-logo-220px.png",
      "contactPoint": [
        {
          "@type": "ContactPoint",
          "telephone": "+91-9220385011",
          "contactType": "customer service",
          "email": "support@zicabella.com",
          "availableLanguage": ["English", "Hindi"]
        },
        {
          "@type": "ContactPoint",
          "telephone": "+91-6002768463",
          "contactType": "customer service",
          "email": "support@zicabella.com",
          "availableLanguage": ["English", "Hindi"]
        }
      ],
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "2207, Tower B, Bhutani Alphathum, Sector 90",
        "addressLocality": "Noida",
        "addressRegion": "Uttar Pradesh",
        "postalCode": "201305",
        "addressCountry": "IN"
      },
      "hoursOfOperation": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday"
        ],
        "opens": "11:00",
        "closes": "19:30"
      },
      "sameAs": [
        "https://www.instagram.com/zica.bella",
        "https://www.youtube.com/@Zicabella"
      ]
    };
  }

  // General policy schema
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": policy.title,
    "description": `Official ${policy.title} for Zica Bella - Luxury Streetwear designed in Italy and crafted in India.`,
    "publisher": {
      "@type": "Organization",
      "name": "Zica Bella",
      "logo": {
        "@type": "ImageObject",
        "url": "https://zicabella.com/zb-logo-220px.png"
      }
    },
    "dateModified": policy.updatedAt.toISOString()
  };
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const [policy, allPolicies] = await Promise.all([
    prisma.policy.findUnique({
      where: { handle: params.handle },
    }),
    prisma.policy.findMany({
      select: { handle: true, title: true },
      orderBy: { title: 'asc' },
    }),
  ]);

  if (!policy) {
    notFound();
  }

  const schema = generateSchema(policy);

  // Serialize policy updatedAt date to string for client boundary transmission
  const serializedPolicy = {
    handle: policy.handle,
    title: policy.title,
    content: policy.content,
    updatedAt: policy.updatedAt.toISOString(),
  };

  const serializedAllPolicies = allPolicies.map((p: any) => ({
    handle: p.handle,
    title: p.title,
  }));

  return (
    <>
      {/* Dynamic JSON-LD Structured Schema for AI & SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <PolicyClient activePolicy={serializedPolicy} allPolicies={serializedAllPolicies} />
    </>
  );
}
