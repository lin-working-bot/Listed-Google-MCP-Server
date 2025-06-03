/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // 禁用严格模式，避免组件渲染两次
  eslint: {
    ignoreDuringBuilds: true, // 在构建时忽略 ESLint 错误
  },
  typescript: {
    ignoreBuildErrors: true, // 在构建时忽略 TypeScript 错误
  },
};

module.exports = nextConfig;
