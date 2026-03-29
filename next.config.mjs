/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent webpack from bundling better-sqlite3 (native module).
  // On Vercel (where DATABASE_URL is set), the SQLite code path is never
  // reached, but webpack still needs to skip the native require.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
