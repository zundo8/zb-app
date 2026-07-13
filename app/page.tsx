import { fetchProducts, fetchEnabledCollections, fetchPolicies, fetchCollectionByHandle } from "@/lib/shopify-admin";
import prisma, { getStoreSettings } from "@/lib/db";
import NextImage from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Instagram, Youtube, Music2, Disc } from "lucide-react";
import CollectionCarousel from "@/components/CollectionCarousel";
import ProductCard from "@/components/ProductCard";
import { ShopifyProduct } from "@/lib/shopify-admin";
import FeaturedUsersSection from "@/components/FeaturedUsersSection";
import HeroVideo from "@/components/HeroVideo";
import FlipbookSection from "@/components/FlipbookSection";
import RingCarouselSection from "@/components/RingCarouselSection";
import SpotlightSection from "@/components/SpotlightSection";
import LazyVideo from "@/components/LazyVideo";
import { handleImageError } from "@/components/ImagePlaceholder";
import { Metadata } from "next";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings('homepage');
  const title = settings?.homePageTitle || 'Zica Bella® | Premium Streetwear, Heavyweight Hoodies & Oversized Tees';
  const description = settings?.metaDescription || 'Zica Bella crafts luxury Indian streetwear for modern men, oversized heavyweight tees, acid-wash finishes, cargos and modern denim designed for bold everyday style.';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com';
  const imageUrl = settings?.socialImageUrl || `${appUrl}/og-image.jpg`;
  const twitterCardType = settings?.twitterCardType || 'summary_large_image';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: settings?.socialImageAlt || title,
        }
      ],
      url: appUrl,
      siteName: 'Zica Bella',
      type: 'website',
    },
    twitter: {
      card: twitterCardType as any,
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function Home() {
  const settings = await getStoreSettings('homepage');
  let shop: any = null;
  try {
    shop = await prisma.shop.findUnique({ where: { domain: "8tiahf-bk.myshopify.com" } });
    if (!shop) {
      console.log("[Storefront Home] 8tiahf-bk.myshopify.com shop record not found, auto-initializing...");
      const existing = await prisma.shop.findFirst().catch(() => null);
      const ENV_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
      shop = await prisma.shop.create({
        data: {
          domain: "8tiahf-bk.myshopify.com",
          accessToken: existing?.accessToken || ENV_TOKEN || "shpat_required",
          delhiveryApiKey: existing?.delhiveryApiKey,
          razorpayKeyId: existing?.razorpayKeyId,
          razorpayKeySecret: existing?.razorpayKeySecret,
          shiprocketEmail: existing?.shiprocketEmail,
          shiprocketToken: existing?.shiprocketToken,
          shiprocketPassword: existing?.shiprocketPassword,
          webhookSecret: existing?.webhookSecret,
          heroTitle: "Redefine The Standard",
          showHeroText: true,
          showLatestCuration: true,
          showArchive: true,
          showBlueprint: true,
          showCommunity: true,
          communityTitle: "Featured Looks",
          communitySubtitle: "Community",
          spotlightTitle: "AUTHENTIC STREETWEAR",
          spotlightSubtitle: "Luxury Indian streetwear for modern men."
        }
      });
    }
  } catch (e) {
    console.error("Error auto-initializing webstore shop settings:", e);
    shop = await prisma.shop.findFirst().catch(() => null);
  }

  const s = (shop as any) || {
    heroTitle: "Redefine The Standard",
    showHeroText: true,
    showLatestCuration: true,
    showArchive: true,
    showBlueprint: true,
    showCommunity: true,
    communityTitle: "Featured Looks",
    communitySubtitle: "Community",
    spotlightTitle: "AUTHENTIC STREETWEAR",
    spotlightSubtitle: "Luxury Indian streetwear for modern men."
  };

  // Concurrently fetch all independent assets to optimize TTFB and speed up the homepage loading
  const [collections, policies, banners, products] = await Promise.all([
    fetchEnabledCollections('page').catch(() => []),
    fetchPolicies().catch(() => []),
    (async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        return prisma.webStoreBanner.findMany({
          where: { isActive: true },
          orderBy: { position: "asc" },
        }).catch(() => [] as any[]);
      }
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/web_store_banners?select=id,title,subtitle,imageUrl:image_url,mobileImageUrl:mobile_image_url,ctaLabel:cta_label,ctaLink:cta_link,position,isActive:is_active&is_active=eq.true&order=position.asc`,
          {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
            next: { revalidate: 300, tags: ['banners'] },
          }
        );
        if (!res.ok) throw new Error(res.statusText);
        return await res.json();
      } catch (err: any) {
        console.warn('[Storefront Home] Failed to fetch banners from Supabase REST, falling back to Prisma:', err.message);
        return prisma.webStoreBanner.findMany({
          where: { isActive: true },
          orderBy: { position: "asc" },
        }).catch(() => [] as any[]);
      }
    })(),
    (async () => {
      try {
        if (s.homepageProducts && s.homepageProducts.trim()) {
          const { fetchProductById } = await import("@/lib/shopify-admin");
          const ids = s.homepageProducts.split(',').map((id: string) => id.trim()).filter(Boolean);
          const fetched = await Promise.all(
            ids.map((id: string) => fetchProductById(id).catch(() => null))
          );
          return fetched.filter((p): p is ShopifyProduct => p !== null);
        } else if (s.homepageCollection && s.homepageCollection.trim()) {
          const result = await fetchCollectionByHandle(s.homepageCollection, 24);
          return result.products;
        } else {
          return await fetchProducts(24);
        }
      } catch (err) {
        console.error("Error fetching homepage products:", err);
        return await fetchProducts(24).catch(() => [] as ShopifyProduct[]);
      }
    })(),
  ]);

  const nullIfEmpty = (val: string | null | undefined): string | null => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string' && val.trim() === '') return null;
    return val;
  };

  // Use explicit null/undefined checks — empty string "" from admin should remain blank, not show defaults
  const heroTitle      = nullIfEmpty(s?.heroTitle);
  const heroSubtitle   = nullIfEmpty(s?.heroSubtitle);
  const heroButtonText = nullIfEmpty(s?.heroButtonText);
  const heroImage      = s?.heroImage       || "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop";
  const heroVideo      = s?.heroVideo       || "/zb-video-heroo.mp4";
  const heroVideoMobile = s?.heroVideoMobile || "";
  const latestTitle    = nullIfEmpty(s?.latestCurationTitle);
  const latestSubtitle = nullIfEmpty(s?.latestCurationSubtitle);
  const archiveTitle   = nullIfEmpty(s?.archiveTitle);
  const archiveSubtitle = nullIfEmpty(s?.archiveSubtitle);
  const collectionsMedia = s?.collectionsMedia;
  const collectionsMediaMobile = s?.collectionsMediaMobile;
  const collectionsMediaLink = s?.collectionsMediaLink || '';
  const featuredMedia  = s?.featuredMedia;
  const featuredMediaImage = s?.featuredMediaImage;
  const featuredMediaMobile = s?.featuredMediaMobile;
  const featuredMediaImageMobile = s?.featuredMediaImageMobile;
  const featuredMediaLink = s?.featuredMediaLink || '';
  const blueprintTitle = nullIfEmpty(s?.blueprintTitle);
  const blueprintSubtitle = nullIfEmpty(s?.blueprintSubtitle);
  const footerVideo    = s?.footerVideo;
  const footerVideoMobile = s?.footerVideoMobile;
  const shopAllLink = s?.shopAllLink || '/collections/all';
  
  const socialLinks = [
    { url: s?.instagramUrl, icon: Instagram, label: "Instagram" },
    { url: s?.appleUrl,     icon: Disc,      label: "Apple Music" },
    { url: s?.spotifyUrl,   icon: Music2,    label: "Spotify" },
    { url: s?.youtubeUrl,   icon: Youtube,   label: "YouTube" },
  ].filter((item) => item.url);

  const flipbookConfig = s?.flipbookConfig;
  const flipbookImage  = s?.flipbookImage;
  const flipbookImageMobile = s?.flipbookImageMobile;
  const flipbookVideo  = s?.flipbookVideo;
  const flipbookVideoMobile = s?.flipbookVideoMobile;
  const flipbookTitle  = nullIfEmpty(s?.flipbookTitle);
  const flipbookTag    = nullIfEmpty(s?.flipbookTag);
  const flipbookDesc   = nullIfEmpty(s?.flipbookDesc);
  const flipbookLink   = s?.flipbookLink || '';
  
  const showRingCarousel = s?.showRingCarousel ?? true;
  const ringCarouselTitle = nullIfEmpty(s?.ringCarouselTitle);

  return (
    <div className="relative home-page max-w-full overflow-x-hidden">
      {/* Ambient background glows — desktop only to save mobile GPU */}
      <div className="hidden md:block absolute top-[80vh] left-1/4 -translate-x-1/2 w-[min(700px,100vw)] h-[700px] rounded-full bg-foreground/[0.03] blur-[150px] pointer-events-none z-0" />
      <div className="hidden md:block absolute top-[180vh] right-1/4 translate-x-1/2 w-[min(700px,100vw)] h-[700px] rounded-full bg-foreground/[0.02] blur-[150px] pointer-events-none z-0" />

      {/* ═══ HERO: Full-screen ═══ */}
      <section className="relative w-full h-[100dvh] md:h-screen overflow-hidden min-h-[500px] bg-black">
        {/* Background video */}
        {heroVideo ? (
          <HeroVideo src={heroVideo} mobileSrc={heroVideoMobile} poster={s?.heroImage || undefined} />
        ) : (
          <NextImage src={heroImage} alt="Hero" fill priority className="object-cover" onError={handleImageError} />
        )}

        {/* Glass gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Hero content: Spatial Liquid Glass Card */}
        {s?.showHeroText && (heroTitle || heroSubtitle) && (
          <div className="absolute inset-0 flex items-end justify-center md:justify-start p-4 sm:p-6 md:p-16 z-20">
            <div className="glass rounded-[2rem] border border-white/10 p-6 sm:p-8 md:p-10 w-full max-w-sm sm:max-w-md md:max-w-xl backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.6)] space-y-4 md:space-y-6 transition-all duration-500 hover:border-white/20 relative overflow-hidden group">
              {/* Internal subtle overlay glow (monochrome) */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-white/[0.02] to-transparent blur-2xl pointer-events-none" />
              
              <div className="relative z-10 space-y-1">
                <span className="text-[8px] font-bold text-white/40 uppercase tracking-[0.3em]">NEW DROP</span>
                {heroTitle && (
                  <h1 className="font-heading text-xl md:text-3xl font-black uppercase tracking-[0.08em] text-white leading-none">
                    {heroTitle}
                  </h1>
                )}
              </div>
              
              {heroSubtitle && (
                <p className="relative z-10 text-[9.5px] md:text-[11px] text-white/50 font-normal leading-relaxed tracking-wider max-w-md">
                  {heroSubtitle}
                </p>
              )}
              
              {heroButtonText && (
                <div className="relative z-10 pt-2">
                  <Link href="/collections" className="glass px-8 py-3 text-white text-[8px] font-bold uppercase tracking-[0.3em] bg-white/5 hover:bg-white/10 transition-all rounded-full flex items-center justify-center gap-2 border border-white/10 active:scale-95 w-max">
                    {heroButtonText} <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Center: Minimal "Shop all" link */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 animate-in fade-in duration-1000 delay-500">
          <Link 
            href={shopAllLink} 
            className="text-[9px] font-bold text-white/50 hover:text-white uppercase tracking-[0.4em] transition-all hover:tracking-[0.45em] active:scale-95 duration-500 ease-out flex items-center gap-1"
          >
            Shop all
          </Link>
          <div className="w-8 h-[1px] bg-white/20 rounded-full" />
        </div>
        
      </section>

      {/* ─── CONTENT BELOW HERO ─── */}
      <div className="relative z-10 w-full pb-16 rounded-t-2xl -mt-4 md:-mt-6 overflow-x-hidden">

        {/* ─── BANNERS (from admin CMS) ─── */}
        {banners.length > 0 && (
          <section className="mb-4 pt-2 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-[120px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map((banner: any) => (
                <Link key={banner.id} href={banner.ctaLink || "#"} className="block">
                  <div className="relative w-full aspect-[21/9] rounded-[1.25rem] overflow-hidden glass-panel group">
                    <NextImage
                      src={banner.mobileImageUrl || banner.imageUrl}
                      alt={banner.title || "Banner"}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      quality={75}
                      loading="lazy"
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                      onError={handleImageError}
                    />
                    {banner.title && (
                      <div className="absolute inset-0 flex items-end p-6 bg-gradient-to-t from-black/70 to-transparent">
                        <div>
                          {banner.subtitle && (
                            <p className="glass-label mb-1.5">{banner.subtitle}</p>
                          )}
                          <h3 className="text-white text-[12px] md:text-sm font-bold uppercase tracking-wider">{banner.title}</h3>
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ─── SECTION LABEL: Latest ─── */}
        {s?.showLatestCuration && (latestTitle || latestSubtitle) && (
          <div className="flex justify-between items-end mb-3 pt-4 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <div>
              {latestSubtitle && <p className="glass-label mb-1.5">{latestSubtitle}</p>}
              {latestTitle && <h2 className="font-heading text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] text-foreground/70 leading-none">{latestTitle}</h2>}
            </div>
            <Link href="/search" className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-foreground/30 hover:text-foreground/60 transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* ─── PRODUCT GRID 1 ─── */}
        <section className="mb-6 w-full px-[2px] md:px-1 min-h-[300px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] md:gap-[4px]">
            {products.slice(0, 4).map((p: ShopifyProduct, idx: number) => (
              <ProductCard key={p.id} product={p} priority={idx < 4} />
            ))}
          </div>
        </section>

        {/* ─── ABOVE-COLLECTION MEDIA ─── */}
        {(collectionsMedia || collectionsMediaMobile) && (() => {
          const hasLink = collectionsMediaLink && collectionsMediaLink.trim() !== '';
          const Wrapper = hasLink ? Link : 'div';
          const wrapperProps = hasLink ? { href: `/collections/${collectionsMediaLink}` } : {};
          return (
            <div className="w-full mb-6">
              <Wrapper
                {...wrapperProps as any}
                className={`render-deferred-media relative block w-full overflow-hidden shadow-lg border-y border-foreground/[0.03] dark:border-white/[0.04] aspect-[9/16] md:aspect-[21/9] md:h-[80vh] md:aspect-auto ${hasLink ? 'cursor-pointer' : ''}`}
                aria-label={hasLink ? `Collections curation - Open collection ${collectionsMediaLink}` : 'Collections curation'}
                itemScope
                itemType="https://schema.org/CollectionPage"
              >
                {hasLink && <meta itemProp="url" content={`/collections/${collectionsMediaLink}`} />}
                <meta itemProp="name" content="Collections Curation Media" />
                {hasLink && (
                  <span className="sr-only">Browse our {collectionsMediaLink} collection</span>
                )}
                {collectionsMedia && (
                  <div className="hidden md:block absolute inset-0 w-full h-full">
                    <LazyVideo src={collectionsMedia} className="w-full h-full object-cover opacity-80" />
                  </div>
                )}
                {collectionsMediaMobile ? (
                  <div className="md:hidden absolute inset-0 w-full h-full">
                    <LazyVideo src={collectionsMediaMobile} className="w-full h-full object-cover opacity-80" />
                  </div>
                ) : collectionsMedia ? (
                  <div className="md:hidden absolute inset-0 w-full h-full">
                    <LazyVideo src={collectionsMedia} className="w-full h-full object-cover opacity-80" />
                  </div>
                ) : null}
              </Wrapper>
            </div>
          );
        })()}

        {/* ─── GLASS DIVIDER ─── */}
        <div className="glass-divider my-4 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8" />

        {/* ─── COLLECTIONS CAROUSEL ─── */}
        <section className="render-deferred-carousel py-4 max-w-6xl mx-auto overflow-hidden px-3 sm:px-6 lg:px-8 min-h-[200px]">
          {s?.showArchive && archiveTitle && (
            <div className="flex justify-center mb-3 px-4">
              <span className="glass-label">— {archiveTitle} —</span>
            </div>
          )}
          <CollectionCarousel collections={collections} />
          {s?.showArchive && archiveSubtitle && (
            <div className="flex justify-center mt-3 mb-2">
              <span className="text-[8px] font-extralight uppercase tracking-[0.4em] text-foreground/15">{archiveSubtitle}</span>
            </div>
          )}
        </section>
        
        {/* ─── RING COLLECTION CAROUSEL ─── */}
        {showRingCarousel && (
          <div className="render-deferred-carousel my-4 w-full min-h-[200px]">
            <Suspense fallback={<div className="w-full min-h-[200px]" />}>
              <RingCarouselSection 
                title={ringCarouselTitle || undefined} 
                itemsConfig={s?.ringCarouselItems || undefined}
              />
            </Suspense>
          </div>
        )}

        {/* ─── 3D FLIPBOOK SECTION ─── */}
        <div className="render-deferred-media my-4 w-full min-h-[300px]">
          <Suspense fallback={<div className="w-full min-h-[300px]" />}>
            <FlipbookSection 
              imgUrl={flipbookImage || undefined}
              videoUrl={flipbookVideo || undefined}
              imgUrlMobile={flipbookImageMobile || undefined}
              videoUrlMobile={flipbookVideoMobile || undefined}
              title={flipbookTitle || undefined} 
              tag={flipbookTag || undefined} 
              desc={flipbookDesc || undefined}
              link={flipbookLink || undefined}
            />
          </Suspense>
        </div>

        {/* ─── PRODUCT GRID 2 ─── */}
        <section className="render-deferred-section mb-6 w-full px-[2px] md:px-1 min-h-[300px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] md:gap-[4px]">
            {products.slice(4, 8).map((p: ShopifyProduct) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>

        {/* ─── FEATURED MEDIA / BLUEPRINT ─── */}
        {s?.showBlueprint && (featuredMedia || featuredMediaImage || featuredMediaMobile || featuredMediaImageMobile) && (
          <div className="w-full mb-6 min-h-[300px]">
            {/* Desktop View (Landscape - Full Width) */}
            {(() => {
              const hasLink = featuredMediaLink && featuredMediaLink.trim() !== '';
              const hasText = blueprintTitle || blueprintSubtitle;
              const Wrapper = hasLink ? Link : 'div';
              const wrapperProps = hasLink ? { href: `/collections/${featuredMediaLink}` } : {};
              return (
                <>
                  <Wrapper
                    {...wrapperProps as any}
                    className={`render-deferred-media hidden md:block relative w-full overflow-hidden group shadow-xl border-y border-foreground/[0.03] dark:border-white/[0.04] aspect-[21/9] md:h-[80vh] md:aspect-auto ${hasLink ? 'cursor-pointer' : ''}`}
                    aria-label={hasLink ? `Featured collection - Open collection ${featuredMediaLink}` : 'Featured collection'}
                    itemScope
                    itemType="https://schema.org/CollectionPage"
                  >
                    {hasLink && <meta itemProp="url" content={`/collections/${featuredMediaLink}`} />}
                    {blueprintTitle && <meta itemProp="name" content={blueprintTitle} />}
                    {blueprintSubtitle && <meta itemProp="description" content={blueprintSubtitle} />}
                    {hasLink && (
                      <span className="sr-only">Browse our {blueprintTitle || featuredMediaLink} collection</span>
                    )}
                    {featuredMedia ? (
                      <LazyVideo
                        src={featuredMedia}
                        fallbackImage={featuredMediaImage || "/section-image1.webp"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                      />
                    ) : (
                      <NextImage
                        src={featuredMediaImage || "/section-image1.webp"}
                        alt="Featured Media"
                        fill
                        sizes="100vw"
                        quality={75}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                        onError={handleImageError}
                      />
                    )}
                    {/* Gradient overlay for text */}
                    {hasText && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none z-10" />
                    )}
                    {/* Text overlay */}
                    {hasText && (
                      <div className="absolute inset-0 z-20 flex items-end p-12 lg:p-16">
                        <div className="max-w-xl space-y-3">
                          {blueprintSubtitle && (
                            <span className="inline-block text-[9px] font-bold text-white/50 uppercase tracking-[0.3em]">
                              {blueprintSubtitle}
                            </span>
                          )}
                          {blueprintTitle && (
                            <h3 className="font-heading text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-[0.06em] text-white leading-none">
                              {blueprintTitle}
                            </h3>
                          )}
                        </div>
                      </div>
                    )}
                  </Wrapper>

                  {/* Mobile View (Portrait - Full Width) */}
                  <Wrapper
                    {...wrapperProps as any}
                    className={`render-deferred-media block md:hidden relative w-full overflow-hidden group shadow-xl border-y border-foreground/[0.03] dark:border-white/[0.04] aspect-[9/16] ${hasLink ? 'cursor-pointer' : ''}`}
                    aria-label={hasLink ? `Featured collection - Open collection ${featuredMediaLink}` : 'Featured collection'}
                    itemScope
                    itemType="https://schema.org/CollectionPage"
                  >
                    {hasLink && <meta itemProp="url" content={`/collections/${featuredMediaLink}`} />}
                    {blueprintTitle && <meta itemProp="name" content={blueprintTitle} />}
                    {blueprintSubtitle && <meta itemProp="description" content={blueprintSubtitle} />}
                    {hasLink && (
                      <span className="sr-only">Browse our {blueprintTitle || featuredMediaLink} collection</span>
                    )}
                    {featuredMediaMobile ? (
                      <LazyVideo
                        src={featuredMediaMobile}
                        fallbackImage={featuredMediaImageMobile || featuredMediaImage || "/section-image1.webp"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                      />
                    ) : (featuredMediaImageMobile || featuredMediaImage) ? (
                      <NextImage
                        src={featuredMediaImageMobile || featuredMediaImage || "/section-image1.webp"}
                        alt="Featured Media Mobile"
                        fill
                        sizes="100vw"
                        quality={75}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                        onError={handleImageError}
                      />
                    ) : featuredMedia ? (
                      <LazyVideo
                        src={featuredMedia}
                        fallbackImage={featuredMediaImage || "/section-image1.webp"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                      />
                    ) : (
                      <NextImage
                        src="/section-image1.webp"
                        alt="Featured Media Fallback"
                        fill
                        sizes="100vw"
                        quality={75}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                        onError={handleImageError}
                      />
                    )}
                    {/* Gradient overlay for text */}
                    {hasText && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none z-10" />
                    )}
                    {/* Text overlay */}
                    {hasText && (
                      <div className="absolute inset-0 z-20 flex items-end p-6 sm:p-8">
                        <div className="max-w-md space-y-2">
                          {blueprintSubtitle && (
                            <span className="inline-block text-[8px] font-bold text-white/50 uppercase tracking-[0.3em]">
                              {blueprintSubtitle}
                            </span>
                          )}
                          {blueprintTitle && (
                            <h3 className="font-heading text-lg sm:text-xl font-black uppercase tracking-[0.06em] text-white leading-none">
                              {blueprintTitle}
                            </h3>
                          )}
                        </div>
                      </div>
                    )}
                  </Wrapper>
                </>
              );
            })()}
          </div>
        )}

        {/* ─── GLASS DIVIDER ─── */}
        <div className="glass-divider my-4 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8" />

        {/* ─── PRODUCT GRID 3 ─── */}
        <section className="render-deferred-section mt-4 mb-6 w-full px-[2px] md:px-1 min-h-[300px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] md:gap-[4px]">
            {products.slice(12, 16).map((p: ShopifyProduct) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>

        {/* ─── AUTHENTIC STREETWEAR SECTION ─── */}
        <div className="render-deferred-section my-4 max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 min-h-[400px]">
          <Suspense fallback={<div className="w-full min-h-[400px]" />}>
            <SpotlightSection 
              title={s?.spotlightTitle || "AUTHENTIC STREETWEAR"} 
              subtitle={s?.spotlightSubtitle} 
              collection={s?.spotlightCollection}
              productIds={s?.spotlightProducts}
            />
          </Suspense>
        </div>

        {/* ─── FEATURED LOOKS (COMMUNITY) ─── */}
        <div className="render-deferred-section my-4 max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 min-h-[300px]">
          <Suspense fallback={<div className="w-full min-h-[300px]" />}>
            <FeaturedUsersSection
              showCommunity={s?.showCommunity}
              title={s?.communityTitle}
              subtitle={s?.communitySubtitle}
            />
          </Suspense>
        </div>

        {/* ─── FOOTER VIDEO ─── */}
        {(footerVideo || footerVideoMobile) && (
          <div className="w-full my-4">
            <section className="render-deferred-media relative w-full aspect-[9/16] md:aspect-[21/9] overflow-hidden group shadow-2xl border-y border-foreground/[0.03] dark:border-white/[0.04] min-h-[300px]">
              {footerVideo && (
                <div className="hidden md:block absolute inset-0 w-full h-full">
                  <LazyVideo
                    src={footerVideo}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-1000"
                  />
                </div>
              )}
              {footerVideoMobile ? (
                <div className="md:hidden absolute inset-0 w-full h-full">
                  <LazyVideo
                    src={footerVideoMobile}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-1000"
                  />
                </div>
              ) : footerVideo ? (
                <div className="md:hidden absolute inset-0 w-full h-full">
                  <LazyVideo
                    src={footerVideo}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-1000"
                  />
                </div>
              ) : null}
            </section>
          </div>
        )}

        {/* ═══ SEO — Invisible structured data for search engines & AI crawlers ═══ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Zica Bella",
              "url": "https://zicabella.com",
              "logo": "https://zicabella.com/zb-logo-220px.png",
              "image": settings?.socialImageUrl || "https://zicabella.com/og-image.jpg",
              "description": settings?.metaDescription || "Zica Bella® is recognized as India's premier luxury streetwear label and the fastest growing global fashion app. Redefining street culture with custom 240+ GSM heavyweight oversized graphic tees, vintage acid-wash shirts, custom loopback fleece hoodies, and raw-edge streetwear accessories for a relentless global community.",
              "slogan": "Redefine The Standard",
              "award": ["India's #1 Premium Streetwear Brand", "World's Fastest Growing Fashion Brand"],
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "reviewCount": "5420",
                "bestRating": "5"
              },
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Zica Bella Collections",
                "itemListElement": [
                  { "@type": "OfferCatalog", "name": "Heavyweight Hoodies" },
                  { "@type": "OfferCatalog", "name": "Oversized Tees" },
                  { "@type": "OfferCatalog", "name": "Premium Denim" },
                  { "@type": "OfferCatalog", "name": "Accessories" }
                ]
              }
            })
          }}
        />

      </div>
    </div>
  );
}
