import prisma from "@/lib/db";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

export const revalidate = 3600; // ISR: revalidate every 1 hour

export default async function BlogsPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-transparent text-foreground selection:bg-foreground selection:text-background flex flex-col">
      
      <main className="flex-1 pt-32 pb-24 px-6 sm:px-12 max-w-7xl mx-auto w-full">
        {/* Header text */}
        <div className="mb-20 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 font-sans">
          <h1 className="font-sans text-4xl sm:text-5xl md:text-6xl tracking-tight font-medium">
            The Journal
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base font-light leading-relaxed max-w-lg">
            Thoughts, design philosophies, and cultural commentary from the Zica Bella archives. Dive into our latest editorials.
          </p>
        </div>

        {/* Blogs Grid */}
        {posts.length === 0 ? (
          <div className="py-32 text-center text-muted-foreground font-light tracking-widest uppercase text-xs">
            No journal entries published yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post, index) => (
              <Link 
                key={post.id} 
                href={`/blogs/${post.slug}`}
                className="group flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8"
                style={{ animationDelay: `${index * 150}ms`, animationFillMode: "both" }}
              >
                {/* Image Handle */}
                <div className="w-full aspect-[4/5] bg-foreground/[0.02] border border-foreground/5 rounded-[2rem] overflow-hidden relative glass">
                  {post.coverImage ? (
                    <Image 
                      src={post.coverImage} 
                      alt={post.title} 
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-8 text-center transition-transform duration-700 group-hover:scale-105">
                      <p className="font-sans text-lg tracking-widest font-medium text-foreground/40 dark:text-foreground/20">
                        Z.B. ARTICLE
                      </p>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-3 px-2 font-sans">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/60">
                      {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <h2 className="font-sans text-xl sm:text-2xl tracking-tight font-medium leading-tight group-hover:text-foreground/80 transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  <p className="text-sm text-muted-foreground font-light leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-foreground opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    Read Article <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
