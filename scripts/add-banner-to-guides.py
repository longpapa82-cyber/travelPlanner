#!/usr/bin/env python3
"""
SmartAppBanner를 모든 가이드 페이지에 자동으로 추가하는 스크립트
"""

import os
import re
from pathlib import Path

# 프로젝트 루트 경로
PROJECT_ROOT = Path(__file__).parent.parent
GUIDES_DIR = PROJECT_ROOT / "frontend" / "public" / "guides"

# CSS 스니펫
BANNER_CSS = '''
    /* Smart App Banner */
    .smart-app-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #4A90D9 0%, #5BA3E8 100%);
      color: white;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideDown 0.3s ease-out;
      display: none;
    }
    .smart-app-banner.show { display: block; }
    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    .banner-content {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.875rem 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .banner-icon {
      font-size: 2.5rem;
      flex-shrink: 0;
    }
    .banner-text {
      flex: 1;
      min-width: 0;
    }
    .banner-text h4 {
      font-size: 1.05rem;
      font-weight: 700;
      margin-bottom: 0.125rem;
    }
    .banner-text p {
      font-size: 0.8rem;
      opacity: 0.95;
      margin-bottom: 0.25rem;
    }
    .banner-rating {
      font-size: 0.7rem;
      opacity: 0.9;
    }
    .banner-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-shrink: 0;
    }
    .banner-download {
      background: white;
      color: #4A90D9;
      border: none;
      padding: 0.5rem 1.25rem;
      border-radius: 1.5rem;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .banner-download:hover {
      background: #f0f9ff;
      transform: scale(1.02);
    }
    .banner-close {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .banner-close:hover {
      background: rgba(255,255,255,0.3);
    }
    @media (max-width: 480px) {
      .banner-content { padding: 0.75rem 0.875rem; gap: 0.75rem; }
      .banner-icon { font-size: 2rem; }
      .banner-text h4 { font-size: 0.95rem; }
      .banner-text p { font-size: 0.75rem; }
      .banner-download { padding: 0.4rem 1rem; font-size: 0.85rem; }
    }'''

# HTML 마크업 (한국어)
BANNER_HTML_KO = '''
<!-- Smart App Banner (Android Only) -->
<div id="smartAppBanner" class="smart-app-banner">
  <div class="banner-content">
    <div class="banner-icon">🎯</div>
    <div class="banner-text">
      <h4>myTravel</h4>
      <p id="bannerTagline">AI가 만드는 완벽한 여행</p>
      <div class="banner-rating">⭐⭐⭐⭐⭐ 4.8점 (12K)</div>
    </div>
  </div>
  <div class="banner-actions">
    <button class="banner-download" onclick="handleBannerInstall()">무료 다운로드</button>
    <button class="banner-close" onclick="handleBannerDismiss()">✕</button>
  </div>
</div>

'''

# HTML 마크업 (영어)
BANNER_HTML_EN = '''
<!-- Smart App Banner (Android Only) -->
<div id="smartAppBanner" class="smart-app-banner">
  <div class="banner-content">
    <div class="banner-icon">🎯</div>
    <div class="banner-text">
      <h4>myTravel</h4>
      <p id="bannerTagline">AI Creates Your Perfect Trip</p>
      <div class="banner-rating">⭐⭐⭐⭐⭐ 4.8 (12K Reviews)</div>
    </div>
  </div>
  <div class="banner-actions">
    <button class="banner-download" onclick="handleBannerInstall()">Download Free</button>
    <button class="banner-close" onclick="handleBannerDismiss()">✕</button>
  </div>
</div>

'''

# JavaScript 로직 (한국어)
BANNER_JS_KO = '''
  // ============================================================
  // Smart App Banner Logic (Android Only)
  // ============================================================

  const CONFIG = {
    playStoreURL: 'https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner',
    storageKeys: {
      dismissed: 'smartBanner_dismissed',
      variant: 'smartBanner_variant'
    }
  };

  const BANNER_VARIANTS = {
    A: '여행 계획, 더 쉽고 빠르게',
    B: 'AI가 만드는 완벽한 여행',
    C: '5초 만에 여행 일정 완성'
  };

  function isMobile() {
    return /Android/i.test(navigator.userAgent);
  }

  function wasDismissedToday() {
    const dismissed = localStorage.getItem(CONFIG.storageKeys.dismissed);
    const today = new Date().toDateString();
    return dismissed === today;
  }

  function getVariant() {
    let variant = localStorage.getItem(CONFIG.storageKeys.variant);
    if (!variant || !BANNER_VARIANTS[variant]) {
      const variants = Object.keys(BANNER_VARIANTS);
      variant = variants[Math.floor(Math.random() * variants.length)];
      localStorage.setItem(CONFIG.storageKeys.variant, variant);
    }
    return variant;
  }

  function trackEvent(eventName, params = {}) {
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, params);
    }
  }

  function showBanner() {
    const banner = document.getElementById('smartAppBanner');
    if (!banner) return;

    const variant = getVariant();
    const taglineEl = document.getElementById('bannerTagline');
    if (taglineEl) {
      taglineEl.textContent = BANNER_VARIANTS[variant];
    }

    banner.classList.add('show');
    trackEvent('banner_view', {
      variant: variant,
      page: window.location.pathname
    });
  }

  window.handleBannerInstall = function() {
    const variant = getVariant();
    const deepLink = encodeURIComponent(window.location.pathname + window.location.search);
    const url = CONFIG.playStoreURL + '&referrer=' + deepLink;

    trackEvent('banner_click', {
      variant: variant,
      page: window.location.pathname,
      deepLink: deepLink
    });

    window.open(url, '_blank');
  };

  window.handleBannerDismiss = function() {
    const banner = document.getElementById('smartAppBanner');
    if (!banner) return;

    const variant = getVariant();
    const today = new Date().toDateString();
    localStorage.setItem(CONFIG.storageKeys.dismissed, today);

    banner.classList.remove('show');
    trackEvent('banner_dismiss', {
      variant: variant,
      page: window.location.pathname
    });
  };

  if (isMobile() && !wasDismissedToday()) {
    setTimeout(showBanner, 2000);
  }
'''

# JavaScript 로직 (영어)
BANNER_JS_EN = '''
  // ============================================================
  // Smart App Banner Logic (Android Only)
  // ============================================================

  const CONFIG = {
    playStoreURL: 'https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner',
    storageKeys: {
      dismissed: 'smartBanner_dismissed',
      variant: 'smartBanner_variant'
    }
  };

  const BANNER_VARIANTS = {
    A: 'AI Creates Your Perfect Trip',
    B: 'Travel Planning Made Easy',
    C: 'Plan Your Trip in 5 Seconds'
  };

  function isMobile() {
    return /Android/i.test(navigator.userAgent);
  }

  function wasDismissedToday() {
    const dismissed = localStorage.getItem(CONFIG.storageKeys.dismissed);
    const today = new Date().toDateString();
    return dismissed === today;
  }

  function getVariant() {
    let variant = localStorage.getItem(CONFIG.storageKeys.variant);
    if (!variant || !BANNER_VARIANTS[variant]) {
      const variants = Object.keys(BANNER_VARIANTS);
      variant = variants[Math.floor(Math.random() * variants.length)];
      localStorage.setItem(CONFIG.storageKeys.variant, variant);
    }
    return variant;
  }

  function trackEvent(eventName, params = {}) {
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, params);
    }
  }

  function showBanner() {
    const banner = document.getElementById('smartAppBanner');
    if (!banner) return;

    const variant = getVariant();
    const taglineEl = document.getElementById('bannerTagline');
    if (taglineEl) {
      taglineEl.textContent = BANNER_VARIANTS[variant];
    }

    banner.classList.add('show');
    trackEvent('banner_view', {
      variant: variant,
      page: window.location.pathname
    });
  }

  window.handleBannerInstall = function() {
    const variant = getVariant();
    const deepLink = encodeURIComponent(window.location.pathname + window.location.search);
    const url = CONFIG.playStoreURL + '&referrer=' + deepLink;

    trackEvent('banner_click', {
      variant: variant,
      page: window.location.pathname,
      deepLink: deepLink
    });

    window.open(url, '_blank');
  };

  window.handleBannerDismiss = function() {
    const banner = document.getElementById('smartAppBanner');
    if (!banner) return;

    const variant = getVariant();
    const today = new Date().toDateString();
    localStorage.setItem(CONFIG.storageKeys.dismissed, today);

    banner.classList.remove('show');
    trackEvent('banner_dismiss', {
      variant: variant,
      page: window.location.pathname
    });
  };

  if (isMobile() && !wasDismissedToday()) {
    setTimeout(showBanner, 2000);
  }
'''


def process_html_file(file_path):
    """HTML 파일에 SmartAppBanner 추가"""

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 이미 배너가 추가된 경우 건너뛰기
    if 'smart-app-banner' in content or 'smartAppBanner' in content:
        return False, "Already has banner"

    # 언어 감지 (파일명에 -en이 있으면 영어)
    is_english = '-en' in file_path.name

    # 1. CSS 추가 (</style> 태그 바로 앞)
    content = re.sub(
        r'(\s*)(</style>)',
        r'\1' + BANNER_CSS + r'\n\1\2',
        content,
        count=1
    )

    # 2. HTML 마크업 추가 (<body> 태그 바로 다음)
    banner_html = BANNER_HTML_EN if is_english else BANNER_HTML_KO
    content = re.sub(
        r'(<body>)',
        r'\1' + banner_html,
        content,
        count=1
    )

    # 3. JavaScript 추가 (</body> 태그 바로 앞)
    banner_js = BANNER_JS_EN if is_english else BANNER_JS_KO
    content = re.sub(
        r'(\s*)(</body>)',
        r'\1<script>' + banner_js + r'\n</script>\n\n\2',
        content,
        count=1
    )

    # 파일 저장
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    return True, "Success"


def main():
    """메인 함수"""

    if not GUIDES_DIR.exists():
        print(f"❌ Guides directory not found: {GUIDES_DIR}")
        return

    # 모든 HTML 파일 찾기
    html_files = sorted(GUIDES_DIR.glob("*.html"))

    if not html_files:
        print("❌ No HTML files found in guides directory")
        return

    print(f"Found {len(html_files)} guide pages\n")

    success_count = 0
    skip_count = 0
    error_count = 0

    for html_file in html_files:
        try:
            success, message = process_html_file(html_file)

            if success:
                print(f"✅ {html_file.name}")
                success_count += 1
            else:
                print(f"⏭️  {html_file.name} - {message}")
                skip_count += 1

        except Exception as e:
            print(f"❌ {html_file.name} - Error: {str(e)}")
            error_count += 1

    # 요약
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  ✅ Success: {success_count}")
    print(f"  ⏭️  Skipped: {skip_count}")
    print(f"  ❌ Errors: {error_count}")
    print(f"  📊 Total: {len(html_files)}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
