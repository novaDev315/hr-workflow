const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// SDK 53 resolves package.json "exports" by default, which picks zustand 4's
// ESM build; its `import.meta` crashes the web bundle (a classic script).
// Keep the SDK 52 resolution until zustand no longer needs it.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
