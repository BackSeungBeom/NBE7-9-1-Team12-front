// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // 기존 API 프록시가 있다면 유지
      { source: '/api/:path*', destination: 'http://localhost:8080/:path*' },

      // 새 이미지 프록시
      { source: '/images/:path*', destination: 'http://localhost:8080/images/:path*' },
    ];
  },
};
module.exports = nextConfig;
