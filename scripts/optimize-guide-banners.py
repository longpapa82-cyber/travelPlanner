#!/usr/bin/env python3
"""
Phase 0.5: SmartAppBanner 최적화를 27개 가이드 페이지에 적용
변경사항:
1. wasDismissedToday() -> wasDismissedRecently() (24h -> 4h)
2. setTimeout(showBanner, 2000) -> setTimeout(showBanner, 500)
3. Date string storage -> Timestamp storage
"""

import os
import re
from pathlib import Path
from datetime import datetime

GUIDES_DIR = Path("/Users/hoonjaepark/projects/travelPlanner/frontend/public/guides")
BACKUP_DIR = Path(f"/Users/hoonjaepark/projects/travelPlanner/docs/backup/guides-{datetime.now().strftime('%Y%m%d-%H%M%S')}")

# 변경할 패턴 정의
CHANGES = [
    # 1. 함수명 변경
    (r'function wasDismissedToday\(\)', 'function wasDismissedRecently()'),
    (r'wasDismissedToday\(\)', 'wasDismissedRecently()'),

    # 2. wasDismissedRecently 함수 본문 (Lines 492-496)
    (
        r'function wasDismissedRecently\(\) \{\s*const dismissed = localStorage\.getItem\(CONFIG\.storageKeys\.dismissed\);\s*const today = new Date\(\)\.toDateString\(\);\s*return dismissed === today;',
        '''function wasDismissedRecently() {
    const dismissed = localStorage.getItem(CONFIG.storageKeys.dismissed);
    if (!dismissed) return false;

    const dismissedTime = parseInt(dismissed, 10);
    const now = Date.now();
    const fourHours = 4 * 60 * 60 * 1000;

    return (now - dismissedTime) < fourHours;'''
    ),

    # 3. handleBannerDismiss 함수 본문 (Lines 550-551)
    (
        r'const today = new Date\(\)\.toDateString\(\);\s*localStorage\.setItem\(CONFIG\.storageKeys\.dismissed, today\);',
        '''const now = Date.now();
    localStorage.setItem(CONFIG.storageKeys.dismissed, now.toString());'''
    ),

    # 4. setTimeout 지연 시간
    (r'setTimeout\(showBanner, 2000\);', 'setTimeout(showBanner, 500);'),
]

def optimize_file(file_path: Path) -> bool:
    """단일 파일 최적화"""
    try:
        # 원본 읽기
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 백업
        backup_path = BACKUP_DIR / file_path.name
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)

        # 변경 적용
        modified = content
        for pattern, replacement in CHANGES:
            modified = re.sub(pattern, replacement, modified, flags=re.DOTALL | re.MULTILINE)

        # 검증: 필수 변경사항 확인
        if not all([
            'wasDismissedRecently' in modified,
            'setTimeout(showBanner, 500)' in modified,
            'fourHours = 4 * 60 * 60 * 1000' in modified,
            'now.toString()' in modified
        ]):
            print(f"  ❌ 검증 실패 (필수 변경사항 미포함)")
            return False

        # 저장
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(modified)

        return True

    except Exception as e:
        print(f"  ❌ 오류: {str(e)}")
        return False

def main():
    print("=== Phase 0.5 가이드 페이지 SmartAppBanner 최적화 ===\n")

    # 백업 디렉토리 생성
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    print(f"✅ 백업 디렉토리 생성: {BACKUP_DIR}\n")

    # 가이드 파일 목록
    guide_files = sorted(GUIDES_DIR.glob("*.html"))
    print(f"📁 대상 파일: {len(guide_files)}개\n")

    # 각 파일 처리
    processed = 0
    failed = 0

    for file_path in guide_files:
        print(f"처리 중: {file_path.name} ... ", end='')

        if optimize_file(file_path):
            print("✅")
            processed += 1
        else:
            failed += 1

    # 결과 출력
    print(f"\n=== 완료 ===")
    print(f"✅ 성공: {processed}개")
    print(f"❌ 실패: {failed}개")
    print(f"📦 백업 위치: {BACKUP_DIR}\n")

    if failed == 0:
        print("🎉 모든 파일이 성공적으로 최적화되었습니다!")
        return 0
    else:
        print("⚠️  일부 파일 처리 실패. 백업에서 복구 가능합니다.")
        return 1

if __name__ == "__main__":
    exit(main())
