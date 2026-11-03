import "@fontsource-variable/urbanist";
import type { Viewport } from "next";
import { siteMetadata } from "@/lib/site";
import "./globals.css";
export const metadata = siteMetadata();
export const viewport: Viewport = {width: "device-width", initialScale: 1, themeColor: "#111513", colorScheme: "dark light"};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
