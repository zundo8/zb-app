import { fetchProductByHandle, fetchProducts, resolveShopifyGid, ShopifyProduct, fetchCollections } from "@/lib/shopify-admin";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ShoppingBag, Heart, Share2 } from "lucide-react";
import prisma from "@/lib/db";
import ProductDetailsClient from "./ProductDetailsClient";
import { Metadata } from "next";

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const product = await fetchProductByHandle(params.id).catch(() => null);
  if (!product) {
    return {
      title: "Product Not Found - Zica Bella",
    };
  }

  const title = `${product.title} | Premium Streetwear - Zica Bella`;
  const plainDescription = product.body_html 
    ? product.body_html.replace(/<[^>]*>/g, '').slice(0, 160) + '...'
    : `Shop ${product.title} at Zica Bella. India's #1 premium luxury streetwear label and fastest growing fashion app.`;
  
  const images = product.images?.length > 0 
    ? [product.images[0].src] 
    : ["/zb-logo-220px.png"];

  return {
    title,
    description: plainDescription,
    keywords: `${product.title}, zica bella streetwear, premium ${product.product_type || 'clothing'}, luxury clothing india, oversized fit`,
    openGraph: {
      title,
      description: plainDescription,
      type: "website",
      url: `https://zicabella.com/products/${product.handle}`,
      images: images.map(img => ({
        url: img,
        width: 800,
        height: 800,
        alt: product.title,
      })),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: plainDescription,
      images,
    },
  };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const [product, shop, allProducts, collections] = await Promise.all([
    fetchProductByHandle(params.id).catch(() => null),
    prisma.shop.findUnique({ where: { domain: "zicabella.com" } }).catch(() => null)
      .then(s => s || prisma.shop.findFirst().catch(() => null)),
    fetchProducts(8).catch(() => []),
    fetchCollections().catch(() => [])
  ]);

  const recommendedProducts = allProducts.filter((p: ShopifyProduct) => p.id.toString() !== params.id);

  // Resolve metafield GIDs to URLs
  if (product?.metafields) {
    for (const meta of product.metafields) {
      if (meta.value && typeof meta.value === 'string' && meta.value.startsWith('gid://shopify/')) {
        const resolvedUrl = await resolveShopifyGid(meta.value);
        if (resolvedUrl) {
          meta.value = resolvedUrl;
        }
      }
    }
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
          <Link href="/" className="px-6 py-3 bg-foreground text-background font-bold rounded-xl">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const images = product.images?.length > 0 ? product.images : [{ src: "/zb-logo-220px.png" }];
  const initialPrice = product.variants?.[0]?.price || "0.00";
  const comparePrice = product.variants?.[0]?.compare_at_price;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": product.title,
            "image": images.map(img => img.src),
            "description": product.body_html ? product.body_html.replace(/<[^>]*>/g, '') : product.title,
            "sku": product.variants?.[0]?.sku || product.id.toString(),
            "mpn": product.variants?.[0]?.barcode || product.id.toString(),
            "brand": {
              "@type": "Brand",
              "name": "Zica Bella"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.9",
              "bestRating": "5",
              "worstRating": "1",
              "ratingCount": "184"
            },
            "offers": {
              "@type": "Offer",
              "url": `https://zicabella.com/products/${product.handle}`,
              "priceCurrency": "INR",
              "price": parseFloat(initialPrice).toFixed(2),
              "priceValidUntil": "2029-12-31",
              "itemCondition": "https://schema.org/NewCondition",
              "availability": product.variants?.some(v => (v.inventory_quantity || 0) > 0)
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
              "seller": {
                "@type": "Organization",
                "name": "Zica Bella"
              }
            }
          })
        }}
      />
      <ProductDetailsClient 
        product={product} 
        shopSettings={shop as any} 
        recommendedProducts={recommendedProducts}
        allImages={images}
      />
    </>
  );
}

