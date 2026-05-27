const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Font + 3D model extensions as static assets
const extraAssetExts = ['woff', 'woff2', 'ttf', 'otf', 'glb', 'gltf'];
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, ...extraAssetExts])];

// Polyfill Node built-in standard library 'punycode' with the userland npm package
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  punycode: require.resolve('punycode'),
};

// ─── Next.js Coexistence ────────────────────────────────────────────────
// The parent directory contains a Next.js app (app.zicabella.com).
// Prevent Metro from trying to bundle Next.js-specific files.
const nextJsRoot = path.resolve(__dirname, '..');

config.resolver.blockList = [
  // Next.js app directory, pages, build output, and shared web components
  new RegExp(`${nextJsRoot}/app/.*`),
  new RegExp(`${nextJsRoot}/pages/.*`),
  new RegExp(`${nextJsRoot}/\\.next/.*`),
  new RegExp(`${nextJsRoot}/components/.*`),
  new RegExp(`${nextJsRoot}/lib/.*`),
  new RegExp(`${nextJsRoot}/prisma/.*`),
  new RegExp(`${nextJsRoot}/scripts/.*`),
  // Never crawl the parent node_modules (Next.js deps)
  new RegExp(`${nextJsRoot}/node_modules/.*`),
];

// Only watch the ZicaBella directory — prevents Metro from crawling upwards
config.watchFolders = [__dirname];

// Define platform-specific resolution priority (Android only)
config.resolver.platforms = ['android', 'native'];

module.exports = config;
