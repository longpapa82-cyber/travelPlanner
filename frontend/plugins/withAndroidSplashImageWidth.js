/**
 * withAndroidSplashImageWidth
 *
 * expo-splash-screen의 Android splash imageWidth 설정 버그 우회 플러그인.
 *
 * 문제: app.config.js의 android.splash.imageWidth 값이 getAndroidSplashConfig에서
 * 무시되고 항상 200으로 하드코딩됨 (props=undefined 경로 사용 시).
 * 결과: 아이콘이 canvas(288dp)의 69%만 채워 작게 보임.
 *
 * 해결: withAndroidSplashImages를 직접 imageWidth=288로 호출해서
 * 아이콘 박스가 canvas 전체(288dp)를 채우도록 강제.
 */
const { withAndroidSplashImages } = require(
  '@expo/prebuild-config/build/plugins/unversioned/expo-splash-screen/withAndroidSplashImages'
);
const { getAndroidSplashConfig } = require(
  '@expo/prebuild-config/build/plugins/unversioned/expo-splash-screen/getAndroidSplashConfig'
);

module.exports = (config) => {
  const splash = getAndroidSplashConfig(config, null);
  if (!splash) return config;

  // imageWidth를 288로 강제 — canvasSize(288*multiplier)와 동일해져
  // 아이콘 박스가 canvas 전체를 채움
  const patchedSplash = { ...splash, imageWidth: 288 };

  return withAndroidSplashImages(config, patchedSplash);
};
