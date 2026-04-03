#!/usr/bin/env python3
"""SmartAppBanner CSS 레이아웃 수정 스크립트

Issue: .banner-actions가 .banner-content 아래로 배치됨
Fix: .smart-app-banner에 flexbox 적용하여 좌우 배치
"""

import re
from pathlib import Path

# CSS 수정 패턴
OLD_CSS = r'''    \.smart-app-banner \{
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient\(135deg, #4A90D9 0%, #5BA3E8 100%\);
      color: white;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba\(0,0,0,0\.15\);
      animation: slideDown 0\.3s ease-out;
      display: none;
    \}'''

NEW_CSS = '''    .smart-app-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #4A90D9 0%, #5BA3E8 100%);
      color: white;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideDown 0.3s ease-out;
      padding: 0.875rem 1rem;
      display: none;
    }
    .smart-app-banner.show {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }'''

OLD_BANNER_CONTENT = r'''    \.banner-content \{
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0\.875rem 1rem;
      max-width: 1200px;
      margin: 0 auto;
    \}'''

NEW_BANNER_CONTENT = '''    .banner-content {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
      min-width: 0;
    }'''

# 모바일 CSS도 수정
OLD_MOBILE_CSS = r'''    @media \(max-width: 480px\) \{
      \.banner-content \{ padding: 0\.75rem 0\.875rem; gap: 0\.75rem; \}'''

NEW_MOBILE_CSS = '''    @media (max-width: 480px) {
      .smart-app-banner { padding: 0.75rem 0.875rem; }
      .banner-content { gap: 0.75rem; }'''


def fix_banner_css(file_path: Path) -> tuple[bool, str]:
    """HTML 파일의 SmartAppBanner CSS 수정"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 이미 수정된 경우 건너뛰기
        if 'justify-content: space-between;' in content:
            return False, "Already fixed"

        # CSS 패턴 교체
        content = re.sub(OLD_CSS, NEW_CSS, content)
        content = re.sub(OLD_BANNER_CONTENT, NEW_BANNER_CONTENT, content)
        content = re.sub(OLD_MOBILE_CSS, NEW_MOBILE_CSS, content)

        # 파일 저장
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return True, "Fixed"

    except Exception as e:
        return False, f"Error: {str(e)}"


def main():
    """메인 실행 함수"""
    base_dir = Path(__file__).parent.parent / 'frontend' / 'public'

    # 수정할 파일 목록
    files = [
        base_dir / 'landing.html',
        base_dir / 'landing-en.html',
    ]

    # 가이드 페이지 추가
    guides_dir = base_dir / 'guides'
    if guides_dir.exists():
        files.extend(guides_dir.glob('*.html'))

    print("🔧 SmartAppBanner CSS 레이아웃 수정 시작...\n")

    success_count = 0
    skip_count = 0
    error_count = 0

    for file_path in files:
        if not file_path.exists():
            continue

        success, message = fix_banner_css(file_path)

        if success:
            print(f"✅ {file_path.name}: {message}")
            success_count += 1
        elif message == "Already fixed":
            print(f"⏭️  {file_path.name}: {message}")
            skip_count += 1
        else:
            print(f"❌ {file_path.name}: {message}")
            error_count += 1

    print(f"\n{'='*60}")
    print(f"✅ 성공: {success_count}개")
    print(f"⏭️  건너뜀: {skip_count}개")
    print(f"❌ 오류: {error_count}개")
    print(f"{'='*60}\n")

    if success_count > 0:
        print("🎯 다음 단계:")
        print("1. 로컬에서 landing.html 열어서 배너 레이아웃 확인")
        print("2. 배포: rsync -avz frontend/public/*.html root@46.62.201.127:/static-content/")
        print("3. 배포: rsync -avz frontend/public/guides/*.html root@46.62.201.127:/static-content/guides/")


if __name__ == '__main__':
    main()
