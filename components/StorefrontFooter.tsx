import { Instagram, Youtube, Music2, Disc } from "lucide-react";
import prisma from "@/lib/db";
import ThreeDLogo from "./ThreeDLogo";
import LazyVideo from "./LazyVideo";
import Link from "next/link";

function shortenPolicyTitle(title: string) {
  const t = title.toLowerCase();
  if (t.includes("privacy")) return "Privacy";
  if (t.includes("terms") || t.includes("condition")) return "Terms";
  if (t.includes("refund") || t.includes("return") || t.includes("cancellation")) return "Returns";
  if (t.includes("shipping") || t.includes("delivery")) return "Shipping";
  return title.replace(/Policy/gi, "").trim();
}

export default async function StorefrontFooter() {
  let shop = null;
  let policies: any[] = [];

  try {
    const [shopData, policiesData] = await Promise.all([
      prisma.shop.findUnique({ where: { domain: "zicabella.com" } }).catch(() => null)
        .then(s => s || prisma.shop.findFirst().catch(() => null)),
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
    <footer className="w-full relative z-10 bg-white dark:bg-black" aria-label="Storefront Footer">
      {/* Top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

      {/* ─── DESKTOP (md+) ─── */}
      <div className="hidden md:block max-w-7xl mx-auto px-8 py-24">
        <div className="grid grid-cols-12 gap-8 items-start">
          
          {/* Brand Info (5 Columns) */}
          <div className="col-span-5 space-y-6">
            <div className="flex flex-col items-start gap-2.5">
              <ThreeDLogo src={s?.footerLogo3dUrl} size={36} />
              <h2 className="font-rocaston text-[12px] tracking-[0.18em] text-foreground font-light uppercase leading-none">ZICABELLA</h2>
            </div>

            <p className="text-[10px] font-normal text-foreground/35 leading-[2] tracking-wider max-w-xs">
              Redefining everyday boldness through meticulous engineering, premium textiles, and modern architectural standards. Designed in Italy, crafted in India.
            </p>

            {/* Footer video - clean layout */}
            {footerVideo && (
              <div className="relative w-full aspect-[21/9] rounded-2xl overflow-hidden group border border-foreground/[0.04] shadow-md bg-foreground/[0.01] max-w-xs">
                <LazyVideo src={footerVideo} className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity duration-1000" />
              </div>
            )}
          </div>

          {/* Discover Column (2 Columns) */}
          <div className="col-span-2 space-y-4 pt-2">
            <h3 className="text-[8.5px] font-bold uppercase tracking-[0.25em] text-foreground/25">Discover</h3>
            <ul className="space-y-3">
              {[
                { href: "/search", label: "Catalog" },
                { href: "/collections", label: "Collections" },
                { href: "/blogs", label: "Journal" },
                { href: "/wishlist", label: "Wishlist" },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[9.5px] font-normal tracking-[0.12em] uppercase text-foreground/45 hover:text-foreground transition-all duration-300 hover:translate-x-0.5 inline-block">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account Column (2 Columns) */}
          <div className="col-span-2 space-y-4 pt-2">
            <h3 className="text-[8.5px] font-bold uppercase tracking-[0.25em] text-foreground/25">Account</h3>
            <ul className="space-y-3">
              {[
                { href: "/profile", label: "Profile" },
                { href: "/orders", label: "Orders" },
                { href: "/cart", label: "Bag" },
                { href: "/support", label: "Support" },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[9.5px] font-normal tracking-[0.12em] uppercase text-foreground/45 hover:text-foreground transition-all duration-300 hover:translate-x-0.5 inline-block">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect Column (3 Columns) */}
          <div className="col-span-3 space-y-4 pt-2 flex flex-col items-start">
            <h3 className="text-[8.5px] font-bold uppercase tracking-[0.25em] text-foreground/25">Connect</h3>
            {socialLinks.length > 0 && (
              <div className="flex flex-col gap-2.5 w-full">
                {socialLinks.map(({ url, icon: Icon, label }) => (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                    className="group flex items-center justify-between text-foreground/45 hover:text-foreground transition-all duration-300 w-full max-w-[140px] py-1 border-b border-foreground/5 hover:border-foreground/10"
                  >
                    <span className="text-[9.5px] font-normal tracking-[0.12em] uppercase">{label}</span>
                    <Icon className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Bottom bar with Copyright & Policies */}
        <div className="mt-20 pt-8 border-t border-foreground/[0.04] flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-foreground/15">
              © {new Date().getFullYear()} ZICABELLA · ALL RIGHTS RESERVED
            </p>
            {policies.map((policy) => (
              <Link 
                key={policy.handle} 
                href={`/policies/${policy.handle}`}
                className="text-[8px] font-bold uppercase tracking-[0.25em] text-foreground/30 hover:text-foreground/80 transition-colors"
              >
                {shortenPolicyTitle(policy.title)}
              </Link>
            ))}
          </div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-foreground/15">
            DESIGNED IN ITALY · CRAFTED IN INDIA
          </p>
        </div>
      </div>

      {/* ─── MOBILE (below md) ─── */}
      <div className="md:hidden px-5 pt-10 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] flex flex-col items-center text-center">
        
        {/* Logo stacked — 3D on top, text below */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <ThreeDLogo src={s?.footerLogo3dUrl} size={30} />
          <h2 className="font-rocaston text-[10px] tracking-[0.22em] text-foreground/80 uppercase leading-none">ZICABELLA</h2>
        </div>

        {/* Social Row — tighter, minimal */}
        {socialLinks.length > 0 && (
          <div className="flex justify-center gap-4 mb-6">
            {socialLinks.map(({ url, icon: Icon, label }) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label}
                className="w-7 h-7 rounded-full border border-foreground/[0.08] flex items-center justify-center text-foreground/40 hover:text-foreground hover:border-foreground/20 transition-all duration-300 active:scale-90">
                <Icon className="w-3 h-3" />
              </a>
            ))}
          </div>
        )}

        {/* Navigation — single compact row with dot separators */}
        <div className="flex items-center justify-center gap-1 mb-4 flex-wrap">
          {[
            { href: "/search", label: "Shop" },
            { href: "/collections", label: "Collections" },
            { href: "/blogs", label: "Journal" },
            { href: "/profile", label: "Account" },
            { href: "/support", label: "Help" },
          ].map((link, idx) => (
            <div key={link.href} className="flex items-center gap-1">
              {idx > 0 && <span className="text-foreground/10 text-[5px] select-none">·</span>}
              <Link href={link.href} className="text-[8px] font-semibold uppercase tracking-[0.1em] text-foreground/40 hover:text-foreground transition-colors px-0.5">
                {link.label}
              </Link>
            </div>
          ))}
        </div>

        {/* Policies — ultra-compact inline */}
        <div className="flex items-center justify-center gap-1 mb-5 flex-wrap">
          {policies.map((policy: any, idx: number) => (
            <div key={policy.handle} className="flex items-center gap-1">
              {idx > 0 && <span className="text-foreground/8 text-[5px] select-none">·</span>}
              <Link
                href={`/policies/${policy.handle}`}
                className="text-[7px] font-medium uppercase tracking-[0.08em] text-foreground/25 hover:text-foreground transition-colors"
              >
                {shortenPolicyTitle(policy.title)}
              </Link>
            </div>
          ))}
        </div>

        {/* Copyright — minimal */}
        <p className="text-[6px] font-semibold uppercase tracking-[0.15em] text-foreground/12">
          © {new Date().getFullYear()} ZICABELLA · CRAFTED IN INDIA
        </p>

      </div>
    </footer>
  );
}
