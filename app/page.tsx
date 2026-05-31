import { fetchProducts, fetchEnabledCollections, fetchPolicies } from "@/lib/shopify-admin";
import prisma from "@/lib/db";
import NextImage from "next/image";
import Link from "next/link";
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

export const dynamic = "force-dynamic";

export default async function Home() {
  let shop: any = null;
  try {
    shop = await prisma.shop.findUnique({ where: { domain: "zicabella.com" } });
    if (!shop) {
      console.log("[Storefront Home] zicabella.com shop record not found, auto-initializing...");
      const existing = await prisma.shop.findFirst().catch(() => null);
      const ENV_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
      shop = await prisma.shop.create({
        data: {
          domain: "zicabella.com",
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

  const [collections, policies] = await Promise.all([
    fetchEnabledCollections('header', 'zicabella.com').catch(() => []),
    fetchPolicies().catch(() => []),
  ]);

  // Fetch banners from WebStoreBanner table
  let banners: any[] = [];
  try {
    banners = await prisma.webStoreBanner.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
    });
  } catch (e) {
    // Silently handle - banners are optional
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

  let products: ShopifyProduct[] = [];
  try {
    if (s.homepageProducts && s.homepageProducts.trim()) {
      const { fetchProductById } = await import("@/lib/shopify-admin");
      const ids = s.homepageProducts.split(',').map((id: string) => id.trim()).filter(Boolean);
      const fetched = await Promise.all(
        ids.map((id: string) => fetchProductById(id).catch(() => null))
      );
      products = fetched.filter((p): p is ShopifyProduct => p !== null);
    } else if (s.homepageCollection && s.homepageCollection.trim()) {
      const { fetchCollectionByHandle } = await import("@/lib/shopify-admin");
      const result = await fetchCollectionByHandle(s.homepageCollection, 24);
      products = result.products;
    } else {
      products = await fetchProducts(24);
    }
  } catch (err) {
    console.error("Error fetching homepage products:", err);
    products = await fetchProducts(24).catch(() => [] as ShopifyProduct[]);
  }

  const heroTitle      = s?.heroTitle       || "Redefine The Standard";
  const heroSubtitle   = s?.heroSubtitle    || "Explore the latest drops tailored for the relentless.";
  const heroButtonText = s?.heroButtonText  || "Discover";
  const heroImage      = s?.heroImage       || "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop";
  const heroVideo      = s?.heroVideo       || "/zb-video-heroo.mp4";
  const heroVideoMobile = s?.heroVideoMobile || "";
  const latestTitle    = s?.latestCurationTitle    || "Latest Curation";
  const latestSubtitle = s?.latestCurationSubtitle || "Season Drop";
  const archiveTitle   = s?.archiveTitle    || "The Archive";
  const archiveSubtitle = s?.archiveSubtitle || "Organic Evolution";
  const collectionsMedia = s?.collectionsMedia;
  const collectionsMediaMobile = s?.collectionsMediaMobile;
  const featuredMedia  = s?.featuredMedia;
  const featuredMediaImage = s?.featuredMediaImage;
  const featuredMediaMobile = s?.featuredMediaMobile;
  const featuredMediaImageMobile = s?.featuredMediaImageMobile;
  const footerVideo    = s?.footerVideo;
  const footerVideoMobile = s?.footerVideoMobile;
  
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
  const flipbookTitle  = s?.flipbookTitle  || "Archival Vision";
  const flipbookTag    = s?.flipbookTag    || "Core Manifest";
  const flipbookDesc   = s?.flipbookDesc   || "Engineered for those who move without compromise.";
  
  const showRingCarousel = s?.showRingCarousel ?? true;
  const ringCarouselTitle = s?.ringCarouselTitle || "RING COLLECTION";
  const ringCarouselItems = s?.ringCarouselItems || "[]";

  return (
    <div className="relative home-page max-w-full">
      {/* Ambient background glows for infinite three-dimensional Dusk depth */}
      <div className="absolute top-[80vh] left-1/4 -translate-x-1/2 w-[min(700px,100vw)] h-[700px] rounded-full bg-violet-600/5 blur-[150px] pointer-events-none z-0" />
      <div className="absolute top-[180vh] right-1/4 translate-x-1/2 w-[min(700px,100vw)] h-[700px] rounded-full bg-indigo-600/5 blur-[150px] pointer-events-none z-0" />

      {/* ═══ HERO: Full-screen ═══ */}
      <section className="relative w-full h-[100svh] md:h-screen overflow-hidden">
        {/* Background video */}
        {heroVideo ? (
          <HeroVideo src={heroVideo} mobileSrc={heroVideoMobile} />
        ) : (
          <NextImage src={heroImage} alt="Hero" fill priority className="object-cover" onError={handleImageError} />
        )}

        {/* Glass gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Hero content: Spatial Liquid Glass Card */}
        {s?.showHeroText && (
          <div className="absolute inset-0 flex items-end justify-center md:justify-start p-4 sm:p-6 md:p-16 z-20">
            <div className="glass rounded-[2rem] border border-white/10 p-6 sm:p-8 md:p-10 w-full max-w-sm sm:max-w-md md:max-w-xl backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.6)] space-y-4 md:space-y-6 transition-all duration-500 hover:border-white/20 relative overflow-hidden group">
              {/* Internal subtle overlay glow (monochrome) */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-white/[0.02] to-transparent blur-2xl pointer-events-none" />
              
              <div className="relative z-10 space-y-1">
                <span className="text-[8px] font-bold text-white/40 uppercase tracking-[0.3em]">NEW DROP</span>
                <h1 className="font-heading text-xl md:text-3xl font-black uppercase tracking-[0.08em] text-white leading-none">
                  {heroTitle}
                </h1>
              </div>
              
              <p className="relative z-10 text-[9.5px] md:text-[11px] text-white/50 font-normal leading-relaxed tracking-wider max-w-md">
                {heroSubtitle}
              </p>
              
              <div className="relative z-10 pt-2">
                <Link href="/collections" className="glass px-8 py-3 text-white text-[8px] font-bold uppercase tracking-[0.3em] bg-white/5 hover:bg-white/10 transition-all rounded-full flex items-center justify-center gap-2 border border-white/10 active:scale-95 w-max">
                  {heroButtonText} <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
        
      </section>

      {/* ═══ CONTENT BELOW HERO ═══ */}
      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-24 rounded-t-2xl -mt-4 md:-mt-6 overflow-x-hidden">

        {/* ═══ BANNERS (from admin CMS) ═══ */}
        {banners.length > 0 && (
          <section className="mb-8 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map((banner: any) => (
                <Link key={banner.id} href={banner.ctaLink || "#"} className="block">
                  <div className="relative w-full aspect-[21/9] rounded-[1.25rem] overflow-hidden glass-panel group">
                    <NextImage
                      src={banner.mobileImageUrl || banner.imageUrl}
                      alt={banner.title || "Banner"}
                      fill
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

        {/* ═══ SECTION LABEL: Latest ═══ */}
        {s?.showLatestCuration && (
          <div className="flex justify-between items-end mb-6 pt-8 px-1">
            <div>
              <p className="glass-label mb-1.5">{latestSubtitle}</p>
              <h2 className="font-heading text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] text-foreground/70 leading-none">{latestTitle}</h2>
            </div>
            <Link href="/search" className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-foreground/30 hover:text-foreground/60 transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* ═══ PRODUCT GRID 1 ═══ */}
        <section className="mb-10 px-[1px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 md:gap-x-6 gap-y-8 md:gap-y-12">
            {products.slice(0, 4).map((p: ShopifyProduct, idx: number) => (
              <ProductCard key={p.id} product={p} priority={idx < 4} />
            ))}
          </div>
        </section>

        {/* ═══ ABOVE-COLLECTION MEDIA ═══ */}
        {(collectionsMedia || collectionsMediaMobile) && (
          <section className="render-deferred-media smooth-gpu mb-10 max-w-6xl md:max-w-7xl lg:max-w-[1400px] mx-auto relative w-full aspect-[9/16] md:aspect-[21/9] rounded-[1.25rem] overflow-hidden shadow-lg border border-foreground/[0.04] dark:border-white/[0.05]" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
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
          </section>
        )}

        {/* ═══ GLASS DIVIDER ═══ */}
        <div className="glass-divider my-8" />

        {/* ═══ COLLECTIONS CAROUSEL ═══ */}
        <section className="render-deferred-carousel smooth-gpu py-8 max-w-6xl mx-auto overflow-hidden">
          {s?.showArchive && (
            <div className="flex justify-center mb-6 px-4">
              <span className="glass-label">— {archiveTitle} —</span>
            </div>
          )}
          <CollectionCarousel collections={collections} />
          {s?.showArchive && (
            <div className="flex justify-center mt-6 mb-2">
              <span className="text-[8px] font-extralight uppercase tracking-[0.4em] text-foreground/15">{archiveSubtitle}</span>
            </div>
          )}
        </section>
        
        {/* ═══ RING COLLECTION CAROUSEL ═══ */}
        {showRingCarousel && (
          <div className="render-deferred-carousel smooth-gpu my-8">
            <RingCarouselSection 
              title={ringCarouselTitle} 
              itemsConfig={ringCarouselItems} 
            />
          </div>
        )}

        {/* ═══ 3D FLIPBOOK SECTION ═══ */}
        <div className="render-deferred-media smooth-gpu my-8 max-w-6xl md:max-w-7xl lg:max-w-[1400px] mx-auto">
          <FlipbookSection 
            imgUrl={flipbookImage}
            videoUrl={flipbookVideo}
            imgUrlMobile={flipbookImageMobile}
            videoUrlMobile={flipbookVideoMobile}
            title={flipbookTitle} 
            tag={flipbookTag} 
            desc={flipbookDesc} 
          />
        </div>

        {/* ═══ PRODUCT GRID 2 ═══ */}
        <section className="render-deferred-section mb-10 px-[1px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 md:gap-x-6 gap-y-8 md:gap-y-12">
            {products.slice(4, 8).map((p: ShopifyProduct) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>

        {/* ═══ FEATURED MEDIA / BLUEPRINT ═══ */}
        {s?.showBlueprint && (
          <>
            {/* Desktop View (Landscape) */}
            <section className="render-deferred-media smooth-gpu hidden md:block mb-10 max-w-6xl md:max-w-7xl lg:max-w-[1400px] mx-auto relative w-full aspect-[21/9] rounded-[1.5rem] overflow-hidden group shadow-xl border border-foreground/[0.04] dark:border-white/[0.05]" style={{ border: "1px solid rgba(255,255,255,0.03)" }}>
              {featuredMedia ? (
                <LazyVideo
                  src={featuredMedia}
                  fallbackImage={featuredMediaImage || "/section-image1.PNG"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                />
              ) : (
                <NextImage
                  src={featuredMediaImage || "/section-image1.PNG"}
                  alt="Blueprint Media"
                  fill
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                  onError={handleImageError}
                />
              )}
            </section>

            {/* Mobile View (Portrait) */}
            <section className="render-deferred-media smooth-gpu md:hidden mb-10 max-w-2xl mx-auto relative w-full aspect-[4/5] rounded-[1.5rem] overflow-hidden group shadow-xl" style={{ border: "1px solid rgba(255,255,255,0.03)" }}>
              {featuredMediaMobile ? (
                <LazyVideo
                  src={featuredMediaMobile}
                  fallbackImage={featuredMediaImageMobile || featuredMediaImage || "/section-image1.PNG"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                />
              ) : (featuredMediaImageMobile || featuredMediaImage) ? (
                <NextImage
                  src={featuredMediaImageMobile || featuredMediaImage || "/section-image1.PNG"}
                  alt="Blueprint Media Mobile"
                  fill
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                  onError={handleImageError}
                />
              ) : featuredMedia ? (
                <LazyVideo
                  src={featuredMedia}
                  fallbackImage={featuredMediaImage || "/section-image1.PNG"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                />
              ) : (
                <NextImage
                  src="/section-image1.PNG"
                  alt="Blueprint Media Fallback"
                  fill
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                  onError={handleImageError}
                />
              )}
            </section>
          </>
        )}

        {/* ═══ GLASS DIVIDER ═══ */}
        <div className="glass-divider my-8" />

        {/* ═══ PRODUCT GRID 3 ═══ */}
        <section className="render-deferred-section mt-8 mb-10 px-[1px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 md:gap-x-6 gap-y-8 md:gap-y-12">
            {products.slice(12, 16).map((p: ShopifyProduct) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>

        {/* ═══ AUTHENTIC STREETWEAR SECTION ═══ */}
        <div className="render-deferred-section my-10 max-w-6xl mx-auto">
          <SpotlightSection 
            title={s?.spotlightTitle || "AUTHENTIC STREETWEAR"} 
            subtitle={s?.spotlightSubtitle} 
            collection={s?.spotlightCollection}
            productIds={s?.spotlightProducts}
          />
        </div>

        {/* ═══ FEATURED LOOKS (COMMUNITY) ═══ */}
        <div className="render-deferred-section my-10 max-w-6xl mx-auto">
          <FeaturedUsersSection
            showCommunity={s?.showCommunity}
            title={s?.communityTitle}
            subtitle={s?.communitySubtitle}
          />
        </div>

        {/* ═══ FOOTER VIDEO ═══ */}
        {(footerVideo || footerVideoMobile) && (
          <section className="render-deferred-media smooth-gpu relative my-10 max-w-6xl md:max-w-7xl lg:max-w-[1400px] mx-auto aspect-[9/16] md:aspect-[21/9] rounded-[2rem] overflow-hidden group shadow-2xl border border-foreground/[0.03] dark:border-white/[0.04]" style={{ border: "1px solid rgba(255,255,255,0.03)" }}>
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
        )}

        {/* ═══ BRAND STATEMENT & STATS (SEO & AI CRAWLER FOCUS) ═══ */}
        <section className="render-deferred-footer my-8 max-w-6xl mx-auto px-4" aria-label="About Zica Bella Brand">
          <div className="glass rounded-[1.5rem] border border-white/5 p-4 md:p-6 relative overflow-hidden backdrop-blur-xl shadow-lg">
            <div className="relative z-10 flex flex-col lg:flex-row gap-6 justify-between items-center">
              {/* Left Column: Tiny brand statement */}
              <div className="space-y-2 max-w-3xl text-center lg:text-left">
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-2 gap-y-1">
                  <span className="text-[7px] font-bold text-violet-400 uppercase tracking-[0.25em]">Global Recognition</span>
                  <span className="text-[7px] text-white/20 hidden lg:inline">•</span>
                  <h2 className="text-[8px] font-bold text-white uppercase tracking-[0.2em]">
                    India's &amp; World's Fastest Growing Fashion Brand
                  </h2>
                </div>
                <p className="text-[9.5px] text-white/40 font-light leading-relaxed tracking-wider">
                  Zica Bella is recognized as the world's fastest-growing luxury streetwear label and India's #1 premium clothing shopping site and app. Redefining street culture through custom heavyweight cotton hoodies, oversized tees, and 3D virtual fittings for a relentless global community.
                </p>
              </div>

              {/* Right Column: Tiny grid row of stats */}
              <div className="flex flex-wrap justify-center gap-2.5 shrink-0">
                <div className="px-3 py-1.5 rounded-xl bg-white/[0.01] border border-white/5 text-center min-w-[72px]">
                  <p className="text-[10px] font-black text-white">4.9★</p>
                  <p className="text-[5.5px] font-bold text-white/30 uppercase tracking-[0.15em]">RATING</p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white/[0.01] border border-white/5 text-center min-w-[72px]">
                  <p className="text-[10px] font-black text-white">#1</p>
                  <p className="text-[5.5px] font-bold text-white/30 uppercase tracking-[0.15em]">STREETWEAR</p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white/[0.01] border border-white/5 text-center min-w-[72px]">
                  <p className="text-[10px] font-black text-white">100%</p>
                  <p className="text-[5.5px] font-bold text-white/30 uppercase tracking-[0.15em]">COTTON</p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white/[0.01] border border-white/5 text-center min-w-[72px]">
                  <p className="text-[10px] font-black text-white">GLOBAL</p>
                  <p className="text-[5.5px] font-bold text-white/30 uppercase tracking-[0.15em]">SHIPPING</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
