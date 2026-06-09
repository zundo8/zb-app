"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import { Star, MessageCircle, Heart, Upload } from "lucide-react";

interface FeaturedUser {
  id: string;
  name: string;
  imageUrl: string;
  instagramUrl?: string | null;
  styleDescription: string | null;
  reviews: { id: string; rating: number }[];
}

export default function FeaturedUsersSection({ 
  showCommunity = true, 
  title = "FEATURED LOOKS", 
  subtitle = "COMMUNITY",
  allFeatured = false,
  onUploadClick
}: { 
  showCommunity?: boolean;
  title?: string;
  subtitle?: string;
  allFeatured?: boolean;
  onUploadClick?: () => void;
}) {
  const [users, setUsers] = useState<FeaturedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!showCommunity) {
      setLoading(false);
      return;
    }
    const url = allFeatured ? "/api/featured-users" : "/api/featured-users?isTopFeatured=true";
    fetch(url, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.users) setUsers(data.users);
      })
      .finally(() => setLoading(false));
  }, [showCommunity, allFeatured]);

  if (!showCommunity) return null;
  if (loading) {
    return (
      <section className="py-4 px-4">
        <div className="flex gap-5 overflow-x-hidden pb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="min-w-[260px] shrink-0 aspect-[3/4.2] rounded-[2rem] bg-foreground/[0.03] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 mb-4 px-4 overflow-hidden">
      <div className="text-center mb-10">
        <h2 className="font-heading text-[8.5px] tracking-[0.45em] text-muted-foreground/30 mb-3 uppercase" style={{ fontFamily: "'HeadingPro', sans-serif" }}>{subtitle}</h2>
        <p className="font-heading text-[22px] tracking-[0.05em] text-foreground uppercase opacity-85" style={{ fontFamily: "'HeadingPro', sans-serif" }}>{title}</p>
      </div>

      <div className="relative group">
        <div className="flex gap-5 overflow-x-auto pb-8 hide-scrollbar snap-x px-4 -mx-4 items-center">
          {users.length > 0 ? (
            users.map((user) => {
              const avgRating = user.reviews.length > 0 
                ? user.reviews.reduce((acc: any, r: any) => acc + r.rating, 0) / user.reviews.length 
                : 5;

              return (
                <div 
                  key={user.id} 
                  className={`min-w-[260px] snap-center group ${user.instagramUrl ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                     if (user.instagramUrl) {
                        window.open(user.instagramUrl, '_blank', 'noopener,noreferrer');
                     }
                  }}
                >
                  <div className="relative aspect-[3/4.2] rounded-[2rem] overflow-hidden bg-foreground/[0.02] border border-foreground/[0.06] shadow-xl transition-all duration-700 active:scale-95">
                    <NextImage 
                      src={user.imageUrl || "/zb-logo-220px.png"} 
                      alt={user.name} 
                      fill 
                      className="object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-110"
                    />
                    
                     {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                    
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <span className="text-[10px] font-bold text-white tracking-[0.15em] uppercase">{user.name}</span>
                    </div>

                  </div>
                </div>
              );
            })
          ) : !onUploadClick ? (
            <div className="w-full flex flex-col items-center justify-center py-10 opacity-30">
              <Star className="w-8 h-8 mb-3" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Collective Forming</p>
            </div>
          ) : null}

          {/* Upload / Add Yours Card */}
          {onUploadClick && (
            <div 
              className="min-w-[260px] snap-center group cursor-pointer"
              onClick={onUploadClick}
            >
              <div className="relative aspect-[3/4.2] rounded-[2rem] overflow-hidden bg-foreground/[0.03] border border-dashed border-foreground/15 flex flex-col items-center justify-center transition-all duration-500 hover:bg-foreground/[0.05] hover:border-foreground/30 active:scale-95">
                <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110">
                  <Upload className="w-7 h-7 text-foreground/40" />
                </div>
                <div className="text-center px-6">
                  <p className="text-[12px] font-bold text-foreground/80 tracking-widest uppercase mb-1">Add Yours</p>
                  <p className="text-[9px] text-foreground/40 font-medium leading-relaxed">
                    Publish your look to the visual collective
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
      </div>
    </section>
  );
}
