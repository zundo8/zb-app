import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zica Bella | India's & World's #1 Luxury Streetwear Brand & App",
    short_name: "Zica Bella",
    description: "Shop Zica Bella - India's leading luxury streetwear fashion label. Discover custom oversized tees, heavyweight hoodies, premium denim, and limited collections.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/zb-logo-220px.png",
        sizes: "220x220",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/zb-logo-220px.png",
        sizes: "220x220",
        type: "image/png",
        purpose: "maskable",
      }
    ],
  };
}
