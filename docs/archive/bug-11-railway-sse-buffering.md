# Bug #11: Railway 프록시 SSE 버퍼링 문제

## 발견일: 2026-03-24

## 증상
- versionCode 33에서도 "Trip created but connection interrupted" 메시지 지속 발생
- 여행 생성은 성공하지만 SSE complete 이벤트가 클라이언트에 도달하지 않음
- 모든 이전 수정사항(Bug #8, #9, #10)이 효과 없음

## 근본 원인
**Railway 플랫폼의 커스텀 프록시/라우터가 SSE 스트림을 버퍼링함**

1. **Railway 프록시 특성**:
   - 커스텀 빌드 프록시 (NGINX 아님)
   - 작은 데이터는 버퍼링 후 일괄 전송
   - `X-Accel-Buffering: no` 헤더 무시 가능
   - flush() 메서드가 효과 없을 수 있음

2. **SSE 전송 실패 시나리오**:
   - 백엔드: complete 이벤트 전송 → res.write() → res.end()
   - Railway 프록시: 데이터를 버퍼에 저장, 즉시 전송하지 않음
   - 클라이언트: 스트림 종료 감지하지만 complete 이벤트 미수신
   - 결과: "Trip created but connection interrupted" 에러

## 해결책

### 1. Heartbeat 메시지 추가 (적용됨) ✅
```javascript
// 5초마다 heartbeat 전송으로 프록시 버퍼링 방지
const heartbeatInterval = setInterval(() => {
  res.write(': heartbeat\n\n');
  console.log('[BACKEND SSE] Heartbeat sent');
}, 5000);
```

**효과**:
- 주기적 데이터 전송으로 프록시가 버퍼를 비우도록 강제
- SSE 표준 comment 형식(`:`) 사용으로 클라이언트 무시

### 2. Padding 데이터 추가 (적용됨) ✅
```javascript
// complete 이벤트에 1KB padding 추가
const padding = ' '.repeat(1024);
const paddedEvent = { ...completeEvent, padding };
```

**효과**:
- 데이터 크기 증가로 즉시 전송 유도
- 프론트엔드는 padding 필드 자동 무시

### 3. 장기적 대안 (필요시)
- **WebSocket**: 양방향 실시간 통신, 프록시 버퍼링 없음
- **Long Polling**: 단순하고 안정적, 실시간성 약간 떨어짐
- **Polling Status API**: 가장 안정적, UX 다소 저하

## 배포 내역
- Bug #11 수정: heartbeat + padding 추가
- backend/src/trips/trips.controller.ts 수정
- TypeScript 컴파일: ✅ 성공

## 검증 필요
1. Railway 프로덕션 배포 후 백엔드 로그 확인
   - "[BACKEND SSE] Heartbeat sent" 로그 확인
   - "[BACKEND SSE] Sending complete event with padding" 로그 확인

2. 프론트엔드 테스트
   - heartbeat 메시지 무시 확인
   - complete 이벤트 정상 수신 확인
   - padding 필드 무시 확인

## 교훈
- **플랫폼 특성 파악**: Railway, Cloudflare 등 각 플랫폼의 프록시 동작 이해 필수
- **SSE 한계**: 프록시/CDN 환경에서 SSE는 불안정할 수 있음
- **Heartbeat 필수**: 프로덕션 SSE는 항상 heartbeat 메커니즘 필요
- **Fallback 전략**: SSE 실패 시 대안 메커니즘 준비

## 참고 자료
- Railway SSE 이슈: 약 1MB 전송 시 연결 끊김 보고
- Cloudflare: 100KB 버퍼링 후 일괄 전송
- Azure App Service: Windows 플랜에서 SSE 버퍼링 이슈