"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingBag, User, MessageCircle } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function StorefrontNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { count } = useCart();

  const navItems = [
    { href: "/",       icon: Home,        label: "Home",    isCart: false },
    { href: "/search", icon: Search,      label: "Search",  isCart: false },
    { href: "/chat",   icon: MessageCircle, label: "Chat",    isCart: false },
    { href: "/cart",   icon: ShoppingBag, label: "Cart",    isCart: true  },
    { href: session ? "/profile" : "/login",  icon: User,        label: "Profile", isCart: false },
  ];
  const [hidden, setHidden] = useState(false);

  // Hide when QuickAdd modal opens, restore when it closes
  useEffect(() => {
    const hide = () => setHidden(true);
    const show = () => setHidden(false);
    window.addEventListener("quickadd:open", hide);
    window.addEventListener("quickadd:close", show);
    return () => {
      window.removeEventListener("quickadd:open", hide);
      window.removeEventListener("quickadd:close", show);
    };
  }, []);

  const isChatPage = pathname === "/chat";
  const isHomePage = pathname === "/";
  const isPolicyPage = pathname?.startsWith("/policies");
  
  const shouldHide = hidden || isChatPage || isHomePage || isPolicyPage;
  
  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[340px] z-50 transition-all duration-700 pointer-events-none"
      style={{ 
        transform: shouldHide ? "translate(-50%, 140%)" : "translate(-50%, 0)", 
        opacity: shouldHide ? 0 : 1,
      }}
    >
      <nav
        className="relative w-full h-[56px] rounded-[28px] pointer-events-auto overflow-hidden"
        style={{
          background: "rgba(255, 255, 255, 0.04)",
          backdropFilter: "blur(45px) saturate(210%)",
          WebkitBackdropFilter: "blur(45px) saturate(210%)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        }}
      >
        {/* Liquid Glass Highlight - Top Inner Glow */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent z-0 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

        <div className="flex h-full items-center justify-around px-3 relative z-10">
          {navItems.map(({ href, icon: Icon, label, isCart }) => {
            const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
            const isProfile = label === "Profile" && session;
            const profileImage = session?.user?.image || (session as any)?.customer?.image;

            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="relative flex-1 flex flex-col items-center justify-center h-full transition-all active:scale-95 group"
              >
                <div className="relative z-10 flex flex-col items-center gap-0.5">
                  {isProfile && profileImage ? (
                    <div className={`w-[16px] h-[16px] rounded-full overflow-hidden border transition-all duration-300 ${isActive ? 'border-white/60 scale-110' : 'border-transparent opacity-50 group-hover:opacity-70'}`}>
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <Icon
                      className={`w-[16px] h-[16px] transition-all duration-500 ${isActive ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'text-white/30 group-hover:text-white/50'}`}
                      strokeWidth={isActive ? 1.5 : 1.1}
                    />
                  )}
                  
                  <span className={`text-[7px] font-extralight uppercase tracking-[0.1em] transition-all duration-500 ${isActive ? 'text-white opacity-90' : 'text-white/25 group-hover:text-white/40'}`}>
                    {label}
                  </span>

                  {isCart && count > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2.5 min-w-[12px] h-3 px-1 rounded-full bg-white flex items-center justify-center text-black font-black shadow-[0_0_10px_rgba(255,255,255,0.3)] border border-white/50 animate-in zoom-in-50 duration-500"
                      style={{ fontSize: "6.5px", lineHeight: 1 }}
                    >
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
