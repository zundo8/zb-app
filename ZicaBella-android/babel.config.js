module.exports = function(api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // React Native Reanimated MUST be last
      'react-native-reanimated/plugin'
    ],
  };
};

