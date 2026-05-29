import { Instagram, Youtube, Music2, Disc, ArrowUpRight } from "lucide-react";
import prisma from "@/lib/db";
import ThreeDLogo from "./ThreeDLogo";
import LazyVideo from "./LazyVideo";

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
    <footer className="w-full relative z-10">
      {/* Top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

      {/* ─── DESKTOP (md+) ─── */}
      <div className="hidden md:block max-w-7xl mx-auto px-8 py-20">
        {/* Grid: 3D Logo | Links | Social */}
        <div className="grid grid-cols-12 gap-12 items-start">
          
          {/* Brand Column */}
          <div className="col-span-4 space-y-6">
            <div className="flex items-center gap-4">
              <ThreeDLogo src={s?.footerLogo3dUrl} size={48} />
              <div>
                <h2 className="font-rocaston text-sm tracking-[0.08em] text-foreground font-light uppercase leading-none">ZICA BELLA</h2>
                <p className="text-[7px] font-semibold uppercase tracking-[0.4em] text-foreground/20 mt-1">Luxury Streetwear</p>
              </div>
            </div>

            <p className="text-[10px] font-normal text-foreground/30 leading-[1.9] tracking-wide max-w-xs">
              Redefining bold everyday style through refined technical engineering and premium modern standards. Crafted in India for the relentless.
            </p>

            {/* Footer video */}
            {footerVideo && (
              <div className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden group border border-foreground/[0.04]">
                <LazyVideo src={footerVideo} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-70 transition-opacity duration-1000" />
              </div>
            )}
          </div>

          {/* Navigation Columns */}
          <div className="col-span-5 grid grid-cols-3 gap-6 pt-1">
            {/* Discover */}
            <div className="space-y-4">
              <h3 className="text-[8px] font-bold uppercase tracking-[0.3em] text-foreground/25">Discover</h3>
              <ul className="space-y-2.5">
                {[
                  { href: "/search", label: "Catalog" },
                  { href: "/collections", label: "Collections" },
                  { href: "/blogs", label: "Journal" },
                  { href: "/wishlist", label: "Wishlist" },
                ].map(link => (
                  <li key={link.href}>
                    <a href={link.href} className="text-[9px] font-medium text-foreground/40 hover:text-foreground transition-colors duration-300 tracking-wide">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account */}
            <div className="space-y-4">
              <h3 className="text-[8px] font-bold uppercase tracking-[0.3em] text-foreground/25">Account</h3>
              <ul className="space-y-2.5">
                {[
                  { href: "/profile", label: "Profile" },
                  { href: "/orders", label: "Orders" },
                  { href: "/cart", label: "Bag" },
                  { href: "/support", label: "Support" },
                ].map(link => (
                  <li key={link.href}>
                    <a href={link.href} className="text-[9px] font-medium text-foreground/40 hover:text-foreground transition-colors duration-300 tracking-wide">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-4">
              <h3 className="text-[8px] font-bold uppercase tracking-[0.3em] text-foreground/25">Legal</h3>
              {policies.length > 0 ? (
                <ul className="space-y-2.5">
                  {policies.map((policy) => (
                    <li key={policy.handle}>
                      <a href={`/policies/${policy.handle}`} className="text-[9px] font-medium text-foreground/40 hover:text-foreground transition-colors duration-300 tracking-wide whitespace-nowrap">
                        {policy.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[8px] text-foreground/15 tracking-wide">No policies</p>
              )}
            </div>
          </div>

          {/* Social Column */}
          <div className="col-span-3 flex flex-col items-end gap-6 pt-1">
            <h3 className="text-[8px] font-bold uppercase tracking-[0.3em] text-foreground/25">Connect</h3>
            {socialLinks.length > 0 && (
              <div className="flex flex-col gap-3">
                {socialLinks.map(({ url, icon: Icon, label }) => (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                    className="group flex items-center gap-2.5 text-foreground/30 hover:text-foreground transition-all duration-300"
                  >
                    <span className="text-[9px] font-medium tracking-wide opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">{label}</span>
                    <div className="w-8 h-8 rounded-full border border-foreground/[0.06] flex items-center justify-center group-hover:border-foreground/[0.15] transition-all duration-300">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-6 border-t border-foreground/[0.04] flex justify-between items-center">
          <p className="text-[7px] font-semibold uppercase tracking-[0.25em] text-foreground/15">
            © {new Date().getFullYear()} Zica Bella
          </p>
          <p className="text-[7px] font-semibold uppercase tracking-[0.2em] text-foreground/15">
            Crafted in India
          </p>
        </div>
      </div>

      {/* ─── MOBILE (below md) ─── */}
      <div className="md:hidden px-6 pt-12 pb-8">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <ThreeDLogo src={s?.footerLogo3dUrl} size={40} />
          <div>
            <h2 className="font-rocaston text-xs tracking-[0.06em] text-foreground font-light uppercase leading-none">ZICA BELLA</h2>
            <p className="text-[6px] font-semibold uppercase tracking-[0.4em] text-foreground/20 mt-0.5">Luxury Streetwear</p>
          </div>
        </div>

        {/* Footer video mobile removed for performance optimization */}

        {/* Navigation grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="space-y-3">
            <h3 className="text-[7px] font-bold uppercase tracking-[0.3em] text-foreground/25">Discover</h3>
            <ul className="space-y-2">
              {[
                { href: "/search", label: "Catalog" },
                { href: "/collections", label: "Collections" },
                { href: "/blogs", label: "Journal" },
                { href: "/wishlist", label: "Wishlist" },
              ].map(link => (
                <li key={link.href}>
                  <a href={link.href} className="text-[8px] font-medium text-foreground/40 hover:text-foreground transition-colors tracking-wide">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="text-[7px] font-bold uppercase tracking-[0.3em] text-foreground/25">Account</h3>
            <ul className="space-y-2">
              {[
                { href: "/profile", label: "Profile" },
                { href: "/orders", label: "Orders" },
                { href: "/cart", label: "Bag" },
                { href: "/support", label: "Support" },
              ].map(link => (
                <li key={link.href}>
                  <a href={link.href} className="text-[8px] font-medium text-foreground/40 hover:text-foreground transition-colors tracking-wide">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Social row */}
        {socialLinks.length > 0 && (
          <div className="flex justify-start gap-3 mb-6">
            {socialLinks.map(({ url, icon: Icon, label }) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label}
                className="w-8 h-8 rounded-full border border-foreground/[0.06] flex items-center justify-center text-foreground/25 hover:text-foreground transition-all duration-300 active:scale-90">
                <Icon className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="h-px w-full mb-4 bg-foreground/[0.04]" />

        {/* Policy links */}
        {policies.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4">
            {policies.map((policy: any, i: number) => (
              <span key={policy.handle} className="flex items-center gap-3">
                <a
                  href={`/policies/${policy.handle}`}
                  className="text-[6.5px] font-medium uppercase tracking-[0.2em] text-foreground/30 hover:text-foreground transition-colors whitespace-nowrap"
                >
                  {policy.title}
                </a>
                {i < policies.length - 1 && (
                  <span className="text-foreground/10 text-[5px]">·</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Copyright */}
        <p className="text-[6px] font-semibold uppercase tracking-[0.25em] text-foreground/15">
          © {new Date().getFullYear()} Zica Bella · Crafted in India
        </p>
      </div>
    </footer>
  );
}
