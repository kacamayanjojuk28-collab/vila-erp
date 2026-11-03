import "@fontsource-variable/urbanist";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "VILA · İşletme çalışma alanı",
  description: "VILA ERP",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
