/** @type {import('next').NextConfig} */
const nextConfig = {
  // transformers.js runs only in the browser (client components); keep it out of the
  // server bundle so onnxruntime-node etc. aren't traced.
  serverExternalPackages: ["@huggingface/transformers"],
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
