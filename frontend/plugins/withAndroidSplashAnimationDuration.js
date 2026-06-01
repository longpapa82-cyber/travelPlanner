/**
 * withAndroidSplashAnimationDuration
 *
 * Android 12+ 스플래시 아이콘 EXIT 애니메이션 제거 플러그인.
 *
 * 문제: windowSplashScreenAnimatedIcon이 설정되면 Android 12+ OS가
 *   suggestType=3 (SPLASH_SCREEN_STYLE_ICON) 모드로 스플래시를 표시하고,
 *   SplashScreen.hideAsync() 호출 시 OS 레벨에서 아이콘 EXIT 애니메이션
 *   (축소+사라짐, ~333ms)을 자동 실행한다.
 *   이 애니메이션은 JS 레이어(setOptions fade/duration)로는 제어 불가.
 *   결과: 아이콘이 사라지고 배경만 남았다가 앱 화면으로 전환되는 공백 발생.
 *
 * 해결: windowSplashScreenAnimationDuration=0 → OS가 아이콘 EXIT 애니메이션을
 *   건너뜀. styles.xml은 expo-splash-screen prebuild에 의해 덮어써지므로
 *   config-plugin으로 보호해야 한다.
 */
const { withAndroidStyles } = require('@expo/config-plugins');

module.exports = (config) =>
  withAndroidStyles(config, (mod) => {
    const styles = mod.modResults;

    // Theme.App.SplashScreen 스타일 찾기
    const resources = styles.resources;
    if (!resources || !resources.style) return mod;

    const splashStyle = resources.style.find(
      (s) => s.$ && s.$.name === 'Theme.App.SplashScreen'
    );
    if (!splashStyle) return mod;

    // item 배열 초기화
    if (!splashStyle.item) splashStyle.item = [];

    // 이미 설정된 경우 중복 방지
    const alreadySet = splashStyle.item.some(
      (item) => item.$ && item.$.name === 'windowSplashScreenAnimationDuration'
    );
    if (alreadySet) return mod;

    splashStyle.item.push({
      $: { name: 'windowSplashScreenAnimationDuration' },
      _: '0',
    });

    return mod;
  });
