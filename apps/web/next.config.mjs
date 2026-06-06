/** @type {import('next').NextConfig} */
const nextConfig = {
  // transformers.js runs only in the browser (client components); keep it out of the
  // server bundle so onnxruntime-node etc. aren't traced.
  serverExternalPackages: ["@huggingface/transformers"],
  // Vercel copies traced node_modules into each serverless function; the ONNX
  // runtimes are ~300MB and browser-only, which blows the 250MB function limit.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@huggingface/transformers/**",
      "node_modules/onnxruntime-node/**",
      "node_modules/onnxruntime-web/**",
      "node_modules/onnxruntime-common/**",
      "node_modules/sharp/**",
    ],
  },
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
