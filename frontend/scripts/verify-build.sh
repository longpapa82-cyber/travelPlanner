#!/bin/bash
# versionCode 78 클린 빌드 검증 스크립트
# 3개 P0 버그 수정이 빌드에 포함되었는지 확인

set -e

echo "🔍 versionCode 78 클린 빌드 검증..."
echo ""

# AAB 파일 경로 확인
if [ -z "$1" ]; then
  echo "❌ 사용법: ./verify-build.sh <aab-file-path>"
  echo "예시: ./verify-build.sh travelplanner-v78-clean.aab"
  exit 1
fi

AAB_FILE="$1"

if [ ! -f "$AAB_FILE" ]; then
  echo "❌ AAB 파일을 찾을 수 없습니다: $AAB_FILE"
  exit 1
fi

echo "✅ AAB 파일 확인됨: $AAB_FILE"
echo ""

# 임시 디렉토리 생성
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "📦 AAB 파일 압축 해제 중..."

# bundletool이 설치되어 있는지 확인
if ! command -v bundletool &> /dev/null; then
  echo "⚠️ bundletool이 설치되지 않았습니다."
  echo "다음 명령어로 설치하세요:"
  echo "brew install bundletool"
  echo ""
  echo "또는 직접 다운로드:"
  echo "https://github.com/google/bundletool/releases"
  exit 1
fi

# AAB를 APK로 변환
bundletool build-apks \
  --bundle="$AAB_FILE" \
  --output="$TEMP_DIR/output.apks" \
  --mode=universal \
  --ks-pass=pass:android \
  --ks-key-alias=androiddebugkey 2>/dev/null || {
    # 서명 없이 시도
    bundletool build-apks \
      --bundle="$AAB_FILE" \
      --output="$TEMP_DIR/output.apks" \
      --mode=universal
  }

# APK 압축 해제
cd "$TEMP_DIR"
unzip -q output.apks
unzip -q universal.apk -d apk-contents

echo "✅ 압축 해제 완료"
echo ""

# React Native 번들 파일 찾기
BUNDLE_FILE="apk-contents/assets/index.android.bundle"

if [ ! -f "$BUNDLE_FILE" ]; then
  echo "❌ React Native 번들 파일을 찾을 수 없습니다."
  ls -la apk-contents/assets/
  exit 1
fi

echo "📋 버그 수정 검증 시작..."
echo ""

# Bug #1: 광고 재생 실패 (performInitialization)
echo "🔍 Bug #1 (광고): performInitialization() 함수 확인..."
if grep -q "performInitialization" "$BUNDLE_FILE"; then
  echo "   ✅ Bug #1 fix: performInitialization() 포함됨"
  BUG1_FIXED=1
else
  echo "   ❌ Bug #1 fix: performInitialization() 누락!"
  BUG1_FIXED=0
fi
echo ""

# Bug #2: 장소 선택 미반영 (isSelecting)
echo "🔍 Bug #2 (장소): isSelecting 플래그 확인..."
if grep -q "isSelecting" "$BUNDLE_FILE"; then
  echo "   ✅ Bug #2 fix: isSelecting 플래그 포함됨"
  BUG2_FIXED=1
else
  echo "   ❌ Bug #2 fix: isSelecting 플래그 누락!"
  BUG2_FIXED=0
fi
echo ""

# Bug #3: 초대 알림 네비게이션 (normalizedType)
echo "🔍 Bug #3 (초대): normalizedType 정규화 확인..."
if grep -q "normalizedType" "$BUNDLE_FILE"; then
  echo "   ✅ Bug #3 fix: normalizedType 정규화 포함됨"
  BUG3_FIXED=1
else
  echo "   ❌ Bug #3 fix: normalizedType 누락!"
  BUG3_FIXED=0
fi
echo ""

# 최종 판정
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $BUG1_FIXED -eq 1 ] && [ $BUG2_FIXED -eq 1 ] && [ $BUG3_FIXED -eq 1 ]; then
  echo "🎉 검증 성공!"
  echo ""
  echo "✅ 모든 버그 수정이 빌드에 포함되었습니다!"
  echo "✅ versionCode 78 클린 빌드를 Alpha 트랙에 배포 가능합니다."
  echo ""
  echo "다음 단계:"
  echo "1. Play Console Alpha 트랙 업로드"
  echo "2. Alpha 테스터에게 알림"
  echo "3. 회귀 테스트 실행 (Bug #1, #2, #3)"
  exit 0
else
  echo "❌ 검증 실패!"
  echo ""
  echo "다음 버그 수정이 누락되었습니다:"
  [ $BUG1_FIXED -eq 0 ] && echo "  - Bug #1: 광고 재생 (performInitialization)"
  [ $BUG2_FIXED -eq 0 ] && echo "  - Bug #2: 장소 선택 (isSelecting)"
  [ $BUG3_FIXED -eq 0 ] && echo "  - Bug #3: 초대 네비게이션 (normalizedType)"
  echo ""
  echo "⚠️ 빌드를 다시 확인하거나 versionCode 79로 재빌드하세요."
  exit 1
fi
