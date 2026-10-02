/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdf.js optionally requires node-canvas; the browser build never needs it
    config.resolve.alias.canvas = false;
    return config;
  },
};
export default nextConfig;
