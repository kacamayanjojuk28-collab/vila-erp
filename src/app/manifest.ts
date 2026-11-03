import type { MetadataRoute } from "next";
import { siteDescription } from "@/lib/site";
export default function manifest(): MetadataRoute.Manifest {
  return {id: "/", name: "VILA ERP", short_name: "VILA", description: siteDescription, lang: "tr", start_url: "/", scope: "/", display: "standalone", background_color: "#111513", theme_color: "#111513", icons: [192,512].flatMap(size => [
    {src: `/brand/pwa-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" as const},
    {src: `/brand/pwa-maskable-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "maskable" as const},
  ])};
}
