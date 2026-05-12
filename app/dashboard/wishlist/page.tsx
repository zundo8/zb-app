"use client";

import { useEffect, useState } from "react";
import { 
  Heart, 
  Search, 
  Filter, 
  Download, 
  User, 
  Smartphone, 
  ExternalLink,
  Mail,
  MoreVertical,
  ChevronRight,
  MessageCircle,
  Zap
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface WishlistItem {
  id: string;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  };
  product: {
    id: string;
    title: string;
    featuredImage: string | null;
    shopifyProductId: string;
  };
}

export default function AdminWishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchWishlists();
  }, []);

  const fetchWishlists = async () => {
    try {
      const res = await fetch("/api/admin/wishlist");
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (error) {
      console.error("Error fetching wishlists:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.customer.phone.includes(searchTerm) ||
    item.product.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
            Wishlist Intelligence
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Track user interest and capture marketing leads for retargeting.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-foreground/5 border border-foreground/10 text-[12px] font-medium hover:bg-foreground/10 transition-all">
            <Download className="w-4 h-4 opacity-60" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Bookmarks", value: items.length, icon: Heart, color: "text-rose-500" },
          { label: "Unique Users", value: new Set(items.map(i => i.customer.id)).size, icon: User, color: "text-blue-500" },
          { label: "Active Leads", value: items.filter(i => i.customer.phone).length, icon: Smartphone, color: "text-emerald-500" },
          { label: "Conversion Potential", value: "High", icon: Filter, color: "text-amber-500" },
        ].map((stat, i) => (
          <div key={i} className="p-6 rounded-[2rem] glass border border-foreground/5 space-y-3">
            <div className={`p-2 rounded-xl bg-foreground/5 w-fit ${stat.color}`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div className="rounded-[2.5rem] glass border border-foreground/5 overflow-hidden">
        <div className="p-6 border-b border-foreground/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
            <input 
              type="text" 
              placeholder="Search customers or products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 rounded-2xl bg-foreground/5 border border-foreground/10 text-[13px] focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2.5 rounded-xl bg-foreground/5 border border-foreground/10 hover:bg-foreground/10">
              <Filter className="w-4 h-4 text-foreground/60" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-foreground/[0.02]">
                <th className="px-6 py-4 text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-4 text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Product Interesed</th>
                <th className="px-6 py-4 text-[10px] font-bold text-foreground/40 uppercase tracking-widest text-center">Contact</th>
                <th className="px-6 py-4 text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Added Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-foreground/40 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8">
                      <div className="h-10 bg-foreground/5 rounded-2xl" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <tr key={item.id} className="group hover:bg-foreground/[0.01] transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-[12px] font-bold border border-foreground/10">
                          {item.customer.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold">{item.customer.name}</p>
                          <p className="text-[11px] text-muted-foreground">{item.customer.email || "No email"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-foreground/5 border border-foreground/5 shadow-sm">
                          {item.product.featuredImage ? (
                            <Image 
                              src={item.product.featuredImage} 
                              alt={item.product.title} 
                              fill 
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                               <Heart className="w-4 h-4 opacity-20" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <p className="text-[13px] font-medium line-clamp-1">{item.product.title}</p>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-foreground/5 border border-foreground/10 w-fit text-foreground/40">
                             ID: {item.product.shopifyProductId.split('/').pop()}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <a 
                          href={`tel:${item.customer.phone}`}
                          className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                          title="Call Customer"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </a>
                        <a 
                          href={`https://wa.me/${item.customer.phone.replace('+', '')}?text=Hi%20${item.customer.name},%20we%20noticed%20you%20bookmarked%20the%20${item.product.title}!%20Would%20you%20like%20a%20special%20offer?`}
                          target="_blank"
                          className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                          title="WhatsApp Offer"
                        >
                           <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-[12px] text-foreground/60">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <div className="flex items-center justify-end gap-2">
                         <Link 
                           href={`/dashboard/notifications?targetType=user&targetValue=${item.customer.phone}&title=Special%20Offer&body=Hi%20${item.customer.name},%20the%20${item.product.title}%20is%20waiting%20for%20you!`}
                           className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-foreground text-background text-[10px] font-bold uppercase tracking-wider hover:scale-[1.02] transition-all"
                         >
                            <Zap className="w-3 h-3 fill-amber-400 text-amber-400" />
                            Send Offer
                         </Link>
                         <button className="p-2 rounded-lg hover:bg-foreground/5 text-foreground/40 hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Heart className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
                    <p className="text-[13px] font-medium text-foreground/40 uppercase tracking-widest">No bookmarks recorded yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

