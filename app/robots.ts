import type { MetadataRoute } from "next";

/**
 * Serves /robots.txt for RigFile.
 *
 * The auth middleware matcher already excludes `robots.txt`, so this route is
 * publicly reachable by crawlers. We allow indexing of the public marketing
 * surface (home, pricing, login, signup) and explicitly disallow the
 * auth-gated app surface (dashboard, drivers, audit-files, billing, settings)
 * and all API routes, none of which should ever appear in search results.
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

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/login", "/signup"],
        disallow: [
          "/api/",
          "/dashboard",
          "/drivers",
          "/audit-files",
          "/billing",
          "/settings",
          "/auth/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
