import { fetchProductByHandle, fetchProducts, resolveShopifyGid, ShopifyProduct, fetchCollections } from "@/lib/shopify-admin";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ShoppingBag, Heart, Share2 } from "lucide-react";
import prisma from "@/lib/db";
import ProductDetailsClient from "./ProductDetailsClient";
import { Metadata } from "next";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import { Breadcrumb } from "@/components/seo/Breadcrumb";

export const revalidate = 60; // ISR: revalidate every 60 seconds

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const product = await fetchProductByHandle(params.id).catch(() => null);

  if (!product) {
    return {
      title: 'Product Not Found | Zica Bella®',
      robots: { index: false, follow: false },
    }
  }

  const price = product.variants?.[0]?.price || "0";
  const priceFormatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(price))

  const productType = product.product_type?.toLowerCase() || 'streetwear';
  let categoryTag = 'Heavyweight Oversized Tee';
  
  if (productType.includes('hoodie')) {
    categoryTag = 'Heavyweight Fleece Hoodie';
  } else if (productType.includes('pant') || productType.includes('jean') || productType.includes('denim') || productType.includes('trouser')) {
    categoryTag = 'Luxury Streetwear Denim';
  } else if (productType.includes('accessory') || productType.includes('cap') || productType.includes('hat') || productType.includes('socks')) {
    categoryTag = 'Subculture Accessory';
  } else if (productType.includes('jacket') || productType.includes('outerwear') || productType.includes('zip')) {
    categoryTag = 'Streetwear Outerwear';
  } else if (productType.includes('t-shirt') || productType.includes('tee')) {
    categoryTag = 'Heavyweight Oversized Tee';
  }

  // Create a premium, unique streetwear title
  const title = `${product.title} — ${priceFormatted} | ${categoryTag} | Zica Bella®`

  // Process tags & title to extract specifications
  const tagsList = product.tags ? product.tags.split(',').map((t: string) => t.trim().toLowerCase()) : [];
  const hasAcidWash = tagsList.some(t => t.includes('acid') || t.includes('wash') || t.includes('vintage') || t.includes('fade'));
  const isHeavy = tagsList.some(t => t.includes('heavy') || t.includes('gsm') || t.includes('300') || t.includes('240') || t.includes('400'));
  const isLoopback = tagsList.some(t => t.includes('loopback') || t.includes('french') || t.includes('terry'));
  
  let specText = '';
  if (hasAcidWash) specText += 'vintage acid-wash finish, ';
  if (isLoopback) specText += 'double-yarn loopback cotton, ';
  else if (isHeavy) specText += 'heavyweight premium cotton, ';
  specText += 'relaxed drop-shoulder silhouette, and premium high-definition graphic prints.';

  const cleanBodyHtml = product.body_html
    ? product.body_html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    : '';

  const shortDesc = cleanBodyHtml.length > 120 ? `${cleanBodyHtml.slice(0, 117)}...` : cleanBodyHtml;
  
  // Construct dynamic description using Shopify product data and tags
  const description = `Shop ${product.title} at Zica Bella® for ${priceFormatted}. Premium ${categoryTag.toLowerCase()} featuring ${specText} ${shortDesc ? `Details: ${shortDesc}` : ''} Crafted in India, worn with intent. Free shipping above ₹999.`.slice(0, 290);

  // Dynamic keyword generation
  const customKeywords = [
    product.title,
    'Zica Bella',
    categoryTag,
    product.product_type || 'streetwear apparel',
    ...tagsList,
    'oversized graphic tee',
    'luxury streetwear India',
    'drop shoulder fit',
    'street wear accessories',
    'premium cotton blanks',
  ].filter((v, i, self) => v && self.indexOf(v) === i).slice(0, 15);

  return {
    title,
    description,
    keywords: customKeywords,
    alternates: {
      canonical: `https://www.zicabella.com/products/${product.handle}`,
    },
    openGraph: {
      title,
      description,
      url: `https://www.zicabella.com/products/${product.handle}`,
      type: 'website',
      images: product.images?.[0]?.src
        ? [
            {
              url: product.images[0].src,
              width: 800,
              height: 800,
              alt: product.title,
            },
          ]
        : [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Zica Bella®' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: product.images?.[0]?.src ? [product.images[0].src] : ['/og-image.jpg'],
    },
  }
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const [product, shop, allProducts] = await Promise.all([
    fetchProductByHandle(params.id).catch(() => null),
    prisma.shop.findUnique({ where: { domain: "8tiahf-bk.myshopify.com" } }).catch(() => null)
      .then((s: any) => s || prisma.shop.findFirst().catch(() => null)),
    fetchProducts(12).catch(() => [])
  ]);

  const recommendedProducts = allProducts.filter((p: ShopifyProduct) => p.id.toString() !== params.id);

  // Resolve metafield GIDs to URLs
  if (product?.metafields) {
    await Promise.all(
      product.metafields.map(async (meta) => {
        if (meta.value && typeof meta.value === 'string' && meta.value.startsWith('gid://shopify/')) {
          const resolvedUrl = await resolveShopifyGid(meta.value);
          if (resolvedUrl) {
            meta.value = resolvedUrl;
          }
        }
      })
    );
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

  const productLdData = {
    id: product.id.toString(),
    name: product.title,
    description: product.body_html ? product.body_html.replace(/<[^>]*>/g, '') : product.title,
    price: parseFloat(initialPrice),
    compareAtPrice: comparePrice ? parseFloat(comparePrice) : undefined,
    currency: "INR",
    images: product.images?.map(img => ({ url: img.src, alt: product.title })) || [{ url: "/zb-logo-220px.png", alt: product.title }],
    slug: product.handle,
    sku: product.variants?.[0]?.sku || undefined,
    inStock: product.variants?.some(v => (v.inventory_quantity || 0) > 0) || false,
    brand: "Zica Bella",
    category: product.product_type || "Apparel > Tops > T-Shirts",
    rating: { value: 4.9, count: 184 }
  };

  return (
    <>
      <ProductJsonLd product={productLdData} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 md:pt-28 pb-0 md:pb-2 relative z-20 text-foreground">
        <Breadcrumb
          items={[
            { name: 'Home', url: '/' },
            { name: product.product_type || 'Apparel', url: `/collections` },
            { name: product.title, url: `/products/${product.handle}` },
          ]}
        />
      </div>
      <ProductDetailsClient 
        product={product} 
        shopSettings={shop as any} 
        recommendedProducts={recommendedProducts}
        allImages={images}
      />
    </>
  );
}

