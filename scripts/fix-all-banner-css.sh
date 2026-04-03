#!/bin/bash
# SmartAppBanner CSS 일괄 수정 스크립트

cd "$(dirname "$0")/../frontend/public/guides"

count=0
for file in *.html; do
  # 이미 수정된 파일 건너뛰기
  if grep -q "justify-content: space-between" "$file"; then
    echo "⏭️  $file: Already fixed"
    continue
  fi

  # CSS 패턴 교체
  sed -i '' '
    /\.smart-app-banner {/,/}/ {
      /display: none;/a\
    }\
    .smart-app-banner.show {\
      display: flex;\
      align-items: center;\
      justify-content: space-between;
      s/display: none;/padding: 0.875rem 1rem;\
      display: none;/
      /\.smart-app-banner\.show { display: block; }/c\
    .smart-app-banner.show {\
      display: flex;\
      align-items: center;\
      justify-content: space-between;\
    }
    }
    /\.banner-content {/,/}/ {
      s/padding: 0\.875rem 1rem;//
      s/max-width: 1200px;//
      s/margin: 0 auto;//
      /gap: 1rem;/a\
      flex: 1;\
      min-width: 0;
    }
    /@media (max-width: 480px) {/,/}/ {
      s/\.banner-content { padding: 0\.75rem 0\.875rem; gap: 0\.75rem; }/.smart-app-banner { padding: 0.75rem 0.875rem; }\
      .banner-content { gap: 0.75rem; }/
    }
  ' "$file" 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "✅ $file: Fixed"
    ((count++))
  else
    echo "❌ $file: Error"
  fi
done

echo ""
echo "================================"
echo "총 $count개 파일 수정 완료"
echo "================================"
