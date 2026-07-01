const baseConfig = require('./app.json');

const config = baseConfig.expo;

module.exports = {
  expo: {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  },
};
