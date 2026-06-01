/**
 * withFixSplashScreenRaceCondition
 *
 * 문제: 첫 설치 후 첫 실행 시 Android 스플래시 아이콘이 표시되지 않는 버그.
 *
 * 근본 원인 (Race Condition):
 *   SplashScreenManager.kt의 contentAppearedListener는
 *   ReactMarkerConstants.CONTENT_APPEARED 이벤트 발생 시
 *   preventAutoHideCalled = false이면 hide()를 자동 호출한다.
 *
 *   첫 실행: JS 번들 파싱 느림 → CONTENT_APPEARED가 먼저 발생
 *     → preventAutoHideCalled = false → hide() 자동 호출 → 스플래시 즉시 숨겨짐
 *
 *   두 번째~: JS 번들 캐시 사용 → preventAutoHideAsync() 호출이 먼저 도달
 *     → preventAutoHideCalled = true → hide() 차단 → 정상 표시
 *
 * 해결: expo-splash-screen의 prebuild가 registerOnActivity(this)를 생성한 바로 뒤에
 *   SplashScreenManager.preventAutoHideCalled = true 를 삽입한다.
 *   이렇게 하면 CONTENT_APPEARED가 언제 발생하든 자동 hide()가 호출되지 않는다.
 *   스플래시 숨기기는 App.tsx의 SplashScreen.hideAsync()가 여전히 담당한다.
 */
const { withMainActivity } = require('@expo/config-plugins');

const GENERATED_END_MARKER = '// @generated end expo-splashscreen';
const FIX_LINE = '    SplashScreenManager.preventAutoHideCalled = true';

module.exports = (config) =>
  withMainActivity(config, (mod) => {
    let contents = mod.modResults.contents;

    // 이미 패치된 경우 중복 적용 방지
    if (contents.includes('SplashScreenManager.preventAutoHideCalled')) {
      return mod;
    }

    // expo-splash-screen prebuild 생성 블록 끝 마커 다음 줄에 삽입
    if (!contents.includes(GENERATED_END_MARKER)) {
      // 마커가 없으면 패치 불가 — 경고만 출력하고 중단
      console.warn(
        '[withFixSplashScreenRaceCondition] expo-splashscreen generated block not found. ' +
          'Skipping patch. Check if expo-splash-screen is installed and prebuild ran first.'
      );
      return mod;
    }

    contents = contents.replace(
      GENERATED_END_MARKER,
      `${GENERATED_END_MARKER}\n${FIX_LINE}`
    );

    mod.modResults.contents = contents;
    return mod;
  });
