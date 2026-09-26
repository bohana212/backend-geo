import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Geotama Backend | Admin Panel",
  description: "Geotama Telegram Backend — Admin Dashboard v2.0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
