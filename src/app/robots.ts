import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  // Crawlers must be able to read noindex. Authorization protects ERP data.
  // There are currently no indexable marketing URLs, hence no sitemap submission.
  return {rules: {userAgent: "*", allow: "/"}};
}
