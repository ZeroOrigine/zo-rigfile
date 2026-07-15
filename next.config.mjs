/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/minds', destination: '/#minds', permanent: false },
      { source: '/constitution', destination: '/#constitution', permanent: false },
    ];
  },
};

export default nextConfig;
