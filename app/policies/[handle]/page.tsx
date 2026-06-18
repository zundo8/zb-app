import { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import Link from "next/link";
import { Mail, Phone, MapPin, Clock, Info, FileText, Globe } from "lucide-react";

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

  return {
    title: `${policy.title} - Zica Bella`,
    description: `Official ${policy.title} for Zica Bella luxury streetwear. Crafted with premium details and modern architectural standards.`,
    alternates: {
      canonical: `https://zicabella.com/policies/${params.handle}`
    },
    openGraph: {
      title: `${policy.title} - Zica Bella`,
      description: `Official ${policy.title} for Zica Bella luxury streetwear.`,
      url: `https://zicabella.com/policies/${params.handle}`,
      siteName: "Zica Bella",
      locale: "en_US",
      type: "website"
    }
  };
}

function getIconForLabel(label: string) {
  const l = label.toLowerCase();
  if (l.includes("email")) return <Mail className="w-4 h-4 text-zinc-400" />;
  if (l.includes("address") || l.includes("location") || l.includes("physical") || l.includes("office")) return <MapPin className="w-4 h-4 text-zinc-400" />;
  if (l.includes("phone") || l.includes("call") || l.includes("contact") || l.includes("support")) return <Phone className="w-4 h-4 text-zinc-400" />;
  if (l.includes("hours") || l.includes("time") || l.includes("days")) return <Clock className="w-4 h-4 text-zinc-400" />;
  if (l.includes("name") || l.includes("trade") || l.includes("company")) return <Info className="w-4 h-4 text-zinc-400" />;
  if (l.includes("social") || l.includes("instagram") || l.includes("youtube")) return <Globe className="w-4 h-4 text-zinc-400" />;
  return <FileText className="w-4 h-4 text-zinc-400" />;
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

function parseAndFormatPolicyContent(content: string) {
  const trimmedContent = content.trim();

  // If it already contains HTML tags, render it as raw HTML
  if (trimmedContent.startsWith("<")) {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }

  // Split content by double newlines into blocks
  const blocks = content.split(/\r?\n\r?\n/);
  const elements: React.ReactNode[] = [];
  let currentCardGrid: { label: string; value: string }[] = [];

  const flushGrid = (key: string | number) => {
    if (currentCardGrid.length > 0) {
      elements.push(
        <div key={`grid-${key}`} className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
          {currentCardGrid.map((card, cIdx) => (
            <div 
              key={cIdx} 
              className="glass-panel rounded-2xl p-5 hover:scale-[1.01] hover:border-foreground/15 dark:hover:border-white/20 transition-all duration-300 shadow-sm flex items-start gap-4 min-w-0"
            >
              <div className="p-3 rounded-xl bg-foreground/[0.03] dark:bg-white/[0.03] border border-foreground/[0.05] dark:border-white/[0.05] text-foreground/75 shrink-0 flex items-center justify-center">
                {getIconForLabel(card.label)}
              </div>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-[9px] font-bold text-foreground/35 dark:text-white/35 uppercase tracking-[0.25em]">{card.label}</span>
                <span className="text-xs md:text-sm font-semibold text-foreground/80 dark:text-white/80 leading-relaxed whitespace-pre-line break-words">{card.value}</span>
              </div>
            </div>
          ))}
        </div>
      );
      currentCardGrid = [];
    }
  };

  blocks.forEach((block, idx) => {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) return;

    const lines = trimmedBlock.split("\n").map(l => l.trim());

    // 1. Detect block key-value pairs (e.g. "Trade Name:\nZICA BELLA PRIVATE LIMITED")
    if (lines[0].endsWith(":") && lines.length > 1) {
      const label = lines[0].slice(0, -1).trim();
      const value = lines.slice(1).join("\n").trim();
      currentCardGrid.push({ label, value });
      return;
    }

    // 2. Detect individual line key-value pairs (e.g. "Phone: +91 9220385011\nEmail: support@zicabella.com")
    const isAllKeyValue = lines.every(line => {
      const colonIdx = line.indexOf(":");
      return colonIdx > 0 && colonIdx < 30; // label is short
    });

    if (isAllKeyValue && lines.length > 0) {
      lines.forEach(line => {
        const colonIdx = line.indexOf(":");
        const label = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        currentCardGrid.push({ label, value });
      });
      return;
    }

    // If it's not a card element, we must flush any accumulated cards first
    flushGrid(idx);

    // 3. Detect lists (lines starting with -, *, •)
    const isList = lines.every(line => line.startsWith("-") || line.startsWith("*") || line.startsWith("•"));
    if (isList) {
      elements.push(
        <ul key={idx} className="space-y-3.5 pl-2 my-6">
          {lines.map((line, lIdx) => {
            const itemText = line.replace(/^[-*•]\s*/, "").trim();
            return (
              <li key={lIdx} className="flex items-start gap-3 text-xs md:text-sm text-foreground/70 dark:text-white/70 leading-[1.7]">
                <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-foreground/30 dark:bg-white/30 shrink-0" />
                <span className="flex-1 font-light">{itemText}</span>
              </li>
            );
          })}
        </ul>
      );
      return;
    }

    // 4. Detect subheadings (short, single-line, no period at end, or starts with ##)
    const isMarkdownSubheading = trimmedBlock.startsWith("##") || trimmedBlock.startsWith("###") || trimmedBlock.startsWith("####");
    const isHeading = isMarkdownSubheading || (trimmedBlock.length < 60 && !trimmedBlock.endsWith(".") && !trimmedBlock.endsWith(":") && lines.length === 1);
    
    if (isHeading) {
      const headingText = trimmedBlock.replace(/^#+\s*/, "").trim();
      elements.push(
        <div key={idx} className="space-y-2 pt-6 border-b border-foreground/[0.05] dark:border-white/[0.05] pb-2.5 my-4">
          <h2 className="text-xs md:text-sm font-bold uppercase tracking-[0.25em] text-foreground/90 dark:text-white/90">
            {headingText}
          </h2>
        </div>
      );
      return;
    }

    // 5. Normal paragraphs
    // Clean markdown bold syntax if present
    const cleanBlock = trimmedBlock.replace(/\*\*/g, "");
    elements.push(
      <p key={idx} className="text-xs md:text-sm text-foreground/60 dark:text-white/70 leading-[1.85] font-light whitespace-pre-line my-4">
        {cleanBlock}
      </p>
    );
  });

  // Flush any remaining cards
  flushGrid("end");

  return <div className="space-y-6 text-foreground/80 dark:text-white/80">{elements}</div>;
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

  return (
    <main className="min-h-screen pt-28 md:pt-36 pb-24 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto relative z-10">
      {/* Dynamic JSON-LD Structured Schema for AI & SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Ambient glass glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-foreground/[0.02] dark:from-white/[0.01] via-transparent to-transparent blur-[140px] pointer-events-none rounded-full z-0" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
        
        {/* ─── Sidebar (Desktop) ─── */}
        <aside className="hidden lg:block lg:col-span-3 sticky top-28 h-fit self-start z-20">
          <div className="apple-glass-capsule p-6 space-y-5 rounded-[2rem]">
            <div className="space-y-1 border-b border-foreground/10 dark:border-white/10 pb-3">
              <span className="text-[7px] font-bold text-foreground/25 dark:text-white/30 uppercase tracking-[0.35em]">DIRECTORY</span>
              <h3 className="text-[10px] font-bold text-foreground dark:text-white uppercase tracking-[0.2em] leading-none">
                Legal Policies
              </h3>
            </div>
            
            <nav>
              <ul className="space-y-2">
                {allPolicies.map((p) => (
                  <li key={p.handle}>
                    <Link
                      href={`/policies/${p.handle}`}
                      className={`text-[9px] font-bold uppercase tracking-[0.2em] block transition-all duration-300 py-3 px-4 rounded-xl border ${
                        p.handle === params.handle
                          ? "bg-foreground text-background dark:bg-white dark:text-black border-foreground font-black shadow-lg"
                          : "text-foreground/45 dark:text-white/45 hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.03] dark:hover:bg-white/[0.03] border-transparent"
                      }`}
                    >
                      {p.title.replace(/\s*\(.*\)\s*/, "")}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        {/* ─── Mobile Horizontal Nav ─── */}
        <div className="lg:hidden col-span-1 mb-4 z-20">
          <div className="apple-glass-capsule p-4 rounded-[1.5rem]">
            <span className="text-[7px] font-bold text-foreground/25 dark:text-white/30 uppercase tracking-[0.35em] block mb-2.5 px-1">Other Policies</span>
            <div className="flex gap-2 overflow-x-auto ios-scroll hide-scrollbar py-0.5 scroll-pl-1">
              {allPolicies.map((p) => (
                <Link
                  key={p.handle}
                  href={`/policies/${p.handle}`}
                  className={`text-[8px] font-bold uppercase tracking-[0.2em] shrink-0 px-4 py-2.5 rounded-full border transition-all ${
                    p.handle === params.handle
                      ? "bg-foreground text-background dark:bg-white dark:text-black border-foreground shadow-md font-black"
                      : "bg-foreground/[0.02] dark:bg-white/[0.02] text-foreground/45 dark:text-white/45 border-foreground/[0.06] dark:border-white/[0.06] hover:text-foreground dark:hover:text-white hover:bg-foreground/[0.04] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  {p.title.replace(/\s*\(.*\)\s*/, "")}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Content ─── */}
        <div className="lg:col-span-9 z-10">
          <article 
            className="apple-glass-capsule rounded-[2rem] md:rounded-[2.5rem] p-6 sm:p-10 md:p-14 relative overflow-hidden group transition-all duration-500 shadow-2xl border border-foreground/[0.05]"
          >
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 dark:from-white/[0.01] to-transparent pointer-events-none rounded-[2rem] md:rounded-[2.5rem]" />

            <div className="relative z-10">
              <header className="mb-10">
                <div className="inline-block px-3 py-1 rounded-full border border-foreground/[0.04] dark:border-white/[0.06] bg-foreground/[0.01] dark:bg-white/[0.02] mb-4">
                  <span className="text-[7px] md:text-[8px] font-bold tracking-[0.3em] uppercase text-foreground/30 dark:text-white/40">
                    Zica Bella Legal Document
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading tracking-[0.12em] font-black text-foreground dark:text-white mb-4 uppercase leading-tight">
                  {policy.title}
                </h1>
                <div className="h-px w-16 bg-gradient-to-r from-foreground/20 dark:from-white/25 to-transparent mb-4" />
                <p className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] font-semibold text-foreground/25 dark:text-white/35">
                  Last Updated: {new Date(policy.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </header>

              {/* Policy Content Formatter */}
              {parseAndFormatPolicyContent(policy.content)}
            </div>
          </article>

          {/* Quick Support Link block on policy pages */}
          <div className="mt-6 p-6 rounded-3xl apple-glass-capsule border border-foreground/[0.05] dark:border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground dark:text-white">Need help or clarification?</h4>
              <p className="text-[9px] text-foreground/45 dark:text-white/45 uppercase tracking-[0.1em] mt-1">Get in touch with our client support center.</p>
            </div>
            <Link 
              href="/support"
              className="px-6 py-2.5 rounded-full bg-foreground dark:bg-white text-background dark:text-black hover:opacity-90 active:scale-95 text-[9px] font-bold tracking-[0.2em] uppercase transition-all shadow-md"
            >
              Contact Support
            </Link>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[7px] font-semibold uppercase tracking-[0.3em] text-foreground/15 dark:text-white/20 leading-relaxed">
              © 2026 Zica Bella · Luxury Streetwear · Designed in Italy · Crafted in India
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
