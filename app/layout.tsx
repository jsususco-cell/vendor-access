import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Byrdson Services — Vendor Portal",
  description: "Assigned jobs, schedule, photos and documents for Byrdson vendors.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
