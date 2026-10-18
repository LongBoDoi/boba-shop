// The Phaser rebuild in `phaser/` has its own node_modules and its own bundler (Vite). Metro must
// not crawl it: two copies of the same packages would collide in its module map.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.blockList = [/[\/]phaser[\/].*/];

module.exports = config;
