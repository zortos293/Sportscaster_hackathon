import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/live", permanent: false },
      { source: "/dashboard/watch/:gameId", destination: "/live/watch/:gameId", permanent: false },
      { source: "/dashboard/live/:gameId", destination: "/live/stream/:gameId", permanent: false },
    ];
  },
};

export default nextConfig;
