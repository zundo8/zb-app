import { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import Link from "next/link";

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
    description: `Official ${policy.title} for Zica Bella luxury streetwear.`,
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

  return (
    <main className="min-h-screen pt-28 md:pt-36 pb-24 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto relative z-10">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-foreground/[0.02] via-transparent to-transparent blur-[140px] pointer-events-none rounded-full z-0" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
        
        {/* ─── Sidebar (Desktop) ─── */}
        <aside className="hidden lg:block lg:col-span-3 sticky top-28 h-fit self-start">
          <div className="rounded-[1.75rem] p-6 space-y-5 transition-colors duration-500 bg-white/50 dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06]"
            style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
          >
            <div className="space-y-1 border-b border-black/[0.04] dark:border-white/[0.06] pb-3">
              <span className="text-[7px] font-bold text-foreground/25 uppercase tracking-[0.35em]">DIRECTORY</span>
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.2em] leading-none">
                Legal Policies
              </h3>
            </div>
            
            <nav>
              <ul className="space-y-3">
                {allPolicies.map((p) => (
                  <li key={p.handle}>
                    <Link
                      href={`/policies/${p.handle}`}
                      className={`text-[9px] font-bold uppercase tracking-[0.18em] block transition-all duration-300 hover:translate-x-1 ${
                        p.handle === params.handle
                          ? "text-foreground font-black border-l-2 border-foreground pl-3"
                          : "text-foreground/35 hover:text-foreground/70 pl-3"
                      }`}
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        {/* ─── Mobile Horizontal Nav ─── */}
        <div className="lg:hidden col-span-1 mb-2">
          <div className="rounded-[1.25rem] p-3 bg-white/40 dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06]"
            style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          >
            <span className="text-[7px] font-bold text-foreground/25 uppercase tracking-[0.35em] block mb-2 px-1">Other Policies</span>
            <div className="flex gap-2 overflow-x-auto ios-scroll hide-scrollbar py-0.5 scroll-pl-1">
              {allPolicies.map((p) => (
                <Link
                  key={p.handle}
                  href={`/policies/${p.handle}`}
                  className={`text-[8px] font-bold uppercase tracking-[0.18em] shrink-0 px-3.5 py-1.5 rounded-full border transition-all ${
                    p.handle === params.handle
                      ? "bg-foreground text-background border-foreground shadow-sm"
                      : "bg-foreground/[0.02] text-foreground/40 border-foreground/[0.06] hover:text-foreground"
                  }`}
                >
                  {p.title}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Content ─── */}
        <div className="lg:col-span-9">
          <div 
            className="rounded-[2rem] md:rounded-[2.5rem] p-6 sm:p-10 md:p-14 relative overflow-hidden group transition-colors duration-500 bg-white/50 dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] shadow-lg"
            style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
          >
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 dark:from-white/[0.02] to-transparent pointer-events-none rounded-[2rem] md:rounded-[2.5rem]" />

            <div className="relative z-10">
              <header className="mb-10">
                <div className="inline-block px-3 py-1 rounded-full border border-foreground/[0.04] bg-foreground/[0.01] mb-4">
                  <span className="text-[7px] md:text-[8px] font-bold tracking-[0.3em] uppercase text-foreground/30">
                    Zica Bella Legal Document
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading tracking-[0.12em] font-black text-foreground mb-4 uppercase leading-tight">
                  {policy.title}
                </h1>
                <div className="h-px w-16 bg-gradient-to-r from-foreground/20 to-transparent mb-4" />
                <p className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] font-semibold text-foreground/25">
                  Last Updated: {new Date(policy.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </header>

              {/* Policy Content */}
              <div 
                className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-foreground/60 dark:text-foreground/70 leading-[1.85] font-light
                  prose-headings:font-heading prose-headings:text-foreground prose-headings:uppercase prose-headings:tracking-widest prose-headings:font-black prose-headings:mt-10 prose-headings:mb-4
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-a:text-foreground prose-a:underline prose-a:underline-offset-4 hover:prose-a:opacity-80
                  prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-4
                  prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-4
                  prose-li:mb-2
                  prose-p:mb-4"
                dangerouslySetInnerHTML={{ __html: policy.content }}
              />
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[7px] font-semibold uppercase tracking-[0.3em] text-foreground/15 leading-relaxed">
              © 2026 Zica Bella · Luxury Streetwear · Designed in India
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
