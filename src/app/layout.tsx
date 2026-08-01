import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ranked · Make your poll", template: "%s · Ranked" },
  description: "Build, publish, and compare your college football Top 25.",
  applicationName: "Ranked",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09130f",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <span>Ranked</span>
          <span>Opinions, with receipts.</span>
        </footer>
      </body>
    </html>
  );
}
