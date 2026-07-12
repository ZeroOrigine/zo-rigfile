import type { MetadataRoute } from "next";

/**
 * Serves /sitemap.xml for RigFile's public marketing routes.
 *
 * The auth middleware matcher already excludes `sitemap.xml`, so this route
 * is publicly reachable by crawlers. Only marketing pages are listed here —
 * dashboard, billing, drivers, audit-files, and API routes are auth-gated
 * and intentionally omitted from the sitemap.
 */

function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    return `https://${vercel.replace(/\/+$/, "")}`;
  }
  return "https://rigfile.com";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const lastModified = new Date();

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/login`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
