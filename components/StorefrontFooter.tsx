import prisma from "@/lib/db";
import StorefrontFooterClient from "./StorefrontFooterClient";

export default async function StorefrontFooter() {
  let shop = null;
  let policies: any[] = [];
  let socialLinks: any[] = [];

  try {
    const [shopData, policiesData, socialLinksData] = await Promise.all([
      prisma.shop.findUnique({ where: { domain: "8tiahf-bk.myshopify.com" } }).catch(() => null)
        .then((s: any) => s || prisma.shop.findFirst().catch(() => null)),
      prisma.policy.findMany({ 
        select: { handle: true, title: true },
        orderBy: { title: 'asc' }
      }).catch(() => []),
      prisma.storeSettings.findUnique({
        where: { pageKey: 'social_links' }
      }).catch(() => null)
    ]);
    shop = shopData;
    policies = policiesData as any[];
    
    if (socialLinksData?.metaDescription) {
      try {
        socialLinks = JSON.parse(socialLinksData.metaDescription);
      } catch (e) {
        console.error("[Footer] Error parsing social links JSON:", e);
      }
    }
  } catch (error) {
    console.error("[Footer] Error querying settings/policies:", error);
  }

  // Serialize props to pass across Server-Client boundary cleanly
  const serializedShop = shop ? {
    domain: (shop as any).domain,
    instagramUrl: (shop as any).instagramUrl || undefined,
    appleUrl: (shop as any).appleUrl || undefined,
    spotifyUrl: (shop as any).spotifyUrl || undefined,
    youtubeUrl: (shop as any).youtubeUrl || undefined,
    footerLogo3dUrl: (shop as any).footerLogo3dUrl || undefined,
    footerVideo: (shop as any).footerVideo || undefined,
  } : null;

  const serializedPolicies = policies.map((p) => ({
    handle: p.handle,
    title: p.title,
  }));

  return (
    <StorefrontFooterClient 
      shop={serializedShop} 
      policies={serializedPolicies} 
      socialLinks={socialLinks} 
    />
  );
}
