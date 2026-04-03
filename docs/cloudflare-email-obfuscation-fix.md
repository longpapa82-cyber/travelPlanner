# Cloudflare Email Obfuscation 이슈 해결

## 문제 상황
- **날짜**: 2026-04-03
- **증상**: FAQ 페이지에서 이메일 주소가 `[email protected]`으로 표시됨
- **원인**: Cloudflare의 Email Address Obfuscation 기능이 자동으로 이메일을 난독화

## 근본 원인
Cloudflare는 스팸 봇으로부터 이메일 주소를 보호하기 위해 자동으로 이메일을 난독화합니다:
- 원본: `longpapa82@gmail.com`
- 난독화: `<a href="/cdn-cgi/l/email-protection" class="__cf_email__">[email protected]</a>`

## 해결 방법
JavaScript를 사용하여 클라이언트 사이드에서 이메일을 동적으로 렌더링:

```javascript
document.addEventListener('DOMContentLoaded', function() {
  var emailElement = document.getElementById('support-email');
  if (emailElement) {
    var email = 'longpapa82' + '@' + 'gmail.com';
    var link = document.createElement('a');
    link.href = 'mailto:' + email;
    link.textContent = email;  // XSS 방지를 위해 textContent 사용
    emailElement.appendChild(link);
  }
});
```

## 보안 고려사항
- `innerHTML` 대신 `createElement`와 `textContent` 사용 (XSS 방지)
- 이메일을 분할하여 저장 (봇 수집 방지)

## 배포 절차
1. 파일 수정: `/frontend/public/faq.html`
2. 서버 배포: `rsync -avz -e "ssh -i ~/.ssh/travelplanner-oci" frontend/public/faq.html root@46.62.201.127:/static-content/`
3. Docker 복사: `docker cp /static-content/faq.html travelplanner-proxy-1:/static-content/faq.html`
4. Nginx 리로드: `docker exec travelplanner-proxy-1 nginx -s reload`
5. Cloudflare 캐시 퍼지 (필요시)

## 검증 방법
- 직접 서버 확인: `curl -k -H "Host: mytravel-planner.com" "https://46.62.201.127/faq.html"`
- 브라우저 확인: 개발자 도구에서 이메일이 JavaScript로 렌더링되는지 확인

## 대체 방안
1. Cloudflare Dashboard에서 Email Obfuscation 비활성화
2. 이메일을 이미지로 표시
3. 이메일을 `longpapa82 [at] gmail.com` 형식으로 표시

## 커밋 정보
- Commit: 7ea11790
- Message: "fix: Use JavaScript to render email to bypass Cloudflare obfuscation"