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
  const [shop, collections, policies] = await Promise.all([
    prisma.shop.findFirst().catch(() => null),
    fetchEnabledCollections('header').catch(() => []),
    fetchPolicies().catch(() => []),
  ]);

  const s = (shop as any) || {
    heroTitle: "Redefine The Standard",
    showHeroText: false,
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
  const heroVideo      = "/zb-video-heroo.mp4";
  const latestTitle    = s?.latestCurationTitle    || "Latest Curation";
  const latestSubtitle = s?.latestCurationSubtitle || "Season Drop";
  const archiveTitle   = s?.archiveTitle    || "The Archive";
  const archiveSubtitle = s?.archiveSubtitle || "Organic Evolution";
  const collectionsMedia = s?.collectionsMedia;
  const featuredMedia  = s?.featuredMedia;
  const featuredMediaImage = s?.featuredMediaImage;
  const footerVideo    = s?.footerVideo;

  const socialLinks = [
    { url: s?.instagramUrl, icon: Instagram, label: "Instagram" },
    { url: s?.appleUrl,     icon: Disc,      label: "Apple Music" },
    { url: s?.spotifyUrl,   icon: Music2,    label: "Spotify" },
    { url: s?.youtubeUrl,   icon: Youtube,   label: "YouTube" },
  ].filter((item) => item.url);

  const flipbookConfig = s?.flipbookConfig;
  const flipbookImage  = s?.flipbookImage;
  const flipbookVideo  = s?.flipbookVideo;
  const flipbookTitle  = s?.flipbookTitle  || "Archival Vision";
  const flipbookTag    = s?.flipbookTag    || "Core Manifest";
  const flipbookDesc   = s?.flipbookDesc   || "Engineered for those who move without compromise.";
  
  const showRingCarousel = s?.showRingCarousel ?? true;
  const ringCarouselTitle = s?.ringCarouselTitle || "RING COLLECTION";
  const ringCarouselItems = s?.ringCarouselItems || "[]";

  return (
    <div className="relative home-page">
      {/* ═══ HERO: Full-screen, scoped to hero section only ═══ */}
      <section className="relative w-full h-[100svh] overflow-hidden">
        {/* Background video */}
        {heroVideo ? (
          <HeroVideo src={heroVideo} />
        ) : (
          <NextImage src={heroImage} alt="Hero" fill priority className="object-cover" onError={handleImageError} />
        )}
        {/* Gradient removed as per request */}

        {/* Hero content */}
        {s?.showHeroText && (
          <div className="absolute inset-x-0 bottom-0 px-5 pb-8">
            <h1 className="font-heading text-[20px] mb-1.5 leading-tight uppercase tracking-wide text-white drop-shadow-2xl">
              {heroTitle}
            </h1>
            <p className="text-[7.5px] text-white/50 max-w-[240px] mb-5 font-extralight leading-relaxed tracking-widest uppercase drop-shadow">
              {heroSubtitle}
            </p>
            <button className="px-7 py-2.5 bg-white/10 backdrop-blur-xl border border-white/20 text-white text-[7.5px] font-extralight uppercase tracking-[0.4em] rounded-full hover:bg-white/20 active:scale-95 transition-all">
              {heroButtonText}
            </button>
          </div>
        )}
      </section>

      {/* ═══ CONTENT BELOW HERO ═══ */}
      <div className="relative bg-background z-10 max-w-[410px] mx-auto px-1.5 pb-24 rounded-t-2xl">

        {/* ═══ SECTION LABEL: Latest ═══ */}
        {s?.showLatestCuration && (
          <div className="flex justify-between items-end mb-2 px-2 pt-6">
            <div>
              <p className="text-[7px] font-extralight uppercase tracking-[0.5em] text-muted-foreground/35 mb-0.5">{latestSubtitle}</p>
              <h2 className="font-heading text-[10px] uppercase tracking-[0.18em] text-foreground/75">{latestTitle}</h2>
            </div>
            <Link href="/search" className="flex items-center gap-1 text-[8px] uppercase tracking-widest text-muted-foreground/50 hover:text-foreground transition-colors">
              View all <ChevronRight className="w-2.5 h-2.5" />
            </Link>
          </div>
        )}

        {/* ═══ PRODUCT GRID 1 ═══ */}
        <section className="mb-2 px-[1px]">
          <div className="grid grid-cols-2 gap-x-1 gap-y-5">
            {products.slice(0, 4).map((p: ShopifyProduct, idx: number) => (
              <ProductCard key={p.id} product={p} priority={idx < 4} />
            ))}
          </div>
        </section>

        {/* ═══ ABOVE-COLLECTION MEDIA ═══ */}
        {collectionsMedia && (
          <section className="mb-2 relative w-full aspect-video rounded-[0.75rem] overflow-hidden bg-muted shadow-lg border border-foreground/5">
            <LazyVideo src={collectionsMedia} className="absolute inset-0 w-full h-full object-cover opacity-80" />
          </section>
        )}

        {/* ═══ COLLECTIONS CAROUSEL ═══ */}
        <section className="py-5 -mx-2">
          {s?.showArchive && (
            <div className="flex justify-center mb-5 px-4">
              <span className="text-[7px] font-extralight uppercase tracking-[0.9em] text-muted-foreground/22">— {archiveTitle} —</span>
            </div>
          )}
          <CollectionCarousel collections={collections} />
          {s?.showArchive && (
            <div className="flex justify-center mt-5 mb-1">
              <span className="text-[7px] font-extralight uppercase tracking-[0.4em] text-muted-foreground/18">{archiveSubtitle}</span>
            </div>
          )}
        </section>
        
        {/* ═══ RING COLLECTION CAROUSEL ═══ */}
        {showRingCarousel && (
          <div className="mt-3 mb-3">
            <RingCarouselSection 
              title={ringCarouselTitle} 
              itemsConfig={ringCarouselItems} 
            />
          </div>
        )}

        {/* ═══ 3D FLIPBOOK SECTION ═══ */}
        <FlipbookSection 
          imgUrl={flipbookImage}
          videoUrl={flipbookVideo}
          title={flipbookTitle} 
          tag={flipbookTag} 
          desc={flipbookDesc} 
        />

        {/* ═══ PRODUCT GRID 2 ═══ */}
        <section className="mb-2 px-[1px]">
          <div className="grid grid-cols-2 gap-x-1 gap-y-5">
            {products.slice(4, 8).map((p: ShopifyProduct) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>

        {/* ═══ FEATURED MEDIA / BLUEPRINT ═══ */}
        {s?.showBlueprint && (
          <section className="mb-2 relative w-full aspect-[4/5] rounded-[1rem] overflow-hidden bg-muted border border-foreground/[0.03] group shadow-xl">
            {featuredMedia ? (
              <LazyVideo
                src={featuredMedia}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
              />
            ) : (
              <NextImage
                src={featuredMediaImage || "/section-image1.PNG"}
                alt="Blueprint Media"
                fill
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                priority
                onError={handleImageError}
              />
            )}
          </section>
        )}



        {/* ═══ PRODUCT GRID 3 ═══ */}
        <section className="mt-4 mb-2 px-[1px]">
          <div className="grid grid-cols-2 gap-x-1 gap-y-5">
            {products.slice(12, 16).map((p: ShopifyProduct) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>

        {/* ═══ AUTHENTIC STREETWEAR SECTION ═══ */}
        <div className="mt-8 mb-8">
          <SpotlightSection 
            title={s?.spotlightTitle || "AUTHENTIC STREETWEAR"} 
            subtitle={s?.spotlightSubtitle} 
            collection={s?.spotlightCollection}
            productIds={s?.spotlightProducts}
          />
        </div>

        {/* ═══ FEATURED LOOKS (COMMUNITY) ═══ */}
        <div className="mt-8 mb-8">
          <FeaturedUsersSection
            showCommunity={s?.showCommunity}
            title={s?.communityTitle}
            subtitle={s?.communitySubtitle}
          />
        </div>

        {/* ═══ FOOTER VIDEO ═══ */}
        {footerVideo && (
          <section className="mt-8 -mx-2 aspect-[9/16] sm:aspect-video rounded-[1.5rem] overflow-hidden bg-muted group shadow-2xl">
            <LazyVideo
              src={footerVideo}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-1000"
            />
          </section>
        )}

      </div>
    </div>
  );
}
