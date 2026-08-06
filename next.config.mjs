/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []),
        /^(pg|pg-connection-string|pgpass|pg-protocol|pg-types|drizzle-orm)(\/.*)?$/,
      ];
    }
    return config;
  },
};
export default nextConfig;
