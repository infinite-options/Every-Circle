// webpack.config.js - Custom webpack config for Expo web
const path = require('path');

module.exports = async function (env, argv) {
  // Try to use Expo's webpack config if available
  let config;
  try {
    const createExpoWebpackConfigAsync = require('@expo/webpack-config');
    config = await createExpoWebpackConfigAsync(env, argv);
  } catch (e) {
    // If @expo/webpack-config is not available, create a basic config
    console.warn('@expo/webpack-config not found, using basic webpack config');
    config = {
      resolve: {
        alias: {},
      },
    };
  }

  // Alias TextInput to our web stub to prevent native module resolution
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  
  // Alias the TextInput component path
  config.resolve.alias['react-native/Libraries/Components/TextInput/TextInput'] = 
    path.resolve(__dirname, 'web-stubs/TextInput.js');
  
  // Alias TextInputState to prevent Platform resolution
  config.resolve.alias['react-native/Libraries/Components/TextInput/TextInputState'] = 
    path.resolve(__dirname, 'web-stubs/TextInputState.js');

  return config;
};

