import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Store } from "@/store/Store";
import Shell from "@/components/Shell";
import Toaster from "@/components/Toaster";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://centric-system.local"),
  title: { default: "Centric System Limited", template: "%s · Centric System Limited" },
  description: "Inventory, point of sale and shop management by Centric System Limited.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} antialiased`} suppressHydrationWarning>
      <body>
        <Store>
          <Shell>{children}</Shell>
          <Toaster />
        </Store>
      </body>
    </html>
  );
}
