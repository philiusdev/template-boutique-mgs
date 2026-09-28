import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NetworkNotice, SiteFooter, SiteHeader } from "@/components/site-shell";
import { StoreProvider } from "@/components/store-provider";

export const metadata: Metadata = {
  title: "Royal Shop — La mode pour tous",
  description:
    "Vêtements et accessoires choisis avec soin au Burkina Faso. Livraison partout dans le pays.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171916",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="fr"><body className="streetwear-site"><StoreProvider><NetworkNotice /><SiteHeader />{children}<SiteFooter /></StoreProvider></body></html>;
}
