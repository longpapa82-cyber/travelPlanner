/**
 * withAndroidMapQueries
 *
 * Android 11+ (API 30) package visibility 대응 플러그인.
 *
 * 문제:
 *   Android 11부터 <queries> 미선언 스킴은 Linking.canOpenURL()이 앱 설치 여부와
 *   무관하게 항상 false를 반환한다. TripMapView의 "구글맵으로 열기"는 `geo:` 스킴을
 *   쓰는데 매니페스트 <queries>에 https만 있어 canOpenURL('geo:...')이 false → 앱
 *   실행 경로가 죽고, 폴백(https)마저 .catch 부재로 조용히 사라져 "아무 반응 없음"이 됐다.
 *
 * 수정:
 *   <queries>에 geo 스킴 intent를 추가해 지도 앱(구글맵 등)을 canOpenURL로 조회 가능하게 한다.
 *   android.intentFilters(수신 딥링크)와는 별개 — <queries>는 발신(canOpenURL) 가시성 제어라
 *   Expo 기본 prop이 없어 config plugin으로 매니페스트를 직접 병합한다.
 *
 * NOTE: prebuild --clean 후에도 유지되도록 네이티브 매니페스트 직접 수정이 아닌 플러그인으로 구현.
 * NOTE: iOS는 app.config.js ios.infoPlist.LSApplicationQueriesSchemes로 별도 선언(comgooglemaps, maps).
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const GEO_SCHEME = 'geo';

const withAndroidMapQueries = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    // <queries> 노드 확보 (없으면 생성)
    if (!Array.isArray(manifest.queries)) {
      manifest.queries = [{}];
    }
    const queries = manifest.queries[0];

    if (!Array.isArray(queries.intent)) {
      queries.intent = [];
    }

    // geo 스킴 intent가 이미 있으면 중복 추가하지 않음 (idempotent)
    const hasGeoQuery = queries.intent.some((intent) =>
      intent?.data?.some((d) => d?.$?.['android:scheme'] === GEO_SCHEME)
    );

    if (hasGeoQuery) {
      console.log('ℹ️  geo query already present in AndroidManifest.xml');
      return mod;
    }

    queries.intent.push({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      data: [{ $: { 'android:scheme': GEO_SCHEME } }],
    });

    console.log('✅ geo scheme <queries> added to AndroidManifest.xml');
    return mod;
  });

module.exports = withAndroidMapQueries;
