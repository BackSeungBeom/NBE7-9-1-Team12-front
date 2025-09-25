/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
      return [
        // 프론트에서 /api/* 로 치면, 개발 서버가 8080 백엔드로 프록시해 줍니다.
        { source: '/api/:path*', destination: 'http://localhost:8080/:path*' },
      ];
    },
  };
  
  module.exports = nextConfig;
  