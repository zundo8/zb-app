import { DM_Mono } from "next/font/google";
import React from "react";

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${dmMono.variable} min-h-screen bg-[#F5F6FA] text-slate-800 relative z-20`}>
      {children}
    </div>
  );
}
