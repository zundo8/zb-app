import NextImage from "next/image";
import { Instagram, Youtube, Music2, Disc } from "lucide-react";
import prisma from "@/lib/db";

export default async function StorefrontFooter() {
  let shop = null;
  let policies = [];

  try {
    const [shopData, policiesData] = await Promise.all([
      prisma.shop.findFirst().catch(() => null),
      prisma.policy.findMany({ 
        select: { handle: true, title: true },
        orderBy: { title: 'asc' }
      }).catch(() => []),
    ]);
    shop = shopData;
    policies = policiesData as any[];
  } catch (error) {
    // Silently handle errors - fall back to defaults
  }

  const s = shop as any;
  const footerVideo = s?.footerVideo;

  const socialLinks = [
    { url: s?.instagramUrl, icon: Instagram, label: "Instagram" },
    { url: s?.appleUrl,     icon: Disc,      label: "Apple Music" },
    { url: s?.spotifyUrl,   icon: Music2,    label: "Spotify" },
    { url: s?.youtubeUrl,   icon: Youtube,   label: "YouTube" },
  ].filter((item) => item.url);

  return (
    <footer className="w-full pb-6 pt-6 px-4 text-center mt-1 relative z-10 glass rounded-t-[2rem] border-t-0">
      <div className="max-w-md mx-auto px-4">
        {/* 3D GLB Logo */}
        <div className="mb-3 flex justify-center cursor-pointer relative z-50">
          <div className="w-14 h-14">
            {/* @ts-expect-error model-viewer web component */}
            <model-viewer
              src={s?.footerLogo3dUrl || "https://cdn.shopify.com/3d/models/faaab5221b0b704c/Zicabella-logo-new22.glb"}
              alt="Zica Bella 3D Logo"
              auto-rotate
              camera-controls
              interaction-prompt="none"
              shadow-intensity="0.5"
              loading="lazy"
              style={{ width: "100%", height: "100%", background: "transparent", touchAction: "none" }}
            />
          </div>
        </div>

        {/* Brand name */}
        <h2 className="font-rocaston text-sm tracking-[0.05em] text-foreground font-light mb-0.5 uppercase">ZICA BELLA</h2>
        <p className="text-[6px] font-extralight uppercase tracking-[0.4em] text-muted-foreground/25 mb-4">Est. 2024</p>

        {/* Footer video */}
        {footerVideo && (
          <div className="mb-4 relative w-full aspect-video rounded-[1.5rem] overflow-hidden bg-muted shadow-xl border border-foreground/5">
            <video src={footerVideo} autoPlay loop muted playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-55 hover:opacity-80 transition-opacity duration-1000"
            />
          </div>
        )}

        {/* Social links */}
        {socialLinks.length > 0 && (
          <div className="flex justify-center gap-6 mb-4">
            {socialLinks.map(({ url, icon: Icon, label }) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label}
                className="text-foreground/30 hover:text-foreground transition-all duration-300 hover:scale-110 active:scale-90">
                <Icon className="w-[16px] h-[16px]" />
              </a>
            ))}
          </div>
        )}

        {/* Policy links — single compact row */}
        {policies.length > 0 && (
          <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 mb-3">
            {policies.map((policy: any, i: number) => (
              <span key={policy.handle} className="flex items-center gap-3">
                <a
                  href={`/policies/${policy.handle}`}
                  className="text-[6px] font-medium uppercase tracking-[0.25em] text-foreground/40 hover:text-foreground/70 transition-colors whitespace-nowrap"
                >
                  {policy.title}
                </a>
                {i < policies.length - 1 && (
                  <span className="text-foreground/15 text-[6px]">·</span>
                )}
              </span>
            ))}
          </div>
        )}


        <p className="text-[6px] font-extralight uppercase tracking-[0.3em] text-muted-foreground/20">
          © 2026 ZICA BELLA · LUXURY STREETWEAR
        </p>
      </div>
    </footer>
  );
}
