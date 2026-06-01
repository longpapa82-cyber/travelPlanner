/**
 * withAndroidWindowBackground
 *
 * Android 스플래시 시퀀스 제어 플러그인.
 *
 * 목표 UX:
 *   파란 배경 + 아이콘 (~2.5초, JS 번들 로딩 중) → 흰색 스피너 (~3초, i18n 로딩 중) → 앱
 *
 * 타이밍 (logcat 실측, v280):
 *   +0.0s  Native Splash 표시 (windowSplashScreenBackground)
 *   +2.5s  JS 실행 시작 → mount useEffect → hideAsync() → Native Splash 종료
 *   +2.5s  !appReady 흰색 스피너 화면 표시 시작
 *   +5.7s  i18n + Font 로딩 완료 → appReady=true → 앱 표시
 *
 * 설정:
 *   windowSplashScreenBackground = #4A90D9 (파란 배경, Native splash 기간)
 *   android:windowBackground = #FFFFFF (JS 첫 프레임 흰 스피너와 동일 → flash 방지)
 *   splashscreen_background = #4A90D9 (colors.xml, Native splash 배경색 유지)
 *
 * NOTE: edgeToEdgeEnabled=false 이후 EdgeToEdgePackage.onCreate() 즉시 실행이 없으므로
 *   navigationBar inset 재계산 트리거도 제거됨. windowBackground 흰색은 추가 안전장치.
 * NOTE: iOS는 expo-splash-screen 플러그인 설정을 그대로 사용하므로 영향 없음.
 */
const { withAndroidStyles, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const SPLASH_COLOR = '#4A90D9';
const WINDOW_BG_COLOR = '#FFFFFF'; // JS 첫 프레임(흰 스피너)과 일치 → flash 제거

// windowSplashScreenBackground = 파란색 (Native Splash 배경)
// android:windowBackground = 흰색 (JS 첫 프레임 흰 스피너와 일치 → 전환 gap flash 제거)
const withWindowBackgroundStyle = (config) =>
  withAndroidStyles(config, (mod) => {
    const styles = mod.modResults;
    const resources = styles.resources;
    if (!resources || !resources.style) return mod;

    const appTheme = resources.style.find(
      (s) => s.$ && s.$.name === 'AppTheme'
    );
    if (appTheme) {
      if (!appTheme.item) appTheme.item = [];
      const existing = appTheme.item.find(
        (item) => item.$ && item.$.name === 'android:windowBackground'
      );
      if (existing) {
        existing._ = WINDOW_BG_COLOR;
      } else {
        appTheme.item.push({ $: { name: 'android:windowBackground' }, _: WINDOW_BG_COLOR });
      }
    }

    const splashTheme = resources.style.find(
      (s) => s.$ && s.$.name === 'Theme.App.SplashScreen'
    );
    if (splashTheme && splashTheme.item) {
      const bgItem = splashTheme.item.find(
        (item) => item.$ && item.$.name === 'windowSplashScreenBackground'
      );
      if (bgItem) {
        bgItem._ = SPLASH_COLOR;
      }
    }

    return mod;
  });

// colors.xml의 splashscreen_background도 동일 파란색으로 유지
// (expo-splash-screen이 android.splash.backgroundColor에서 이 값을 설정하지만
//  app.config.js android.splash.backgroundColor와 일치시켜 일관성 보장)
const withSplashBackgroundDrawable = (config) =>
  withDangerousMod(config, [
    'android',
    (mod) => {
      const colorsPath = path.join(
        mod.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'res', 'values', 'colors.xml'
      );
      if (fs.existsSync(colorsPath)) {
        let content = fs.readFileSync(colorsPath, 'utf8');
        content = content.replace(
          /<color name="splashscreen_background">[^<]*<\/color>/,
          `<color name="splashscreen_background">${SPLASH_COLOR}</color>`
        );
        fs.writeFileSync(colorsPath, content, 'utf8');
      }
      // splash_background.xml 잔재 제거 (이전 버전 파일)
      const drawableDir = path.join(
        mod.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'res', 'drawable'
      );
      const splashBgPath = path.join(drawableDir, 'splash_background.xml');
      if (fs.existsSync(splashBgPath)) {
        fs.unlinkSync(splashBgPath);
      }
      return mod;
    },
  ]);

module.exports = (config) => {
  config = withWindowBackgroundStyle(config);
  config = withSplashBackgroundDrawable(config);
  return config;
};
