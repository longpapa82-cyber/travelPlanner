#!/bin/bash
# Phase 0.5: SmartAppBanner 최적화를 가이드 페이지에 적용
# 변경사항:
# 1. wasDismissedToday() -> wasDismissedRecently() (24h -> 4h)
# 2. setTimeout(showBanner, 2000) -> setTimeout(showBanner, 500)

set -e

GUIDES_DIR="/Users/hoonjaepark/projects/travelPlanner/frontend/public/guides"
BACKUP_DIR="/Users/hoonjaepark/projects/travelPlanner/docs/backup/guides-$(date +%Y%m%d-%H%M%S)"

echo "=== Phase 0.5 가이드 페이지 SmartAppBanner 최적화 ==="
echo ""

# 백업 디렉토리 생성
mkdir -p "$BACKUP_DIR"
echo "✅ 백업 디렉토리 생성: $BACKUP_DIR"

# 가이드 파일 목록
GUIDE_FILES=$(find "$GUIDES_DIR" -name "*.html" -type f)
FILE_COUNT=$(echo "$GUIDE_FILES" | wc -l | tr -d ' ')

echo "📁 대상 파일: $FILE_COUNT 개"
echo ""

# 각 파일 처리
PROCESSED=0
FAILED=0

for file in $GUIDE_FILES; do
  filename=$(basename "$file")
  echo -n "처리 중: $filename ... "

  # 백업
  cp "$file" "$BACKUP_DIR/$filename"

  # 임시 파일
  temp_file="${file}.tmp"

  # 1. wasDismissedToday → wasDismissedRecently
  # 2. Date string 비교 → Timestamp 비교
  sed -e 's/function wasDismissedToday()/function wasDismissedRecently()/g' \
      -e 's/wasDismissedToday()/wasDismissedRecently()/g' \
      -e 's/const today = new Date()\.toDateString();/const dismissedTime = parseInt(dismissed, 10);\n    const now = Date.now();\n    const fourHours = 4 * 60 * 60 * 1000;/g' \
      -e 's/return dismissed === today;/return (now - dismissedTime) < fourHours;/g' \
      "$file" > "$temp_file"

  # 3. Dismiss handler 수정 (Date string → Timestamp)
  sed -i '' \
      -e 's/const today = new Date()\.toDateString();$/const now = Date.now();/g' \
      -e 's/localStorage\.setItem(storageKeys\.dismissed, today);/localStorage.setItem(storageKeys.dismissed, now.toString());/g' \
      "$temp_file"

  # 4. setTimeout 지연 시간 수정 (2000 → 500)
  sed -i '' 's/setTimeout(showBanner, 2000);/setTimeout(showBanner, 500);/g' "$temp_file"

  # 검증: 변경 사항 확인
  if grep -q "wasDismissedRecently" "$temp_file" && \
     grep -q "setTimeout(showBanner, 500)" "$temp_file" && \
     grep -q "fourHours = 4 \* 60 \* 60 \* 1000" "$temp_file"; then
    mv "$temp_file" "$file"
    echo "✅"
    PROCESSED=$((PROCESSED + 1))
  else
    rm "$temp_file"
    echo "❌ (검증 실패)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "=== 완료 ==="
echo "✅ 성공: $PROCESSED 개"
echo "❌ 실패: $FAILED 개"
echo "📦 백업 위치: $BACKUP_DIR"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 모든 파일이 성공적으로 최적화되었습니다!"
  exit 0
else
  echo "⚠️  일부 파일 처리 실패. 백업에서 복구 가능합니다."
  exit 1
fi
