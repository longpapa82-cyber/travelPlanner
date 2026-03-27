# 백엔드 배포 가이드 (Hetzner VPS)

## 서버 정보
- **호스트**: 46.62.201.127
- **도메인**: mytravel-planner.com
- **SSH 접속**: `ssh root@46.62.201.127`
- **프로젝트 경로**: `/root/travelPlanner`
- **컨테이너 관리**: Docker Compose

## 배포 절차

### 1. SSH 접속
```bash
ssh root@46.62.201.127
```

### 2. 프로젝트 디렉토리 이동
```bash
cd /root/travelPlanner
```

### 3. Git 업데이트
```bash
# 최신 코드 가져오기
git pull origin main

# 현재 브랜치 확인
git branch

# 최근 커밋 확인
git log --oneline -3
```

### 4. Docker 컨테이너 재시작
```bash
# 백엔드 컨테이너만 재시작
docker-compose restart backend

# 또는 전체 재시작 (필요 시)
docker-compose down
docker-compose up -d
```

### 5. 배포 확인
```bash
# Health check
curl https://mytravel-planner.com/api/health
# 예상 응답: {"status":"ok"}

# 컨테이너 상태 확인
docker ps | grep backend

# 로그 확인 (마지막 50줄)
docker logs travelplanner-backend --tail 50

# 실시간 로그 모니터링 (Ctrl+C로 종료)
docker logs -f travelplanner-backend
```

## 데이터베이스 작업

### DB 접속
```bash
docker exec -it travelplanner-db psql -U postgres -d travelplanner
```

### 유용한 SQL 쿼리
```sql
-- 사용자 AI 카운터 확인
SELECT id, email, aiTripsUsedThisMonth, subscriptionTier, role
FROM users
WHERE email = 'j090723@naver.com';

-- AI 카운터 리셋 (테스트 계정)
UPDATE users
SET aiTripsUsedThisMonth = 0
WHERE email = 'j090723@naver.com';

-- 최근 여행 확인
SELECT id, destination, "startDate", "endDate", "createdAt"
FROM trips
ORDER BY "createdAt" DESC
LIMIT 10;

-- DB 나가기
\q
```

## 트러블슈팅

### 컨테이너가 시작되지 않는 경우
```bash
# 에러 로그 확인
docker logs travelplanner-backend

# 컨테이너 상태 확인
docker ps -a | grep backend

# 강제 재생성
docker-compose down
docker-compose up -d --force-recreate backend
```

### 환경 변수 변경 후
```bash
# .env 파일 확인
cat /root/travelPlanner/backend/.env.production

# 컨테이너 재생성 필수 (restart로는 env 적용 안됨)
docker-compose down
docker-compose up -d
```

### 디스크 공간 확인
```bash
# 디스크 사용량 확인
df -h

# Docker 이미지/컨테이너 정리
docker system prune -a
```

## 현재 배포 대기 중인 수정사항 (2026-03-27)

### Issue #3: AI 생성 실패 시 카운터 소진 버그
**커밋**: `c93da3de`
**상태**: ⏳ 배포 대기

**수정 내용**:
- `backend/src/trips/trips.service.ts` 트랜잭션 범위 확장
- 여행 생성 실패 시 AI 카운터 롤백 보장

**배포 후 확인사항**:
1. 테스트 계정 AI 카운터 복구:
   ```sql
   UPDATE users SET aiTripsUsedThisMonth = 0 WHERE email = 'j090723@naver.com';
   ```
2. AI 생성 실패 테스트 (카운터 차감되지 않아야 함)

### Issue #1: 지도 UX 개선
**커밋**: `eb70fe02`
**상태**: ✅ 프론트엔드만 해당 (백엔드 배포 불필요)

**프론트엔드**:
- `TripMapView.tsx` - Alert 다이얼로그 추가
- 17개 언어 i18n 번역

**다음 배포**: versionCode 38 EAS 빌드 시 포함

---

**작성일**: 2026-03-27
**작성자**: SuperClaude
**최종 업데이트**: Issue #3 배포 전
