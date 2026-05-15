import { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";

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
  const policy = await prisma.policy.findUnique({
    where: { handle: params.handle },
  });

  if (!policy) {
    notFound();
  }

  return (
    <main className="min-h-screen pt-32 pb-24 px-6 md:px-12 max-w-4xl mx-auto">
      <div className="glass p-8 md:p-12 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden group">
        {/* Subtle background gradient effect */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/10 transition-colors duration-1000" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/10 transition-colors duration-1000" />

        <div className="relative z-10">
          <header className="mb-12">
            <div className="inline-block px-4 py-1.5 rounded-full glass mb-6 border border-white/5">
              <span className="text-[10px] font-rocaston tracking-[0.3em] uppercase text-muted-foreground">
                Zica Bella · Legal
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-rocaston tracking-tight text-foreground mb-4 uppercase">
              {policy.title}
            </h1>
            <div className="h-px w-24 bg-gradient-to-r from-primary/50 to-transparent mb-6" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
              Last Updated: {new Date(policy.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </header>

          <div 
            className="prose prose-sm md:prose-base prose-invert max-w-none text-muted-foreground/90 leading-relaxed font-light
              prose-headings:font-rocaston prose-headings:text-foreground prose-headings:uppercase prose-headings:tracking-widest
              prose-strong:text-foreground prose-strong:font-medium
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline transition-all
              prose-ul:list-disc prose-ol:list-decimal"
            dangerouslySetInnerHTML={{ __html: policy.content }}
          />
        </div>
      </div>

      <div className="mt-12 text-center">
        <p className="text-[10px] font-light uppercase tracking-[0.3em] text-muted-foreground/30">
          © 2026 Zica Bella Luxury Streetwear
        </p>
      </div>
    </main>
  );
}
