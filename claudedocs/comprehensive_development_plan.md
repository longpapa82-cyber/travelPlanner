# TravelPlanner 종합 개발 계획서

## 📋 실행 요약 (Executive Summary)

### 프로젝트 개요
AI 기반 자동 여행 계획 수립 플랫폼으로, 전 세계 여행자들이 목적지만 선택하면 최근 3개월간의 여행 데이터를 분석하여 최적화된 일정을 자동 생성하는 모바일 우선 웹 서비스

### 핵심 차별화 요소
- **AI 기반 자동 일정 생성**: OpenAI GPT-4 활용으로 실시간 개인화 여행 계획
- **실시간 편의 정보**: 여행지 날씨, 시차, 현지 정보 통합 제공
- **진행 상황 추적**: 여행 중 실시간 일정 관리 및 수정 기능
- **모바일 최적화**: 76% 여행자가 선호하는 모바일 우선 UX/UI

### 시장 기회
- 여행 앱 시장: 2024년 $650.7B → 2034년 $3.55T 예상 (CAGR 18.5%)
- AI 여행 플랫폼 선도 주자 (Layla.ai 1천만+ 여정 생성)
- 모바일 여행 예약 선호도: 2019년 43% → 2025년 76%

---

## 🌍 경쟁사 및 유사 서비스 분석

### 글로벌 주요 플랫폼

#### 1. **Layla.ai / Trip Planner AI**
- **강점**:
  - 10주 만에 MVP 출시
  - 1천만+ 여정 생성 (2024년 기준)
  - 항공, 숙박, 액티비티, 레스토랑 통합
- **약점**:
  - 실시간 진행 상황 추적 부족
  - 여행 후 기록 관리 미흡
- **차별화 전략**: 여행 중/후 관리 기능 강화, 한국 시장 특화 (카카오 연동)

#### 2. **Mindtrip**
- **강점**:
  - 챗봇 기반 대화형 인터페이스
  - 실시간 지도 통합
  - 자동 업데이트 일정
- **약점**:
  - 복잡한 UI (초보자 진입 장벽)
  - 과거 여행 기록 조회 제한적
- **차별화 전략**: 심플한 UX (10대~100세), 여행 히스토리 관리

#### 3. **Wonderplan**
- **강점**:
  - 완전 무료
  - 초보자 친화적
  - AI 기반 개인화
- **약점**:
  - 수익 모델 불명확
  - 고급 기능 부족
- **차별화 전략**: 광고 기반 수익 모델, 프리미엄 기능 추가

#### 4. **TripIt**
- **강점**:
  - 2천만 사용자
  - 이메일 자동 스캔 (plans@tripit.com)
  - 자동 일정 생성
- **약점**:
  - AI 여행 추천 부족
  - 프리미엄 기능 유료 (자동 이메일 import)
- **차별화 전략**: 모든 핵심 기능 무료 제공, AI 추천 강화

#### 5. **Wanderlog**
- **강점**:
  - 구글 맵 통합
  - 이메일 전달로 예약 추가
  - 협업 기능
- **약점**:
  - AI 자동 생성 제한적
  - 실시간 정보 업데이트 부족
- **차별화 전략**: 완전 자동화된 AI 일정 생성, 실시간 날씨/시차 정보

### 시장 포지셔닝 매트릭스

```
자동화 수준 (높음)
     ↑
     │  [TravelPlanner 목표]
     │     • 완전 AI 자동화
     │     • 실시간 정보
     │     • 여행 중/후 관리
     │
     │  [Layla.ai]        [Mindtrip]
     │     • AI 추천           • 챗봇 UI
     │     • 통합 예약         • 실시간 지도
     │
     │  [Wonderplan]      [TripIt]
     │     • 무료            • 이메일 스캔
     │     • 간단            • 대규모 사용자
     │
     │  [Wanderlog]
     │     • 구글 맵 통합
     │     • 협업 기능
     │
     └──────────────────────────────→ 사용 편의성 (높음)
```

---

## 🛠️ 기술 스택 (Technology Stack)

### Frontend (Mobile-First)

#### **React Native** - 크로스 플랫폼 프레임워크
**선택 이유:**
- iOS/Android 동시 개발 → 개발 시간 50% 단축
- 여행 앱 업계 표준 (최고 ROI)
- 대규모 오픈소스 생태계
- Hot Reload로 빠른 개발/테스트

**주요 라이브러리:**
```javascript
{
  "react-native": "^0.73.0",
  "expo": "~50.0.0",               // 개발 생산성 향상
  "react-navigation": "^6.x",      // 네비게이션
  "@react-native-google-signin/google-signin": "^11.0.0",
  "react-native-maps": "^1.10.0",  // 지도 통합
  "react-native-vector-icons": "^10.0.0"
}
```

#### **UI 프레임워크**
- **React Native Paper**: Material Design
- **React Native Elements**: 다양한 UI 컴포넌트
- **Lottie**: 애니메이션 (로딩, 성공/실패 피드백)

#### **상태 관리**
- **Redux Toolkit** 또는 **Zustand**: 전역 상태 관리
- **React Query (TanStack Query)**: 서버 상태 관리, 캐싱

### Backend

#### **Node.js + NestJS** - 주 백엔드 프레임워크
**선택 이유:**
- TypeScript 기반 타입 안전성
- 모듈형 아키텍처 (확장성)
- 여행 플랫폼 업계 표준
- 풍부한 라이브러리 생태계

**아키텍처 패턴:**
```
src/
├── auth/                # 인증/인가 모듈
│   ├── strategies/      # OAuth, JWT 전략
│   ├── guards/          # 라우트 보호
│   └── decorators/      # 커스텀 데코레이터
├── users/               # 사용자 관리
├── trips/               # 여행 계획 CRUD
├── ai-planner/          # AI 일정 생성 (OpenAI)
├── weather/             # 날씨/시차 API 통합
├── payments/            # 결제 (향후 확장)
└── common/              # 공통 유틸리티
```

**대안 고려:**
- **Python FastAPI**: AI/ML 통합 우수하나, Node.js가 프론트엔드와 더 일관성
- **Golang**: 성능 우수하나, 개발 속도와 생태계에서 Node.js 우위

### Database

#### **PostgreSQL** - 주 데이터베이스
**선택 이유:**
- ACID 트랜잭션 보장
- JSON 타입 지원 (유연한 여행 데이터)
- 지리 데이터 지원 (PostGIS 확장)
- 대규모 데이터 처리 성능

**스키마 설계:**
```sql
-- 사용자 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),  -- nullable (SNS 로그인)
  provider VARCHAR(50),         -- 'email', 'google', 'apple', 'kakao'
  provider_id VARCHAR(255),
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 여행 계획 테이블
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  destination_country VARCHAR(100),
  destination_region VARCHAR(100),
  start_date DATE,
  end_date DATE,
  status VARCHAR(20),           -- 'planning', 'ongoing', 'completed'
  auto_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 일정 아이템 테이블
CREATE TABLE itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  day_number INT,
  time_slot TIME,
  title VARCHAR(255),
  description TEXT,
  location_name VARCHAR(255),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  category VARCHAR(50),         -- 'sightseeing', 'restaurant', 'hotel', etc.
  completed BOOLEAN DEFAULT false,
  is_editable BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 날씨/시차 캐시 테이블
CREATE TABLE weather_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_key VARCHAR(100),    -- "country-region-date"
  date DATE,
  weather_data JSONB,           -- 날씨, 시차, 기타 정보
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

#### **Redis** - 캐싱 및 세션 관리
- JWT 토큰 블랙리스트
- API 응답 캐싱 (날씨, OpenAI 응답)
- 세션 스토어

#### **MongoDB (선택적)** - 로그 및 분석 데이터
- 사용자 행동 로그
- AI 생성 일정 버전 관리
- A/B 테스트 데이터

### AI & APIs

#### **OpenAI GPT-4** - 자동 일정 생성
**API 구성:**
```javascript
// AI 일정 생성 프롬프트 예시
const prompt = `
당신은 전문 여행 플래너입니다. 다음 정보를 기반으로 상세한 여행 일정을 JSON 형식으로 생성하세요:

- 목적지: ${destination}
- 여행 기간: ${startDate} ~ ${endDate} (${days}일)
- 최근 3개월간 ${destination} 여행 트렌드 반영

요구사항:
1. 매일 아침(09:00), 점심(12:00), 오후(15:00), 저녁(18:00) 4개 주요 일정
2. 각 일정에는 장소명, 설명, 추천 이유, 예상 소요 시간, 좌표 포함
3. 현지 교통편 및 이동 시간 고려
4. 현지 맛집 및 인기 관광지 우선

응답 형식: JSON
`;

const response = await openai.chat.completions.create({
  model: "gpt-4-turbo-preview",
  messages: [{ role: "system", content: prompt }],
  response_format: { type: "json_object" },
  temperature: 0.7
});
```

**비용 최적화:**
- 유사 요청 캐싱 (Redis, 24시간)
- 토큰 수 최적화 (간결한 프롬프트)
- 배치 처리 (비 실시간 생성)

#### **날씨 & 시간대 API**

**WeatherAPI.com (권장)** - 올인원 솔루션
```javascript
// 통합 API 호출 예시
GET https://api.weatherapi.com/v1/forecast.json?
  key=YOUR_API_KEY
  &q=${lat},${lng}
  &days=7
  &aqi=no
  &alerts=no

// 응답에 포함:
{
  "location": {
    "name": "Seoul",
    "localtime": "2025-01-27 15:30",
    "tz_id": "Asia/Seoul"
  },
  "forecast": {
    "forecastday": [
      {
        "date": "2025-01-27",
        "day": {
          "maxtemp_c": 5,
          "mintemp_c": -2,
          "condition": { "text": "Sunny" }
        }
      }
    ]
  }
}
```

**대안:**
- **OpenWeather**: 무료 티어 제한적이나 더 상세한 데이터
- **Tomorrow.io**: 고정밀 예보, 유료 티어 필요

#### **Google Maps Platform**
- **Maps SDK**: 지도 표시 (React Native Maps 통합)
- **Places API**: 장소 검색 및 상세 정보
- **Geocoding API**: 주소 ↔ 좌표 변환
- **Directions API**: 경로 및 이동 시간 계산

**비용 최적화:**
- 월 $200 무료 크레딧 활용
- 불필요한 필드 제외 (field masks)
- 캐싱 적극 활용

### Authentication & Authorization

#### **OAuth 2.0 Providers**

**1. Google Sign-In**
```javascript
// React Native Google Sign-In
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID',
  offlineAccess: true,
});

const signIn = async () => {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  // Send to backend for JWT
};
```

**2. Apple Sign-In** (iOS 필수)
```javascript
// React Native Apple Authentication
import appleAuth from '@invertase/react-native-apple-authentication';

const signIn = async () => {
  const appleAuthRequestResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });
  // Send to backend
};
```

**3. Kakao Login** (한국 시장 핵심)
```javascript
// React Native Kakao Login
import KakaoLogin from '@react-native-seoul/kakao-login';

const signIn = async () => {
  const token = await KakaoLogin.login();
  // Send to backend
};
```

#### **Backend 인증 흐름**
```typescript
// NestJS JWT Strategy
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email };
  }
}

// OAuth 통합 서비스
@Injectable()
export class AuthService {
  async validateOAuthUser(provider: string, profile: any) {
    let user = await this.usersService.findByProviderAndId(
      provider,
      profile.id
    );

    if (!user) {
      user = await this.usersService.create({
        email: profile.email,
        name: profile.name,
        provider,
        providerId: profile.id,
      });
    }

    return this.generateJWT(user);
  }
}
```

#### **보안 토큰 저장**
- **iOS**: Keychain Services (react-native-keychain)
- **Android**: Android Keystore (react-native-keychain)
- **절대 사용 금지**: AsyncStorage (암호화 없음)

```javascript
// 안전한 토큰 저장
import * as Keychain from 'react-native-keychain';

// 저장
await Keychain.setGenericPassword('token', accessToken);

// 로드
const credentials = await Keychain.getGenericPassword();
if (credentials) {
  const token = credentials.password;
}
```

### Cloud Infrastructure

#### **AWS (Amazon Web Services)** - 권장
**선택 이유:**
- 여행 플랫폼 업계 표준
- 글로벌 CDN (CloudFront)
- 확장성 및 안정성
- 다양한 관리형 서비스

**아키텍처:**
```
[사용자] → [CloudFront CDN] → [Route 53 DNS]
                                      ↓
                              [Application Load Balancer]
                                      ↓
                    ┌─────────────────┴─────────────────┐
                    ↓                                   ↓
            [ECS Fargate - API]              [ECS Fargate - API]
            (Auto Scaling)                   (Auto Scaling)
                    ↓                                   ↓
                    └─────────────────┬─────────────────┘
                                      ↓
                    ┌─────────────────┴─────────────────┐
                    ↓                 ↓                 ↓
            [RDS PostgreSQL]    [ElastiCache]    [S3 Bucket]
            (Multi-AZ)          (Redis)          (Static Assets)
```

**주요 서비스:**
- **ECS Fargate**: 컨테이너 오케스트레이션 (서버리스)
- **RDS PostgreSQL**: 관리형 데이터베이스
- **ElastiCache Redis**: 관리형 캐싱
- **S3**: 정적 파일 저장 (프로필 이미지 등)
- **CloudWatch**: 로깅 및 모니터링
- **Secrets Manager**: 환경 변수 관리
- **Cognito (선택적)**: 추가 인증 계층

**대안:**
- **Google Cloud Platform**: Google Maps 통합 시 비용 최적화 가능
- **Azure**: 엔터프라이즈 지원 우수

#### **CI/CD Pipeline**
```yaml
# GitHub Actions 예시
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/build-push-action@v4
        with:
          push: true
          tags: ${{ secrets.ECR_REGISTRY }}/travel-planner:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster travel-planner-prod \
            --service api \
            --force-new-deployment
```

### Development Tools

#### **필수 도구**
- **Git**: 버전 관리
- **Docker**: 컨테이너화 (로컬 개발 환경 통일)
- **Postman**: API 테스트
- **Figma**: UI/UX 디자인
- **Sentry**: 에러 트래킹
- **Mixpanel / Amplitude**: 사용자 분석

#### **코드 품질**
```json
{
  "devDependencies": {
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "husky": "^8.0.0",          // Git hooks
    "lint-staged": "^15.0.0",
    "jest": "^29.0.0",
    "@testing-library/react-native": "^12.0.0"
  }
}
```

---

## 📐 시스템 아키텍처

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   iOS App    │  │  Android App │  │   Web App    │      │
│  │ (React Native) │ (React Native) │ (React/Next.js) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│                  (AWS ALB + CloudFront)                      │
│              SSL/TLS, Rate Limiting, CORS                    │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services                          │
│                    (Node.js + NestJS)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │  Trips   │  │ AI Plan  │  │ Weather  │   │
│  │  Service │  │  Service │  │  Service │  │  Service │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
        └─────────────┼─────────────┴─────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Redis     │  │   MongoDB    │      │
│  │  (Primary)   │  │   (Cache)    │  │   (Logs)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  OpenAI API  │  │ WeatherAPI   │  │  Google Maps │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Google OAuth │  │ Apple OAuth  │  │ Kakao OAuth  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Diagrams

#### 1. 여행 계획 자동 생성 플로우
```
[사용자 입력]
   ↓
목적지, 일자 입력
   ↓
[API Gateway]
   ↓
[AI Planner Service]
   ├─→ [OpenAI API] - 일정 생성 (GPT-4)
   │       ↓
   │   일정 초안 JSON
   │       ↓
   ├─→ [Weather Service] - 날씨/시차 데이터 수집
   │       ↓
   │   날씨 정보 JSON
   │       ↓
   ├─→ [Google Maps API] - 장소 상세 정보 & 좌표
   │       ↓
   │   장소 정보 JSON
   │       ↓
   └─→ [Trips Service] - 데이터 결합 & 저장
           ↓
       [PostgreSQL] 저장
           ↓
       [Redis] 캐싱
           ↓
   [사용자에게 응답]
```

#### 2. 인증 플로우 (SNS 로그인)
```
[사용자 - SNS 로그인 버튼 클릭]
   ↓
[React Native] - OAuth Provider SDK 호출
   ↓
[Google/Apple/Kakao] - 인증 화면 표시
   ↓
사용자 승인
   ↓
[OAuth Provider] - Authorization Code 발급
   ↓
[React Native] - Code를 Backend로 전송
   ↓
[Auth Service]
   ├─→ [OAuth Provider API] - Access Token 교환
   │       ↓
   │   프로필 정보 획득
   │       ↓
   ├─→ [User Service] - DB에서 사용자 조회/생성
   │       ↓
   │   [PostgreSQL] - 사용자 저장
   │       ↓
   └─→ JWT 토큰 생성
           ↓
   [React Native] - Keychain에 안전하게 저장
           ↓
   [자동 로그인 완료]
```

#### 3. 여행 진행 현황 추적 플로우
```
[앱 열림 - 위치 권한 확인]
   ↓
[현재 위치 획득]
   ↓
[Trips Service] - 활성 여행 조회
   ↓
[PostgreSQL] - 진행 중인 여행 & 일정 로드
   ↓
[Weather Service] - 현지 실시간 날씨/시간 조회
   ↓
[진행 상황 계산 로직]
   ├─ 현지 시간 기준 (시차 반영)
   ├─ 완료된 일정 표시
   ├─ 진행 중인 일정 강조
   └─ 다음 일정 알림
       ↓
[UI 업데이트]
   ├─ 진행률 프로그레스 바
   ├─ 완료된 항목 체크 표시
   └─ 수정 가능 여부 표시 (진행 안 된 일정만)
```

### Microservices Architecture (선택적 - 확장 시)

```
┌────────────────────────────────────────────────────────┐
│                   API Gateway                          │
│             (Kong / AWS API Gateway)                   │
└─────────┬──────────────┬──────────────┬──────────────┘
          ↓              ↓              ↓
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │   Auth   │   │  Trips   │   │ AI Plan  │
   │  Service │   │  Service │   │  Service │
   │  (NestJS)│   │  (NestJS)│   │ (Python) │
   └────┬─────┘   └────┬─────┘   └────┬─────┘
        │              │              │
        ↓              ↓              ↓
   ┌──────────────────────────────────────┐
   │       Message Queue (RabbitMQ)       │
   └──────────────────────────────────────┘
```

**마이크로서비스 전환 고려 시점:**
- 사용자 10만+ 도달
- 특정 서비스 병목 발생 (AI 생성 등)
- 팀 규모 10명+ 확장

---

## 🎨 UI/UX 디자인 가이드라인

### 디자인 철학

#### 1. **모바일 우선 (Mobile-First)**
```
모바일 (320px~480px)  →  우선 설계
태블릿 (768px~1024px) →  적응형 레이아웃
데스크톱 (1024px+)    →  확장된 경험
```

#### 2. **연령 무관 접근성**
- **큰 터치 영역**: 최소 44x44px (Apple HIG)
- **명확한 대비**: WCAG AA 기준 (4.5:1)
- **심플한 네비게이션**: 최대 3단계 깊이
- **아이콘 + 텍스트**: 시각적 보조와 명확성

#### 3. **밝은 톤 컬러 팔레트**
```css
:root {
  /* Primary - 여행의 설렘과 활력 */
  --primary: #FF6B6B;       /* Coral Red - CTA, 강조 */
  --primary-light: #FFE0E0;
  --primary-dark: #D63939;

  /* Secondary - 신뢰와 안정감 */
  --secondary: #4ECDC4;     /* Turquoise - 정보, 날씨 */
  --secondary-light: #D4F4F2;
  --secondary-dark: #2BA39E;

  /* Neutral - 가독성과 편안함 */
  --neutral-bg: #F7F9FC;    /* Off-White 배경 */
  --neutral-text: #2D3748;  /* Dark Gray 본문 */
  --neutral-gray: #A0AEC0;  /* 보조 텍스트 */

  /* Status Colors */
  --success: #48BB78;       /* 완료된 일정 */
  --warning: #F6AD55;       /* 진행 중 */
  --error: #FC8181;         /* 오류, 취소 */
}
```

### 핵심 화면 설계

#### 1. **온보딩 (첫 실행)**
```
[화면 1]
  ┌─────────────────────────┐
  │                         │
  │    🌍 로고 애니메이션      │
  │                         │
  │  "여행의 모든 것을         │
  │   한 곳에서"              │
  │                         │
  │   [시작하기 →]           │
  └─────────────────────────┘

[화면 2 - SNS 로그인]
  ┌─────────────────────────┐
  │  "어떻게 시작하실래요?"    │
  │                         │
  │  ┌───────────────────┐  │
  │  │  🍎 Apple로 계속   │  │
  │  └───────────────────┘  │
  │  ┌───────────────────┐  │
  │  │  🔵 Google로 계속  │  │
  │  └───────────────────┘  │
  │  ┌───────────────────┐  │
  │  │  💬 Kakao로 계속   │  │
  │  └───────────────────┘  │
  │                         │
  │  또는 이메일로 가입       │
  └─────────────────────────┘
```

#### 2. **홈 화면 (메인 대시보드)**
```
┌────────────────────────────────┐
│ ☰  TravelPlanner     🔔  👤   │  ← 상단 네비게이션
├────────────────────────────────┤
│                                │
│  📍 다음 여행은 어디로?         │
│  ┌──────────────────────────┐ │
│  │  🔍 국가 또는 도시 검색... │ │
│  └──────────────────────────┘ │
│                                │
│  🗓️ 진행 중인 여행              │
│  ┌──────────────────────────┐ │
│  │  🇯🇵 도쿄, 일본            │ │
│  │  2025.02.01 - 02.05 (5일) │ │
│  │                            │ │
│  │  [진행률: ████░░░ 60%]     │ │
│  │                            │ │
│  │  📅 오늘 일정 3개           │ │
│  │  ☀️ 5°C, 맑음             │ │
│  │  🕐 현지 시간: 15:30       │ │
│  │                            │ │
│  │  [자세히 보기 →]           │ │
│  └──────────────────────────┘ │
│                                │
│  📚 과거 여행                   │
│  ┌─────┐ ┌─────┐ ┌─────┐     │
│  │ 🇫🇷 │ │ 🇮🇹 │ │ 🇪🇸 │     │
│  │파리 │ │로마 │ │바르셀│     │
│  └─────┘ └─────┘ └─────┘     │
│                                │
│  [+ 새 여행 계획하기]          │
│                                │
├────────────────────────────────┤
│  🏠  🔍  ➕  📚  👤           │  ← 하단 탭 바
└────────────────────────────────┘
```

#### 3. **AI 여행 계획 생성 화면**
```
[단계 1: 목적지 입력]
┌────────────────────────────────┐
│  ← 뒤로         여행 계획       │
├────────────────────────────────┤
│                                │
│  🌍 어디로 떠나시나요?          │
│                                │
│  ┌──────────────────────────┐ │
│  │  🔍 국가, 도시 또는 지역   │ │
│  └──────────────────────────┘ │
│                                │
│  🔥 인기 목적지                 │
│  ┌─────┐ ┌─────┐ ┌─────┐     │
│  │ 🇯🇵 │ │ 🇹🇭 │ │ 🇫🇷 │     │
│  │일본 │ │태국 │ │프랑스│     │
│  └─────┘ └─────┘ └─────┘     │
│                                │
│  [다음 →]                      │
└────────────────────────────────┘

[단계 2: 일자 선택]
┌────────────────────────────────┐
│  ← 뒤로         여행 일자       │
├────────────────────────────────┤
│                                │
│  🗓️ 언제 떠나시나요?            │
│                                │
│  출발일                         │
│  ┌──────────────────────────┐ │
│  │  📅  2025년 2월 1일       │ │
│  └──────────────────────────┘ │
│                                │
│  귀국일                         │
│  ┌──────────────────────────┐ │
│  │  📅  2025년 2월 5일       │ │
│  └──────────────────────────┘ │
│                                │
│  총 5일간의 여행입니다          │
│                                │
│  [AI 여행 계획 생성하기 🤖]    │
└────────────────────────────────┘

[단계 3: AI 생성 중]
┌────────────────────────────────┐
│         AI 여행 계획 생성 중     │
├────────────────────────────────┤
│                                │
│      🤖 로딩 애니메이션         │
│                                │
│  ✓ 도쿄의 인기 관광지 분석 중... │
│  ✓ 최적의 일정 구성 중...       │
│  🔄 날씨 정보 수집 중...         │
│  ⏳ 맛집 추천 준비 중...         │
│                                │
│  최근 3개월간 여행 데이터를      │
│  분석하여 맞춤 일정을 만들고     │
│  있어요!                        │
│                                │
│  [진행률: ███████░ 87%]        │
└────────────────────────────────┘
```

#### 4. **일정 상세 화면 (타임라인)**
```
┌────────────────────────────────┐
│  ← 뒤로    도쿄 여행 🇯🇵        │
├────────────────────────────────┤
│  📅 2025.02.01 - 02.05 (5일)   │
│  ☀️ 5°C, 맑음  🕐 15:30 (현지) │
│                                │
│  ┌──────────────────────────┐ │
│  │  Day 1  ●  Day 2  ○  ... │ │  ← 탭 네비게이션
│  └──────────────────────────┘ │
│                                │
│  ⏰ 09:00 - 11:00              │
│  ┌──────────────────────────┐ │
│  │  ✓ 츠키지 시장 방문        │ │  ← 완료됨 (회색)
│  │  🍣 신선한 초밥 아침 식사   │ │
│  │  📍 Tsukiji Fish Market   │ │
│  │                            │ │
│  │  [수정 불가]               │ │  ← 이미 완료
│  └──────────────────────────┘ │
│                                │
│  ⏰ 11:30 - 13:00              │
│  ┌──────────────────────────┐ │
│  │  ⚡ 아사쿠사 사원 관람      │ │  ← 진행 중 (강조)
│  │  ⛩️ 전통 일본 문화 체험    │ │
│  │  📍 Senso-ji Temple       │ │
│  │  ☀️ 현지 날씨: 맑음, 6°C  │ │
│  │                            │ │
│  │  [✓ 완료] [✏️ 수정]       │ │
│  └──────────────────────────┘ │
│                                │
│  ⏰ 14:00 - 16:00              │
│  ┌──────────────────────────┐ │
│  │  ○ 스카이트리 전망대       │ │  ← 예정 (기본)
│  │  🗼 도쿄 전경 감상          │ │
│  │  📍 Tokyo Skytree         │ │
│  │                            │ │
│  │  [✏️ 수정] [🗑️ 삭제]      │ │
│  └──────────────────────────┘ │
│                                │
│  [+ 일정 추가하기]              │
│                                │
├────────────────────────────────┤
│  🏠  🔍  ➕  📚  👤           │
└────────────────────────────────┘
```

#### 5. **여행 히스토리 (과거 여행)**
```
┌────────────────────────────────┐
│  ← 뒤로         내 여행 기록     │
├────────────────────────────────┤
│                                │
│  📚 총 12번의 여행              │
│                                │
│  ┌──────────────────────────┐ │
│  │  🇯🇵 도쿄, 일본            │ │
│  │  2024.12.15 - 12.20       │ │
│  │                            │ │
│  │  [사진 썸네일] [평점 ⭐⭐⭐] │ │
│  │                            │ │
│  │  [자세히 보기]             │ │
│  └──────────────────────────┘ │
│                                │
│  ┌──────────────────────────┐ │
│  │  🇫🇷 파리, 프랑스          │ │
│  │  2024.09.01 - 09.07       │ │
│  │                            │ │
│  │  [사진 썸네일] [평점 ⭐⭐⭐⭐⭐] │
│  │                            │ │
│  │  [자세히 보기]             │ │
│  └──────────────────────────┘ │
│                                │
│  ┌──────────────────────────┐ │
│  │  🇮🇹 로마, 이탈리아        │ │
│  │  2024.06.10 - 06.15       │ │
│  │                            │ │
│  │  [사진 썸네일] [평점 ⭐⭐⭐⭐] │
│  │                            │ │
│  │  [자세히 보기]  [🗑️ 삭제]  │ │
│  └──────────────────────────┘ │
│                                │
├────────────────────────────────┤
│  🏠  🔍  ➕  📚  👤           │
└────────────────────────────────┘
```

### 접근성 (Accessibility) 체크리스트

- ✅ **색상 대비**: WCAG AA 4.5:1 이상
- ✅ **터치 영역**: 최소 44x44px
- ✅ **스크린 리더 지원**: 모든 UI 요소에 label
- ✅ **키보드 네비게이션**: Tab 키로 이동 가능
- ✅ **폰트 크기**: 본문 최소 16px
- ✅ **동적 타입**: iOS Dynamic Type, Android 크기 조정 지원
- ✅ **애니메이션 감소**: 사용자 설정 존중 (prefers-reduced-motion)

---

## 💰 비즈니스 모델 및 수익화 전략

### 1단계: 광고 기반 모델 (출시 초기)

#### **Google AdSense**
- **위치**: 일정 상세 화면 하단, 여행 히스토리 중간
- **형식**: 네이티브 광고 (여행 관련 상품/서비스)
- **예상 수익**: eCPM $1-5 (지역별 차이)
- **구현 난이도**: 낮음 (SDK 통합)

**코드 예시:**
```javascript
// React Native Google Mobile Ads
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

<BannerAd
  unitId={__DEV__ ? TestIds.BANNER : 'ca-app-pub-XXXXX/YYYYY'}
  size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
  requestOptions={{
    requestNonPersonalizedAdsOnly: true,  // GDPR 준수
    keywords: ['travel', 'hotels', 'flights'],
  }}
/>
```

#### **추가 광고 네트워크**
- **7Search PPC**: 여행 콘텐츠 특화, 낮은 진입 장벽
- **Taboola / Outbrain**: 네이티브 광고, 높은 eCPM
- **Media.net**: Google 대안, 다양한 광고주

### 2단계: 다각화 모델 (성장기)

#### **제휴 마케팅 (Affiliate Marketing)**
```
수익 흐름:
├─ Booking.com / Hotels.com 제휴 (숙박 예약 시 5-8% 수수료)
├─ Expedia / Skyscanner 제휴 (항공권 예약 시 3-5%)
├─ Viator / GetYourGuide (액티비티 예약 시 10-15%)
└─ 여행 보험 제휴 (가입 시 고정 커미션)
```

**구현 예시:**
```javascript
// 일정 아이템에 제휴 링크 통합
const ItineraryItem = ({ item }) => (
  <View>
    <Text>{item.title}</Text>
    {item.category === 'hotel' && (
      <Button
        title="호텔 예약하기"
        onPress={() => {
          // Booking.com 제휴 링크
          Linking.openURL(
            `https://booking.com/search?aid=YOUR_AFFILIATE_ID&dest=${item.location}`
          );
          // 클릭 추적
          analytics.track('affiliate_click', { provider: 'booking', item_id: item.id });
        }}
      />
    )}
  </View>
);
```

#### **프리미엄 구독 (Freemium Model)**
```
무료 기능:
├─ AI 여행 계획 생성 (월 3회 제한)
├─ 기본 날씨 정보
├─ 여행 히스토리 (최근 5개)
└─ 광고 표시

프리미엄 ($4.99/월 또는 $49.99/년):
├─ 무제한 AI 여행 계획 생성
├─ 상세 날씨 예보 (시간별, 14일)
├─ 무제한 여행 히스토리
├─ 광고 제거
├─ 오프라인 지도 다운로드
├─ 여행 경비 추적 기능
├─ 우선 고객 지원
└─ 프리미엄 AI 모델 (더 상세한 추천)
```

**구현 예시 (React Native IAP):**
```javascript
import * as RNIap from 'react-native-iap';

const itemSkus = Platform.select({
  ios: ['com.travelplanner.premium.monthly', 'com.travelplanner.premium.yearly'],
  android: ['premium_monthly', 'premium_yearly'],
});

const subscribeToPremium = async (sku) => {
  try {
    await RNIap.requestSubscription({ sku });
    // 구독 성공 시 백엔드에 알림
    await api.post('/subscriptions/activate', { sku });
  } catch (err) {
    console.error(err);
  }
};
```

### 3단계: 고급 수익 모델 (성숙기)

#### **B2B 기업 여행 솔루션**
- **타겟**: 중소기업 출장 관리
- **가격**: $99/월 (최대 50명) ~ $299/월 (무제한)
- **기능**:
  - 팀 여행 관리 대시보드
  - 출장 비용 추적 및 리포팅
  - 회사 여행 정책 통합
  - API 접근 권한

#### **White-Label 솔루션**
- **타겟**: 여행사, 관광청, 항공사
- **가격**: 프로젝트 기반 ($10,000+)
- **제공**:
  - 브랜드 커스터마이징
  - 전용 서버 인프라
  - 기술 지원 및 유지보수

#### **데이터 기반 인사이트 판매**
- **타겟**: 관광청, 마케팅 회사
- **상품**:
  - 여행 트렌드 리포트 (월간/연간)
  - 목적지별 인기 시즌 분석
  - 여행자 선호도 데이터
- **가격**: $499/리포트 ~ 연간 구독 $5,000

### 수익 예측 (Projection)

```
1년차 (사용자 10,000명):
├─ 광고 수익: $5,000/월 (eCPM $2, 25만 impressions)
├─ 제휴 수익: $2,000/월 (예약 전환율 2%)
└─ 총 수익: $84,000/년

3년차 (사용자 100,000명):
├─ 광고 수익: $30,000/월
├─ 제휴 수익: $20,000/월
├─ 프리미엄 구독: $25,000/월 (5,000명 x $4.99)
├─ B2B 계약: $10,000/월 (10개 기업)
└─ 총 수익: $1,020,000/년

5년차 (사용자 500,000명):
├─ 광고 수익: $100,000/월
├─ 제휴 수익: $80,000/월
├─ 프리미엄 구독: $150,000/월 (30,000명)
├─ B2B 계약: $50,000/월 (50개 기업)
├─ White-Label: $30,000/월 (3개 고객)
└─ 총 수익: $4,920,000/년
```

---

## 📅 개발 로드맵 (Development Roadmap)

### Phase 0: 기획 및 준비 (2주)

**Week 1-2:**
- ✅ 요구사항 정리 및 우선순위 설정
- ✅ UI/UX 와이어프레임 디자인 (Figma)
- ✅ 기술 스택 최종 확정
- ✅ 개발 환경 설정 (GitHub, AWS 계정 등)
- ✅ 도메인 구매 및 브랜딩
- ✅ 프로젝트 관리 도구 설정 (Jira, Linear 등)

**산출물:**
- 상세 PRD (Product Requirements Document)
- Figma 디자인 파일 (전체 화면 플로우)
- 개발 환경 설정 가이드

---

### Phase 1: MVP 개발 (8주)

#### **Week 1-2: 인증 시스템**
**목표**: 사용자 가입/로그인 기능 완성

**Backend:**
- NestJS 프로젝트 초기화 및 구조 설정
- PostgreSQL 데이터베이스 스키마 생성
- JWT 인증 시스템 구현
- Google OAuth 2.0 통합
- Apple Sign-In 통합
- Kakao OAuth 통합
- 사용자 CRUD API 구현
- 테스트 작성 (Jest)

**Frontend:**
- React Native 프로젝트 초기화 (Expo)
- 온보딩 화면 구현
- SNS 로그인 UI 구현
- OAuth SDK 통합 (Google, Apple, Kakao)
- Keychain 토큰 저장 구현
- 로그인/로그아웃 플로우 테스트

**배포:**
- AWS ECS Fargate 초기 설정
- RDS PostgreSQL 인스턴스 생성
- CI/CD 파이프라인 구성 (GitHub Actions)

**산출물:**
- ✅ 회원가입/로그인 기능 (직접 + 3개 SNS)
- ✅ 보안 토큰 저장
- ✅ Backend API 문서 (Swagger)

---

#### **Week 3-4: AI 여행 계획 생성 (핵심)**
**목표**: 자동 일정 생성 기능 완성

**Backend:**
- OpenAI GPT-4 API 통합
- AI Planner Service 구현:
  - 프롬프트 엔지니어링 (목적지별 최적화)
  - JSON 응답 파싱 및 검증
  - 에러 처리 및 재시도 로직
- Google Maps Places API 통합:
  - 장소 검색 및 상세 정보
  - 좌표 획득
- Trips API 구현:
  - 여행 생성 (POST /trips)
  - 여행 목록 조회 (GET /trips)
  - 일정 아이템 CRUD
- Redis 캐싱 구현 (중복 요청 방지)

**Frontend:**
- 여행 계획 생성 플로우 UI:
  - 목적지 입력 화면
  - 일자 선택 화면 (달력 컴포넌트)
  - AI 생성 중 로딩 화면 (애니메이션)
- 일정 결과 화면:
  - 타임라인 UI
  - Day 탭 네비게이션
  - 일정 아이템 카드 컴포넌트

**테스트:**
- 다양한 목적지 테스트 (10개 주요 도시)
- AI 응답 품질 검증
- 성능 테스트 (응답 시간 < 10초)

**산출물:**
- ✅ AI 기반 자동 일정 생성 (GPT-4)
- ✅ 목적지별 맞춤형 일정
- ✅ 장소 정보 및 좌표 통합

---

#### **Week 5-6: 날씨 및 시차 정보**
**목표**: 실시간 편의 정보 통합

**Backend:**
- WeatherAPI.com 통합
- Weather Service 구현:
  - 날씨 예보 조회 (7일)
  - 시간대 정보 조회
  - 캐싱 전략 (6시간 갱신)
- Trips API 확장:
  - 날씨 정보 포함된 일정 응답
  - 현지 시간 계산 로직

**Frontend:**
- 일정 화면에 날씨 정보 표시:
  - 아이콘 및 온도
  - 간단한 설명 ("맑음", "비")
- 현지 시간 표시 (시차 자동 계산)
- 날씨 상세 모달 (선택적)

**산출물:**
- ✅ 일정별 날씨 정보
- ✅ 시차 자동 계산 및 표시
- ✅ 실시간 데이터 갱신

---

#### **Week 7-8: 여행 진행 상황 추적**
**목표**: 여행 중 관리 기능 완성

**Backend:**
- Itinerary Items 상태 관리:
  - 완료 처리 (PATCH /items/:id/complete)
  - 수정 가능 여부 계산 로직
  - 진행률 계산 API (GET /trips/:id/progress)
- 알림 시스템 (선택적):
  - 다음 일정 Push 알림

**Frontend:**
- 진행 상황 UI:
  - 프로그레스 바 (전체 진행률)
  - 완료된 일정 시각적 구분 (회색, 체크마크)
  - 진행 중 일정 강조 (현재 시간 기준)
- 일정 수정 기능:
  - 제목/설명 수정
  - 시간 변경
  - 삭제 (진행 안 된 일정만)
- 일정 추가 기능:
  - 커스텀 일정 추가 폼
  - 장소 검색 (Google Places Autocomplete)

**산출물:**
- ✅ 여행 진행 현황 추적
- ✅ 일정 수정/추가/삭제
- ✅ 완료된 일정 변경 불가 로직

---

#### **Week 9-10: 여행 히스토리 및 최종 테스트**
**목표**: 과거 여행 관리 및 MVP 완성

**Backend:**
- Trips 상태 관리:
  - 여행 상태 (planning, ongoing, completed)
  - 자동 상태 전환 (크론잡)
- 여행 히스토리 API:
  - 완료된 여행 목록 (GET /trips/completed)
  - 여행 삭제 (DELETE /trips/:id)
  - 여행 상세 조회 (읽기 전용)

**Frontend:**
- 홈 화면 완성:
  - 진행 중 여행 카드
  - 과거 여행 썸네일 그리드
  - 새 여행 계획 버튼
- 여행 히스토리 화면:
  - 완료된 여행 목록
  - 조회 전용 일정 보기
  - 삭제 기능
- 하단 탭 네비게이션 구현

**종합 테스트:**
- E2E 테스트 (회원가입 → 여행 생성 → 완료)
- 성능 테스트 (동시 사용자 100명)
- 보안 테스트 (SQL Injection, XSS 등)
- 모바일 디바이스 테스트 (iOS 3종, Android 3종)

**산출물:**
- ✅ 여행 히스토리 관리
- ✅ 완전한 MVP 기능
- ✅ 배포 준비 완료

---

### Phase 2: 베타 출시 및 피드백 (4주)

#### **Week 11-12: 베타 테스트**
- TestFlight (iOS) 및 Google Play 내부 테스트 출시
- 초대 기반 베타 사용자 모집 (50-100명)
- 피드백 수집 (설문조사, 인터뷰)
- 주요 버그 수정
- 성능 최적화

#### **Week 13-14: 피드백 반영 및 개선**
- 사용자 피드백 기반 UX 개선
- 추가 기능 구현 (우선순위 높은 것)
- 앱 스토어 메타데이터 작성:
  - 스크린샷 (5개 이상)
  - 앱 설명 (한국어, 영어)
  - 키워드 최적화 (ASO)
- 개인정보 처리방침 및 이용약관 작성

**산출물:**
- ✅ 베타 피드백 반영
- ✅ 앱 스토어 준비 완료

---

### Phase 3: 정식 출시 (2주)

#### **Week 15-16: 퍼블릭 출시**
- App Store 및 Google Play 정식 출시
- 프로덕션 환경 모니터링 설정 (Sentry, CloudWatch)
- 마케팅 시작:
  - 소셜 미디어 (인스타그램, 페이스북)
  - 여행 커뮤니티 (트립어드바이저, 블로그)
  - 프레스 릴리스 (TechCrunch, 국내 IT 매체)
- Google AdSense 통합 및 광고 활성화
- 사용자 행동 분석 설정 (Mixpanel)

**산출물:**
- ✅ 정식 서비스 출시 (App Store, Google Play)
- ✅ 수익화 시작 (광고)
- ✅ 모니터링 및 분석 시스템 가동

---

### Phase 4: 기능 확장 (지속적)

#### **Quarter 1 (3개월):**
- **제휴 마케팅 통합**:
  - Booking.com API 연동
  - Skyscanner API 연동
  - 액티비티 예약 (Viator)
- **프리미엄 기능 개발**:
  - 구독 시스템 (IAP)
  - 오프라인 지도 다운로드
  - 여행 경비 추적

#### **Quarter 2 (4-6개월):**
- **소셜 기능**:
  - 여행 공유 (SNS 연동)
  - 친구 초대 및 그룹 여행
  - 여행 리뷰 및 평점
- **AI 고도화**:
  - 개인화된 추천 (과거 여행 분석)
  - 실시간 일정 최적화 (교통 상황 반영)
  - 다국어 지원 (영어, 일본어, 중국어)

#### **Quarter 3-4 (7-12개월):**
- **B2B 솔루션**:
  - 기업 여행 관리 대시보드
  - API 접근 권한 판매
- **글로벌 확장**:
  - 다국어 완전 지원 (10개 언어)
  - 현지화 (통화, 단위 등)
  - 해외 마케팅

---

## 🚀 SuperClaude 활용 전략

### 개발 프로세스 통합

#### **1. 프로젝트 초기화**
```bash
# SuperClaude로 프로젝트 구조 생성
/sc:design --scope project --focus architecture
→ 백엔드/프론트엔드 디렉토리 구조 자동 생성
→ 보일러플레이트 코드 생성

# Context7 MCP로 최신 문서 참조
--context7 "React Native best practices 2025"
--context7 "NestJS authentication OAuth 2.0"
```

#### **2. 기능 개발**
```bash
# 인증 시스템 구현
/sc:implement "Google OAuth 2.0 integration with NestJS and React Native" \
  --context7 \
  --validate

# AI 플래너 서비스 개발
/sc:implement "OpenAI GPT-4 travel itinerary generator with caching" \
  --think-hard \
  --sequential

# UI 컴포넌트 생성
/sc:implement "Travel timeline UI component with React Native" \
  --magic
```

#### **3. 코드 품질 관리**
```bash
# 정기적 코드 분석
/sc:analyze --focus quality security performance

# 리팩토링
/sc:improve "Optimize AI planner service for better token efficiency" \
  --loop --iterations 3

# 버그 해결
/sc:troubleshoot "OAuth callback not working on iOS" \
  --think-hard \
  --context7
```

#### **4. 테스트 및 배포**
```bash
# 테스트 자동 생성
/sc:test --coverage 80

# 빌드 및 배포
/sc:build --validate

# Git 커밋 및 PR
/sc:git commit "Add AI travel planner with GPT-4 integration"
/sc:git pr "Feature: Complete authentication system with SNS login"
```

#### **5. 문서화**
```bash
# API 문서 생성
/sc:document --scope module --focus api

# 프로젝트 README 업데이트
/sc:document "Update README with installation and usage guide"

# 아키텍처 다이어그램
/sc:document --focus architecture
```

### MCP 서버 활용 매트릭스

| 작업 | 주요 MCP 서버 | SuperClaude 플래그 |
|------|--------------|-------------------|
| OAuth 구현 | Context7, Sequential | `--context7 --seq` |
| AI 일정 생성 | Sequential, Context7 | `--think-hard --c7` |
| UI 컴포넌트 | Magic (21st.dev) | `--magic` |
| 코드 리팩토링 | Morphllm, Serena | `--morph --serena` |
| 버그 수정 | Sequential | `--troubleshoot --seq` |
| E2E 테스트 | Playwright | `--play` |
| 전체 분석 | Sequential, Context7 | `--ultrathink --all-mcp` |

### 세션 관리 워크플로우

```bash
# 매일 작업 시작
/sc:load  # 프로젝트 컨텍스트 로드

# 30분마다 체크포인트
# (자동 또는 수동)

# 주요 마일스톤 완료 시
/sc:save  # 진행 상황 저장

# 작업 종료 시
/sc:reflect  # 작업 내역 분석 및 피드백
/sc:save
```

---

## 🔒 보안 및 규정 준수

### 데이터 보호

#### **개인정보 보호**
- GDPR 준수 (유럽 사용자)
- CCPA 준수 (캘리포니아)
- 개인정보처리방침 (한국 법률)
- 최소 데이터 수집 원칙

#### **데이터 암호화**
```yaml
at_rest:
  database: AES-256 (RDS encryption)
  files: S3 server-side encryption
  backups: Encrypted snapshots

in_transit:
  api: TLS 1.3
  mobile: Certificate pinning
```

#### **보안 모범 사례**
- 정기 보안 감사 (분기별)
- 침투 테스트 (연간)
- 의존성 취약점 스캔 (자동, Dependabot)
- 비밀 키 관리 (AWS Secrets Manager)

### 앱 스토어 규정 준수

#### **Apple App Store**
- ✅ 개인정보 처리방침 링크
- ✅ 데이터 수집 명시 (App Privacy)
- ✅ Sign in with Apple 제공 (필수)
- ✅ 구독 관리 링크
- ✅ 앱 심사 가이드라인 준수

#### **Google Play Store**
- ✅ 개인정보 보호정책 링크
- ✅ 데이터 안전성 섹션 작성
- ✅ 권한 사용 명시 (위치, 카메라 등)
- ✅ 타겟 SDK 최신 버전 (API 34+)

---

## 📊 성능 지표 및 모니터링

### 핵심 지표 (KPIs)

```yaml
user_acquisition:
  dau: Daily Active Users
  mau: Monthly Active Users
  retention_rate: Day 1, Day 7, Day 30

engagement:
  trip_creation_rate: 여행 생성 비율
  itinerary_completion: 일정 완료율
  session_duration: 평균 세션 시간

monetization:
  arpu: Average Revenue Per User
  conversion_rate: 무료 → 프리미엄 전환율
  ltv: Lifetime Value

technical:
  api_response_time: < 500ms (p95)
  error_rate: < 0.1%
  uptime: 99.9%
```

### 모니터링 스택

#### **Application Performance Monitoring**
- **Sentry**: 에러 트래킹 및 성능 모니터링
- **New Relic** 또는 **Datadog**: 인프라 및 APM
- **AWS CloudWatch**: 로그 및 메트릭

#### **사용자 행동 분석**
- **Mixpanel**: 이벤트 추적 및 퍼널 분석
- **Google Analytics 4**: 전체 사용자 흐름
- **Hotjar** (웹): 히트맵 및 세션 녹화

#### **알림 설정**
```yaml
critical_alerts:
  - error_rate > 1% (5분간)
  - api_latency > 2s (p95)
  - database_cpu > 80%
  - openai_api_failure_rate > 10%

warning_alerts:
  - disk_usage > 70%
  - memory_usage > 75%
  - daily_active_users < 50% of MA
```

---

## 🎯 마케팅 전략

### 출시 전 (Pre-Launch)

#### **1. 랜딩 페이지**
- Webflow 또는 Framer로 제작
- 이메일 사전 등록 (MailChimp)
- "여행 계획, 이제 AI에게 맡기세요" 메시지
- 베타 초대 신청 폼

#### **2. 소셜 미디어**
- 인스타그램: @travelplanner_official
- 페이스북 페이지
- 트위터/X: 여행 팁 및 개발 과정 공유
- 틱톡: 짧은 여행 계획 생성 영상

#### **3. 콘텐츠 마케팅**
- 블로그: "AI가 추천하는 도쿄 3일 여행 코스"
- YouTube: 앱 사용 튜토리얼
- Medium: "여행 계획 앱 개발기"

### 출시 후 (Post-Launch)

#### **1. ASO (App Store Optimization)**
```
키워드:
├─ 주요: 여행, 여행 계획, 일정, AI
├─ 롱테일: 자동 여행 계획, 해외여행 일정, 여행지 추천
└─ 영어: travel planner, itinerary, trip planning, AI travel

앱 이름: TravelPlanner - AI 여행 계획
부제목: 목적지만 입력하면 완벽한 일정 완성
```

#### **2. 바이럴 마케팅**
- 레딧 /r/travel, /r/solotravel 커뮤니티
- 여행 카페 (네이버, 다음)
- 인플루언서 협업 (여행 유튜버, 블로거)

#### **3. 프레스 릴리스**
- TechCrunch, Mashable
- 국내: 블로터, 벤처스퀘어, 아웃스탠딩
- 여행 매체: 트래비, 론리플래닛 코리아

#### **4. 추천 프로그램**
```
인센티브:
├─ 친구 초대 시 양쪽 모두 프리미엄 1개월 무료
├─ 5명 초대 시 영구 프리미엄
└─ 리더보드 및 배지 시스템
```

---

## 💡 리스크 관리

### 기술적 리스크

| 리스크 | 확률 | 영향 | 완화 전략 |
|--------|-----|------|----------|
| OpenAI API 장애 | 중간 | 높음 | 대체 AI 모델 준비 (Claude, Gemini), 캐싱 강화 |
| 높은 API 비용 | 높음 | 중간 | 프리미엄 모델 도입, 캐싱, 토큰 최적화 |
| 보안 취약점 | 낮음 | 높음 | 정기 감사, 침투 테스트, 버그 바운티 |
| 확장성 문제 | 중간 | 중간 | 오토스케일링, 로드 테스트, CDN |

### 비즈니스 리스크

| 리스크 | 확률 | 영향 | 완화 전략 |
|--------|-----|------|----------|
| 사용자 획득 실패 | 중간 | 높음 | 다각화된 마케팅, MVP 빠른 출시 |
| 경쟁사 진입 | 높음 | 중간 | 차별화 기능, 사용자 락인 (히스토리) |
| 수익화 실패 | 중간 | 높음 | 다중 수익 모델, A/B 테스트 |
| 앱 스토어 거부 | 낮음 | 높음 | 규정 준수 철저, 베타 테스트 |

### 운영 리스크

| 리스크 | 확률 | 영향 | 완화 전략 |
|--------|-----|------|----------|
| 팀 이탈 | 낮음 | 중간 | 문서화 철저, 코드 리뷰 |
| 예산 초과 | 중간 | 중간 | 비용 모니터링, AWS 예산 알림 |
| 범위 확대 | 높음 | 중간 | MVP 범위 고수, 백로그 관리 |

---

## 📚 참고 자료 및 리소스

### 공식 문서
- **React Native**: https://reactnative.dev/docs
- **NestJS**: https://docs.nestjs.com/
- **OpenAI API**: https://platform.openai.com/docs
- **WeatherAPI.com**: https://www.weatherapi.com/docs/
- **Google Maps Platform**: https://developers.google.com/maps/documentation

### 커뮤니티 및 지원
- **Stack Overflow**: 기술 질문
- **GitHub Discussions**: 오픈소스 프로젝트 논의
- **Discord**: React Native, Node.js 커뮤니티
- **Reddit**: /r/reactnative, /r/node

### 학습 자료
- **Udemy**: "Complete React Native + Hooks Course"
- **Egghead.io**: "Build a Modern API with NestJS"
- **YouTube**: Fireship, Traversy Media (여행 앱 튜토리얼)

### 도구 및 서비스
- **Figma**: UI/UX 디자인
- **Postman**: API 테스트
- **GitHub**: 코드 저장소 및 CI/CD
- **Sentry**: 에러 모니터링
- **Mixpanel**: 사용자 분석

---

## 🎉 결론 및 다음 단계

### 핵심 성공 요인

1. **빠른 MVP 출시**: 8주 내 핵심 기능 완성 및 베타 테스트
2. **AI 품질**: GPT-4 기반 고품질 일정 생성으로 차별화
3. **모바일 최적화**: 76% 여행자가 선호하는 모바일 우선 UX
4. **데이터 기반 개선**: 사용자 피드백 및 분석 데이터로 지속적 최적화
5. **다각화된 수익 모델**: 광고 + 제휴 + 프리미엄으로 안정적 수익

### 즉시 시작할 작업

1. ✅ **Figma 디자인 착수** (Week 1)
   - 온보딩, 로그인, 홈 화면 우선
   - 모바일 320px~480px 기준

2. ✅ **개발 환경 설정** (Week 1)
   - GitHub 저장소 생성
   - AWS 계정 및 초기 인프라
   - OpenAI API 키 발급

3. ✅ **SuperClaude 프로젝트 초기화** (Week 1)
   ```bash
   /sc:load
   /sc:design --scope project --focus architecture
   /sc:implement "Initialize NestJS backend with PostgreSQL and JWT"
   /sc:implement "Initialize React Native frontend with Expo"
   ```

4. ✅ **Phase 1 시작**: 인증 시스템 개발 (Week 2)

### 장기 비전

**1년 후:**
- 10,000+ 활성 사용자
- 5개 국가 지원
- 월 $7,000 수익

**3년 후:**
- 100,000+ 활성 사용자
- 글로벌 Top 10 여행 앱
- 연 $1M+ 수익
- B2B 솔루션 론칭

**5년 후:**
- 500,000+ 활성 사용자
- 전 세계 여행자의 필수 앱
- 연 $5M+ 수익
- 여행 플랫폼 생태계 구축

---

**이 계획서는 실행 가능한 로드맵입니다. SuperClaude와 함께 단계별로 진행하며, 각 Phase마다 검증과 피드백을 통해 지속적으로 개선해 나가세요!**

**문의 및 지원:** 개발 과정에서 막히는 부분이 있다면 언제든 SuperClaude의 `/sc:troubleshoot` 또는 `/sc:help` 명령을 활용하세요.

**🚀 지금 바로 시작하세요! 전 세계 여행자들이 당신의 앱을 기다리고 있습니다!**
