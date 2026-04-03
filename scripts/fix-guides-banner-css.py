#!/usr/bin/env python3
"""가이드 페이지 SmartAppBanner CSS 일괄 수정"""

from pathlib import Path
import re

def fix_css(content: str) -> tuple[str, bool]:
    """CSS 패턴 수정"""
    # 이미 수정된 경우
    if 'justify-content: space-between' in content:
        return content, False

    # Pattern 1: .smart-app-banner { ... display: none; }
    # Pattern 2: .smart-app-banner.show { display: block; }
    # Replace with proper flexbox

    # Find and replace .smart-app-banner block
    pattern1 = r'(\.smart-app-banner \{[^}]*?)(display: none;)'
    replacement1 = r'\1padding: 0.875rem 1rem;\n      display: none;'
    content = re.sub(pattern1, replacement1, content, flags=re.DOTALL)

    # Find and replace .smart-app-banner.show
    pattern2 = r'\.smart-app-banner\.show \{ display: block; \}'
    replacement2 = '''.smart-app-banner.show {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }'''
    content = re.sub(pattern2, replacement2, content)

    # Fix .banner-content
    pattern3 = r'(\.banner-content \{[^}]*?)(padding: 0\.875rem 1rem;[^}]*?max-width: 1200px;[^}]*?margin: 0 auto;)'
    replacement3 = r'\1flex: 1;\n      min-width: 0;'
    content = re.sub(pattern3, replacement3, content, flags=re.DOTALL)

    # Simpler approach: just remove specific lines
    content = content.replace('      padding: 0.875rem 1rem;\n', '', 1)  # from .banner-content
    content = content.replace('      max-width: 1200px;\n', '')
    content = content.replace('      margin: 0 auto;\n', '')

    # Add flex properties after gap
    content = re.sub(
        r'(\.banner-content \{[^}]*?gap: 1rem;)',
        r'\1\n      flex: 1;\n      min-width: 0;',
        content,
        flags=re.DOTALL
    )

    # Fix media query
    pattern4 = r'\.banner-content \{ padding: 0\.75rem 0\.875rem; gap: 0\.75rem; \}'
    replacement4 = '''.smart-app-banner { padding: 0.75rem 0.875rem; }
      .banner-content { gap: 0.75rem; }'''
    content = re.sub(pattern4, replacement4, content)

    return content, True


def main():
    guides_dir = Path(__file__).parent.parent / 'frontend' / 'public' / 'guides'

    if not guides_dir.exists():
        print(f"❌ Directory not found: {guides_dir}")
        return

    print("🔧 가이드 페이지 SmartAppBanner CSS 수정 시작...\n")

    success_count = 0
    skip_count = 0

    for file_path in sorted(guides_dir.glob('*.html')):
        try:
            content = file_path.read_text(encoding='utf-8')
            new_content, modified = fix_css(content)

            if not modified:
                print(f"⏭️  {file_path.name}: Already fixed")
                skip_count += 1
                continue

            file_path.write_text(new_content, encoding='utf-8')
            print(f"✅ {file_path.name}: Fixed")
            success_count += 1

        except Exception as e:
            print(f"❌ {file_path.name}: Error - {e}")

    print(f"\n{'='*60}")
    print(f"✅ 수정: {success_count}개")
    print(f"⏭️  건너뜀: {skip_count}개")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()
