import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  // Auth and hash-based ERP screens are not public marketing pages.
  return [];
}
