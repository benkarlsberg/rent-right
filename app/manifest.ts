import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rent Right",
    short_name: "Rent Right",
    description: "Free records and general information for California renters.",
    start_url: "/home",
    display: "standalone",
    background_color: "#f3eee4",
    theme_color: "#0f5c4c",
    lang: "en",
    icons: [{ src: "/icon", sizes: "64x64", type: "image/png" }],
  };
}
