"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import { Star, MessageCircle, Heart, Upload, Instagram } from "lucide-react";

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
            <div key={i} className="min-w-[200px] md:min-w-[280px] shrink-0 aspect-[9/16] rounded-[2rem] bg-foreground/[0.03] animate-pulse" />
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
        <div className="flex gap-3 md:gap-6 overflow-x-auto pb-8 hide-scrollbar snap-x px-4 -mx-4 items-start">
          {users.length > 0 ? (
            users.map((user) => {
              const avgRating = user.reviews.length > 0 
                ? user.reviews.reduce((acc: any, r: any) => acc + r.rating, 0) / user.reviews.length 
                : 5;

              return (
                <div 
                  key={user.id} 
                  className={`w-[calc((100vw-56px)/3)] md:w-[calc((100%-48px)/3)] md:max-w-[340px] md:flex-1 shrink-0 snap-center group flex flex-col gap-2.5 ${user.instagramUrl ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                     if (user.instagramUrl) {
                        window.open(user.instagramUrl, '_blank', 'noopener,noreferrer');
                     }
                  }}
                >
                  <div className="relative aspect-[9/16] rounded-[2rem] overflow-hidden bg-foreground/[0.02] border border-foreground/[0.06] shadow-md transition-all duration-300">
                    <NextImage 
                      src={user.imageUrl || "/zb-logo-220px.png"} 
                      alt={user.name} 
                      fill 
                      className="object-cover"
                    />
                  </div>
                  
                  {/* Clean, minimal name text below card */}
                  <div className="text-center">
                    <span className="text-[8px] md:text-[10px] font-bold text-foreground/60 tracking-[0.25em] uppercase select-none">
                      {user.name}
                    </span>
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
              className="w-[calc((100vw-56px)/3)] md:w-[calc((100%-48px)/3)] md:max-w-[340px] md:flex-1 shrink-0 snap-center group cursor-pointer flex flex-col gap-2.5"
              onClick={onUploadClick}
            >
              <div className="relative aspect-[9/16] rounded-[2rem] overflow-hidden bg-foreground/[0.02] border border-dashed border-foreground/15 flex flex-col items-center justify-center transition-all duration-300">
                <div className="w-8 h-8 md:w-16 md:h-16 rounded-full bg-foreground/5 flex items-center justify-center mb-1">
                  <Upload className="w-4 h-4 md:w-7 md:h-7 text-foreground/40" />
                </div>
                <div className="text-center px-1 md:px-6">
                  <p className="text-[6px] md:text-[9px] text-foreground/30 font-medium leading-normal max-w-[200px]">
                    Publish Look
                  </p>
                </div>
              </div>
              <div className="text-center">
                <span className="text-[8px] md:text-[10px] font-bold text-foreground/60 tracking-[0.25em] uppercase select-none">
                  Add Yours
                </span>
              </div>
            </div>
          )}
        </div>
        
      </div>
    </section>
  );
}
