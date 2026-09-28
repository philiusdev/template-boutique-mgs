import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Royal Shop — Mode & friperie",
    short_name: "Royal Shop",
    description: "Une sélection de vêtements uniques au Burkina Faso.",
    id: "/",
    start_url: "/?source=home-screen",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f8f6f0",
    theme_color: "#31553f",
    icons: [
      { src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
