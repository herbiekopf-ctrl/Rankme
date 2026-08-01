import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ranked",
    short_name: "Ranked",
    description: "Build and publish your college football Top 25.",
    start_url: "/",
    display: "standalone",
    background_color: "#09130f",
    theme_color: "#09130f",
  };
}
