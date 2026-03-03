import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/r/:slug",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/r/:slug`,
      },
    ];
  },
};

export default nextConfig;
