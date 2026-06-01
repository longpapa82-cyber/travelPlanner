/**
 * withAndroidDeferEdgeToEdge
 *
 * 문제: edgeToEdgeEnabled=true 시 EdgeToEdgePackage.kt의 onCreate()에서
 *   WindowUtilKt.enableEdgeToEdge()를 즉시 호출 → navigationBarColor=TRANSPARENT로
 *   변경 → Samsung One UI의 WindowManager가 NavigationBar insets 재계산을
 *   'content appeared' 신호로 오해 → SplashScreen 강제 EXIT (dp(1) 후 0.62초).
 *   이후 reportDrawFinished(RN 첫 프레임)까지 5.36초 공백 → 아이콘 없는 빈 파란 화면.
 *
 * 해결: MainActivity.onCreate()에서 EdgeToEdgePackage의 자동 실행을 막고,
 *   SplashScreenManager.setOnExitAnimationListener 콜백(Splash가 실제로 사라진 후)
 *   에서 enableEdgeToEdge()를 직접 호출.
 *
 * 구현:
 *   - reflection-only: androidx.core.splashscreen 타입을 직접 import하지 않음
 *     (app/build.gradle에 명시적 의존성 없이 core-splashscreen API 사용 가능)
 *   - SplashScreenManager.splashScreen 필드를 reflection으로 접근
 *   - setOnExitAnimationListener / SplashScreenViewProvider 도 reflection으로 호출
 *   - withEndAction 이후(아이콘 완전 제거 후)에 WindowCompat + 색상 투명 적용
 */
const { withMainActivity } = require('@expo/config-plugins');

const SPLASH_END_MARKER = '// @generated end expo-splashscreen';
const PATCH_MARKER = '// @deferred-edge-to-edge';

// 순수 reflection 기반 Kotlin 코드:
// - androidx.core.splashscreen 타입을 import하지 않고 reflection으로만 처리
// - Functional Interface (SAM) 를 통해 setOnExitAnimationListener 호출
const DEFERRED_EDGE_TO_EDGE_CODE = `    // @deferred-edge-to-edge: enableEdgeToEdge를 Splash EXIT 이후로 지연
    // EdgeToEdgePackage.onCreate()의 자동 호출을 막고 여기서 직접 제어
    // reflection-only: core-splashscreen 타입을 app 모듈에서 직접 import하지 않음
    run {
      try {
        val managerClass = expo.modules.splashscreen.SplashScreenManager::class.java
        val splashField = managerClass.getDeclaredField("splashScreen")
        splashField.isAccessible = true
        val splashInstance = splashField.get(null) ?: return@run

        // SplashScreen.setOnExitAnimationListener(OnExitAnimationListener) 호출
        val splashClass = splashInstance.javaClass
        val listenerClass = Class.forName("androidx.core.splashscreen.SplashScreen\\$OnExitAnimationListener")
        val setListenerMethod = splashClass.getMethod("setOnExitAnimationListener", listenerClass)

        // SAM proxy: OnExitAnimationListener 구현
        val listenerProxy = java.lang.reflect.Proxy.newProxyInstance(
          listenerClass.classLoader,
          arrayOf(listenerClass)
        ) { _, _, args ->
          val provider = args[0] ?: return@newProxyInstance null
          val viewField = provider.javaClass.getMethod("getView")
          val view = viewField.invoke(provider) as? android.view.View ?: return@newProxyInstance null
          view.animate()
            .setDuration(0L)
            .alpha(0.0f)
            .setInterpolator(android.view.animation.AccelerateInterpolator())
            .withEndAction {
              try {
                provider.javaClass.getMethod("remove").invoke(provider)
              } catch (_: Exception) {}
              // Splash가 완전히 제거된 후 edgeToEdge 적용
              // → NavigationBar 변경이 Splash EXIT를 유발하지 않음
              androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)
              if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                window.isStatusBarContrastEnforced = false
                window.isNavigationBarContrastEnforced = false
              }
              window.statusBarColor = android.graphics.Color.TRANSPARENT
              window.navigationBarColor = android.graphics.Color.TRANSPARENT
            }.start()
          null
        }

        setListenerMethod.invoke(splashInstance, listenerProxy)
      } catch (_: Exception) {
        // reflection 실패 시 무시 — edge-to-edge가 즉시 적용될 뿐 크래시 없음
      }
    }`;

module.exports = (config) =>
  withMainActivity(config, (mod) => {
    let contents = mod.modResults.contents;

    // 이미 패치된 경우 중복 적용 방지
    if (contents.includes(PATCH_MARKER)) {
      return mod;
    }

    // registerOnActivity 호출 직후 (end marker 이후)에 코드 삽입
    if (!contents.includes(SPLASH_END_MARKER)) {
      console.warn(
        '[withAndroidDeferEdgeToEdge] expo-splashscreen generated block not found. Skipping.'
      );
      return mod;
    }

    contents = contents.replace(
      SPLASH_END_MARKER,
      `${SPLASH_END_MARKER}\n${DEFERRED_EDGE_TO_EDGE_CODE}`
    );

    mod.modResults.contents = contents;
    return mod;
  });
