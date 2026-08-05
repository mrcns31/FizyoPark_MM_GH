const baseConfig = require('./app.json');

const config = baseConfig.expo;

// iOS buildNumber ve Android versionCode için TEK kaynak.
// İkisi eşit olduğu sürece runtimeVersion (policy: nativeVersion) her iki
// platformda birebir aynı çıkar: "<version>(<BUILD_NUMBER>)".
// Her mağaza yüklemesinde artır; Play'e yüklenmiş en yüksek versionCode'dan büyük olmalı.
const BUILD_NUMBER = 11;

module.exports = {
  expo: {
    ...config,
    ios: {
      ...config.ios,
      buildNumber: String(BUILD_NUMBER),
    },
    android: {
      ...config.android,
      versionCode: BUILD_NUMBER,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  },
};
