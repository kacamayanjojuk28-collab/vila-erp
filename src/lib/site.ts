import type { Metadata } from "next";

export const siteDescription = "VILA ERP; müşteri ilişkileri, satış, satın alma, stok, finans ve proje operasyonlarını bir arada yönetmek için modüler işletme yönetim yazılımıdır.";

export function productionOrigin(environment = process.env.VILA_SITE_ENV, value = process.env.VILA_PUBLIC_ORIGIN): URL | undefined {
  if (environment !== "production" || !value) return undefined;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.port || !url.hostname.includes(".") || /(^localhost$|\.localhost$|\.local$|\.test$|\.invalid$|^127\.|^0\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|^\[)/.test(url.hostname)) {
    throw new Error("VILA_PUBLIC_ORIGIN must be the verified public HTTPS origin, without path or credentials");
  }
  return url;
}

export function siteMetadata(origin = productionOrigin()): Metadata {
  const title = "VILA ERP — İşletme çalışma alanı";
  const image = origin ? [{url: new URL("/brand/og.png", origin).href, width: 1200, height: 630, alt: "VILA ERP"}] : undefined;
  return {
    applicationName: "VILA ERP",
    title: {default: title, template: "%s | VILA ERP"},
    description: siteDescription,
    ...(origin ? {metadataBase: origin, alternates: {canonical: origin.href}} : {}),
    robots: {index: false, follow: false},
    openGraph: {title, description: siteDescription, siteName: "VILA ERP", locale: "tr_TR", type: "website", ...(origin ? {url: origin.href, images: image} : {})},
    twitter: {card: "summary_large_image", title, description: siteDescription, ...(image ? {images: image.map(i => i.url)} : {})},
    icons: {icon: [{url: "/brand/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon"}, {url: "/brand/icon.svg", type: "image/svg+xml"}], apple: [{url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png"}]},
    manifest: "/manifest.webmanifest",
    formatDetection: {telephone: false, email: false, address: false},
    appleWebApp: {capable: true, title: "VILA ERP", statusBarStyle: "default"},
  };
}
