import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { Metadata } from "next";

interface BlogPostProps {
  params: {
    slug: string;
  };
}

export const revalidate = 300;

// Generate dynamic SEO metadata for search engines and crawlers
export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug },
  });

  if (!post || !post.published) {
    return {};
  }

  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || "";
  const robots = post.indexPref === false ? "noindex, nofollow" : "index, follow";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zicabella.com';

  return {
    title,
    description,
    robots,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${siteUrl}/blogs/${post.slug}`,
      images: post.coverImage ? [{ url: post.coverImage }] : [{ url: `${siteUrl}/og-image.jpg` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.coverImage ? [post.coverImage] : [`${siteUrl}/og-image.jpg`],
    }
  };
}

function getShortUrl(url: string) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export default async function BlogPostPage({ params }: BlogPostProps) {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug },
  });

  if (!post || !post.published) {
    notFound();
  }

  // Basic styling for the HTML content to match minimal Apple design
  const contentStyles = `
    .prose {
      font-family: inherit;
      white-space: pre-line;
    }
    .prose h1, .prose h2, .prose h3 {
      font-family: inherit;
      letter-spacing: -0.02em;
      margin-top: 3rem;
      margin-bottom: 1.5rem;
      font-weight: 500;
      color: hsl(var(--foreground));
    }
    .prose h2 { font-size: 1.5rem; }
    .prose p {
      margin-bottom: 1.5rem;
      line-height: 1.8;
      font-weight: 300;
      color: hsl(var(--foreground) / 0.8);
    }
    .prose img {
      width: 100%;
      border-radius: 1.5rem;
      margin: 3rem 0;
      border: 1px solid hsl(var(--foreground) / 0.05);
    }
    .prose strong {
      font-weight: 500;
      color: hsl(var(--foreground));
    }
    .prose blockquote {
      border-left: 2px solid hsl(var(--foreground) / 0.1);
      padding-left: 1.5rem;
      font-style: italic;
      color: hsl(var(--foreground) / 0.6);
      margin: 2rem 0;
    }
  `;

  return (
    <div className="min-h-screen bg-transparent text-foreground selection:bg-foreground selection:text-background flex flex-col">
      
      <main className="flex-1 pt-32 pb-32 font-sans">
        <article className="max-w-3xl mx-auto px-6 sm:px-12 w-full">
          {/* Back Link */}
          <Link 
            href="/blogs" 
            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium text-muted-foreground/60 hover:text-foreground transition-colors mb-16"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Journal
          </Link>

          {/* Header */}
          <header className="space-y-6 mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
              <span>{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <span className="w-1 h-1 rounded-full bg-foreground/10" />
              <span>{post.author}</span>
            </div>
            
            <h1 className="font-sans text-4xl sm:text-5xl md:text-6xl tracking-tight leading-tight font-medium">
              {post.title}
            </h1>
            
            {post.excerpt && (
              <p className="text-lg sm:text-xl text-muted-foreground font-light leading-relaxed mt-4">
                {post.excerpt}
              </p>
            )}
          </header>

          {/* Cover Image */}
          {post.coverImage && (
            <div className="mb-16">
              {post.backlinkUrl ? (
                <a 
                  href={post.backlinkUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="block group/cover"
                >
                  <div className="w-full aspect-video rounded-[2rem] overflow-hidden border border-foreground/5 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 relative bg-foreground/[0.02] glass transition-transform duration-500 group-hover/cover:scale-[1.005]">
                    <Image 
                      src={post.coverImage} 
                      alt={post.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 768px"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-105"
                    />
                  </div>
                  <div className="mt-4 px-2 flex items-center justify-between text-[9px] uppercase tracking-wider font-sans text-muted-foreground/50">
                    <span>Source Reference</span>
                    <span className="font-bold hover:text-foreground transition-colors underline underline-offset-4 decoration-foreground/20">
                      {getShortUrl(post.backlinkUrl)}
                    </span>
                  </div>
                </a>
              ) : (
                <div className="w-full aspect-video rounded-[2rem] overflow-hidden border border-foreground/5 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 relative bg-foreground/[0.02] glass">
                  <Image 
                    src={post.coverImage} 
                    alt={post.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 768px"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          )}

          {/* Post Content */}
          <style dangerouslySetInnerHTML={{ __html: contentStyles }} />
          <div 
            className="prose prose-lg max-w-none animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 font-sans"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          <div className="mt-24 pt-12 border-t border-foreground/5 text-center animate-in fade-in">
             <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground/40 font-medium">The Zica Bella Archive</p>
          </div>
        </article>
      </main>
    </div>
  );
}
