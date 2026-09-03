import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  async rewrites() {
    // Lets the browser call /backend/* on the same origin → forwarded to the API (handy for audio streams).
    const api = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1").replace(/\/api\/v1$/, "");
    return [{ source: "/backend/:path*", destination: `${api}/:path*` }];
  },
};

export default nextConfig;
