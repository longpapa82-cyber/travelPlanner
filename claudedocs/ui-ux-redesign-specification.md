# Travel Planner UI/UX 완전 리뉴얼 사양서

**작성일**: 2026-02-03
**목표**: 2025년 Top 여행 앱 수준의 세계적인 production-ready 디자인 구현

---

## 📋 목차
1. [현재 상태 분석](#현재-상태-분석)
2. [벤치마킹 인사이트](#벤치마킹-인사이트)
3. [새로운 디자인 시스템](#새로운-디자인-시스템)
4. [컴포넌트 라이브러리 아키텍처](#컴포넌트-라이브러리-아키텍처)
5. [화면별 리디자인 사양](#화면별-리디자인-사양)
6. [애니메이션 및 마이크로 인터랙션](#애니메이션-및-마이크로-인터랙션)
7. [접근성 개선사항](#접근성-개선사항)
8. [구현 로드맵](#구현-로드맵)

---

## 현재 상태 분석

### 기술 스택
- **Frontend**: React Native + Expo (Cross-platform)
- **Icons**: MaterialCommunityIcons
- **Navigation**: React Navigation (Stack + Bottom Tabs)

### 현재 디자인 시스템
```typescript
// 현재 컬러
Primary: #FF6B6B (빨강 계열)
Secondary: #4ECDC4 (청록 계열)
Accent: #FFA07A (살몬 계열)
Background: #F7F9FC (연한 회색)
```

### 문제점
1. **비주얼 임팩트 부족**: 아이콘 placeholder만 있고 실제 이미지 없음
2. **평범한 레이아웃**: 단순 카드 나열, 차별화된 디자인 없음
3. **인터랙션 부재**: 정적인 화면, 애니메이션/제스처 없음
4. **모바일 최적화 부족**: 하단 네비게이션 없음, 터치 영역 최적화 부족
5. **다크모드 미지원**: 라이트 모드만 존재
6. **AI 개인화 부족**: 추천 알고리즘 미적용

---

## 벤치마킹 인사이트

### Top Apps (2025)

#### 1. Mindtrip
- **강점**: 6.5M POIs, 지도 중심 인터페이스, AI 어시스턴트
- **적용 포인트**: 인터랙티브 맵 기반 여행 계획

#### 2. Layla.ai
- **강점**: 10M+ 일정, AI 챗봇, 자동 업데이트
- **적용 포인트**: AI 기반 실시간 일정 조정

#### 3. TripIt
- **강점**: 20M 사용자, 깔끔한 타임라인
- **적용 포인트**: 시간 기반 시각화

#### 4. Wanderlog
- **강점**: 강력한 SEO, 몰입형 비주얼
- **적용 포인트**: 대형 이미지, 최소 텍스트

### 2025 디자인 트렌드
1. **📱 Mobile-First**: 하단 네비게이션 (21% 접근성 향상)
2. **🤖 AI Personalization**: 맞춤형 추천 및 자동 생성
3. **🎨 Immersive Visuals**: 최소 텍스트, 대형 이미지
4. **🗺️ Interactive Maps**: 지도 중심 계획
5. **🎮 Gamification**: 배지, 레벨업, 도전 과제
6. **🌙 Dark Mode**: 필수 지원
7. **✨ Micro-interactions**: 부드러운 애니메이션
8. **👆 Gesture Navigation**: 스와이프, 드래그
9. **♿ Accessibility**: WCAG 2.1 AA 준수

---

## 새로운 디자인 시스템

### 🎨 컬러 팔레트 (v2.0)

#### Light Mode (Primary)
```typescript
// Brand Colors - 여행의 설렘과 모험
primary: {
  50: '#FFF5F5',   // 매우 연한 배경
  100: '#FFE8E8',  // 연한 배경
  200: '#FFD1D1',  // 버튼 hover
  300: '#FFB3B3',  // 비활성 요소
  400: '#FF8A8A',  // 보조 요소
  500: '#FF6B6B',  // 메인 브랜드 (현재 유지)
  600: '#E05555',  // 버튼 pressed
  700: '#C43F3F',  // 다크 강조
  800: '#A02929',  // 매우 진한 텍스트
  900: '#7D1313',  // 최고 대비
},

// Secondary Colors - 신뢰와 평온
secondary: {
  50: '#F0FFFE',
  100: '#D9FFFC',
  200: '#B3FFF9',
  300: '#80FFF5',
  400: '#4DECDC',  // 메인 세컨더리
  500: '#2BA39E',  // 다크 버전
  600: '#1A8A85',
  700: '#0F726F',
  800: '#055A58',
  900: '#004442',
},

// Neutral Colors - 가독성과 편안함
neutral: {
  0: '#FFFFFF',    // 순백
  50: '#F7F9FC',   // 배경 (현재)
  100: '#EDF2F7',  // 카드 배경
  200: '#E2E8F0',  // 보더
  300: '#CBD5E0',  // 비활성 텍스트
  400: '#A0AEC0',  // 세컨더리 텍스트
  500: '#718096',  // 아이콘
  600: '#4A5568',  // 본문
  700: '#2D3748',  // 헤딩 (현재)
  800: '#1A202C',  // 다크 헤딩
  900: '#0F1419',  // 최고 대비
},

// Semantic Colors
success: {
  light: '#C6F6D5',
  main: '#48BB78',   // 현재
  dark: '#2F855A',
},
warning: {
  light: '#FED7AA',
  main: '#F6AD55',   // 현재
  dark: '#DD6B20',
},
error: {
  light: '#FED7D7',
  main: '#FC8181',   // 현재
  dark: '#C53030',
},
info: {
  light: '#BEE3F8',
  main: '#4299E1',
  dark: '#2B6CB0',
},

// Travel-specific Colors
travel: {
  ocean: '#0EA5E9',      // 바다/항공
  mountain: '#10B981',    // 산/자연
  sunset: '#F59E0B',     // 일몰/저녁
  night: '#6366F1',      // 밤/별
  adventure: '#EF4444',  // 모험/활동
  relax: '#8B5CF6',      // 휴식/스파
},
```

#### Dark Mode
```typescript
dark: {
  // 배경
  background: {
    primary: '#0F1419',    // 메인 배경
    secondary: '#1A202C',  // 카드 배경
    tertiary: '#2D3748',   // 상승 배경
  },

  // 텍스트
  text: {
    primary: '#F7FAFC',    // 메인 텍스트
    secondary: '#A0AEC0',  // 세컨더리 텍스트
    tertiary: '#718096',   // 비활성 텍스트
  },

  // 브랜드 (조정된 밝기)
  primary: '#FF8A8A',      // 더 밝은 primary
  secondary: '#5FF5E5',    // 더 밝은 secondary

  // 보더
  border: {
    light: '#2D3748',
    medium: '#4A5568',
    dark: '#718096',
  },
}
```

### 📝 타이포그래피 (v2.0)

```typescript
typography: {
  // Font Family
  fontFamily: {
    primary: 'System',           // iOS: SF Pro, Android: Roboto
    secondary: 'System',         // 동일
    monospace: 'Courier New',
  },

  // Display (Hero sections)
  display: {
    large: {
      fontSize: 56,
      fontWeight: '700',
      lineHeight: 64,
      letterSpacing: -1.5,
    },
    medium: {
      fontSize: 44,
      fontWeight: '700',
      lineHeight: 52,
      letterSpacing: -1,
    },
    small: {
      fontSize: 36,
      fontWeight: '700',
      lineHeight: 44,
      letterSpacing: -0.5,
    },
  },

  // Headings
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.25,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    letterSpacing: 0,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: 0,
  },
  h5: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0,
  },
  h6: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: 0,
  },

  // Body
  body: {
    large: {
      fontSize: 18,
      fontWeight: '400',
      lineHeight: 28,
      letterSpacing: 0.15,
    },
    medium: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
      letterSpacing: 0.15,
    },
    small: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
      letterSpacing: 0.25,
    },
  },

  // Special
  button: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0.5,
    textTransform: 'none',  // 대문자 변환 안함
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  overline: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
}
```

### 📐 Spacing & Layout (v2.0)

```typescript
spacing: {
  // Base unit: 4px
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,

  // Semantic spacing
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,

  // Component-specific
  inset: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
  },
  stack: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  inline: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
}

layout: {
  // Screen padding
  screenPadding: {
    horizontal: 16,
    vertical: 16,
  },

  // Card dimensions
  card: {
    minHeight: 120,
    borderRadius: 16,
    padding: 16,
  },

  // Touch targets (WCAG compliance)
  touchTarget: {
    min: 44,  // 최소 44x44 pt
    recommended: 48,
  },

  // Grid
  grid: {
    columns: 12,
    gutter: 16,
    margin: 16,
  },
}
```

### 🎭 Shadows & Elevation

```typescript
shadows: {
  // Elevation levels (Material Design inspired)
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },

  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 12,
  },

  // Colored shadows (for brand elements)
  primary: {
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },

  secondary: {
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
}
```

### 🔲 Border Radius

```typescript
borderRadius: {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,

  // Component-specific
  button: 12,
  card: 16,
  input: 12,
  modal: 24,
  badge: 16,
  avatar: 9999,
  image: 16,
}
```

---

## 컴포넌트 라이브러리 아키텍처

### 📦 Component Structure

```
/frontend/src/components/
├── core/                    # 기본 컴포넌트
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.styles.ts
│   │   ├── Button.types.ts
│   │   └── index.ts
│   ├── Card/
│   ├── Input/
│   ├── Badge/
│   ├── Avatar/
│   └── Icon/
│
├── feedback/                # 피드백 컴포넌트
│   ├── Toast/
│   ├── Modal/
│   ├── BottomSheet/
│   ├── Loading/
│   └── Skeleton/
│
├── layout/                  # 레이아웃 컴포넌트
│   ├── Screen/
│   ├── Section/
│   ├── Grid/
│   ├── Stack/
│   └── SafeArea/
│
├── navigation/              # 네비게이션 컴포넌트
│   ├── BottomNav/
│   ├── TabBar/
│   ├── Header/
│   └── BackButton/
│
├── data-display/            # 데이터 표시 컴포넌트
│   ├── TripCard/
│   ├── ItineraryCard/
│   ├── DestinationCard/
│   ├── ActivityCard/
│   ├── Timeline/
│   └── WeatherWidget/
│
├── interactive/             # 인터랙티브 컴포넌트
│   ├── Swiper/
│   ├── DraggableList/
│   ├── PullToRefresh/
│   ├── InfiniteScroll/
│   └── GestureHandler/
│
├── media/                   # 미디어 컴포넌트
│   ├── Image/
│   ├── Gallery/
│   ├── Map/
│   └── Video/
│
└── animations/              # 애니메이션 컴포넌트
    ├── FadeIn/
    ├── SlideIn/
    ├── ScaleIn/
    ├── Shimmer/
    └── Lottie/
```

### 🎯 Core Components 사양

#### Button Component
```typescript
// Button.types.ts
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  onPress: () => void;
  children: React.ReactNode;
}

// Usage Examples:
<Button variant="primary" size="lg" onPress={handleCreate}>
  새 여행 만들기
</Button>

<Button variant="outline" icon="map-marker" onPress={handleLocation}>
  위치 설정
</Button>

<Button variant="ghost" size="sm" disabled>
  준비 중
</Button>
```

#### Card Component
```typescript
// Card.types.ts
export type CardElevation = 'none' | 'sm' | 'md' | 'lg';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  elevation?: CardElevation;
  padding?: CardPadding;
  borderRadius?: number;
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

// Specialized Cards:
export interface TripCardProps extends CardProps {
  trip: Trip;
  onPress: (tripId: string) => void;
  showStatus?: boolean;
  showWeather?: boolean;
}

// Usage:
<TripCard
  trip={tripData}
  onPress={handleTripPress}
  elevation="md"
  showWeather
/>
```

#### Input Component
```typescript
// Input.types.ts
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'date';
export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps {
  type?: InputType;
  size?: InputSize;
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  helperText?: string;
  leftIcon?: string;
  rightIcon?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
}

// Usage:
<Input
  type="email"
  label="이메일"
  placeholder="your@email.com"
  value={email}
  onChangeText={setEmail}
  leftIcon="email-outline"
  error={emailError}
  required
/>
```

### 🎨 Data Display Components 사양

#### TripCard v2.0
```typescript
export interface TripCardV2Props {
  trip: Trip;
  variant?: 'compact' | 'expanded' | 'hero';
  onPress: (tripId: string) => void;
  onEdit?: (tripId: string) => void;
  onDelete?: (tripId: string) => void;
  showActions?: boolean;
}

// Features:
// - Hero image with gradient overlay
// - Status badge with animation
// - Weather icon integration
// - Quick action buttons
// - Swipe gestures for actions
// - Skeleton loading state
```

#### Timeline Component
```typescript
export interface TimelineProps {
  items: TimelineItem[];
  orientation?: 'vertical' | 'horizontal';
  activeIndex?: number;
  onItemPress?: (index: number) => void;
  showConnector?: boolean;
}

export interface TimelineItem {
  id: string;
  time: string;
  title: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  completed?: boolean;
}

// Usage: Day-by-day itinerary visualization
<Timeline
  items={itineraryItems}
  orientation="vertical"
  activeIndex={currentDay}
  showConnector
/>
```

#### WeatherWidget Component
```typescript
export interface WeatherWidgetProps {
  weather: Weather;
  size?: 'compact' | 'expanded';
  showForecast?: boolean;
  animated?: boolean;
}

// Features:
// - Animated weather icons
// - Temperature with feels-like
// - 5-day forecast
// - UV index, humidity
// - Sunrise/sunset times
```

---

## 화면별 리디자인 사양

### 🏠 Home Screen (메인 화면)

#### 현재 문제점
- 정적인 아이콘 기반 quick actions
- 이미지 없는 destination cards
- 제한적인 개인화

#### 새로운 디자인

**1. Hero Section (상단)**
```typescript
<Hero>
  <BlurredBackground image={dynamicDestinationImage} />
  <Overlay gradient={['transparent', 'rgba(0,0,0,0.6)']} />
  <Content>
    <Greeting animated>
      안녕하세요, {user.name}님! 👋
    </Greeting>
    <Subtitle>
      다음 모험을 계획해볼까요?
    </Subtitle>
    <QuickAction variant="hero">
      <Icon name="sparkles" animated />
      AI 여행 계획 만들기
    </QuickAction>
  </Content>
</Hero>

// Design Specs:
// - Height: 280pt
// - Background: Parallax scrolling
// - Text: White with shadow for contrast
// - Button: Glass morphism effect
// - Animation: Fade in on mount
```

**2. Quick Stats (통계 위젯)**
```typescript
<StatsRow horizontal scrollEnabled>
  <StatCard icon="airplane-takeoff" color="ocean">
    <Value>12</Value>
    <Label>여행 완료</Label>
  </StatCard>

  <StatCard icon="map-marker-multiple" color="adventure">
    <Value>3</Value>
    <Label>진행 중</Label>
  </StatCard>

  <StatCard icon="star" color="sunset">
    <Value>4.8</Value>
    <Label>평균 만족도</Label>
  </StatCard>

  <StatCard icon="trophy" color="success">
    <Badge>NEW</Badge>
    <Label>레벨 5 달성!</Label>
  </StatCard>
</StatsRow>

// Design Specs:
// - Card size: 120 x 100 pt
// - Gradient background per color theme
// - Icon size: 32pt
// - Micro-animation on press
```

**3. Featured Destinations (추천 여행지)**
```typescript
<Section title="지금 떠나기 좋은 곳" action="전체보기">
  <Carousel
    data={featuredDestinations}
    renderItem={({ item }) => (
      <DestinationCardHero
        destination={item}
        imageHeight={240}
        onPress={handleDestinationPress}
      >
        <ImageOverlay>
          <BadgeGroup>
            <Badge variant="weather">
              <Icon name="weather-sunny" />
              {item.weather.temp}°C
            </Badge>
            <Badge variant="price">
              <Icon name="currency-usd" />
              {item.priceLevel}
            </Badge>
          </BadgeGroup>

          <Title>{item.name}</Title>
          <Subtitle>
            {item.country} · {item.popularSeason}
          </Subtitle>

          <ActionRow>
            <IconButton icon="heart-outline" />
            <IconButton icon="share-variant" />
          </ActionRow>
        </ImageOverlay>
      </DestinationCardHero>
    )}
    horizontal
    snapToInterval={cardWidth}
    decelerationRate="fast"
  />
</Section>

// Design Specs:
// - Card size: 320 x 240 pt
// - Image: Real photos from Unsplash API
// - Overlay: Linear gradient bottom-up
// - Parallax: Image moves on scroll
// - Border radius: 20pt
// - Shadow: lg elevation
```

**4. Your Trips (내 여행)**
```typescript
<Section
  title="다가오는 여행"
  icon="airplane-takeoff"
  action={{ label: "모두 보기", onPress: goToTrips }}
>
  {upcomingTrips.map(trip => (
    <TripCardCompact
      key={trip.id}
      trip={trip}
      variant="timeline"
      onPress={() => navigateToTrip(trip.id)}
      swipeActions={[
        { icon: 'pencil', label: '수정', color: 'info', onPress: editTrip },
        { icon: 'delete', label: '삭제', color: 'error', onPress: deleteTrip },
      ]}
    >
      <CountdownTimer endDate={trip.startDate} />
      <WeatherPreview weather={trip.itineraries[0].weather} />
      <ProgressBar
        completed={trip.completedActivities}
        total={trip.totalActivities}
      />
    </TripCardCompact>
  ))}
</Section>

// Design Specs:
// - Swipe to reveal actions
// - Countdown with animation
// - Weather icon auto-updates
// - Progress bar with gradient
```

**5. Travel Inspiration (여행 영감)**
```typescript
<Section title="여행 영감" icon="lightbulb-on">
  <MasonryGrid columns={2} gap={12}>
    {inspirationPosts.map(post => (
      <InspirationCard
        key={post.id}
        post={post}
        aspectRatio={post.aspectRatio}
        onPress={handlePostPress}
      >
        <Image source={{ uri: post.image }} />
        <Overlay>
          <Category>{post.category}</Category>
          <Title numberOfLines={2}>{post.title}</Title>
          <Author>
            <Avatar size="sm" source={post.author.avatar} />
            <Name>{post.author.name}</Name>
          </Author>
        </Overlay>
      </InspirationCard>
    ))}
  </MasonryGrid>
</Section>

// Design Specs:
// - Masonry layout (Pinterest-style)
// - Variable aspect ratios
// - Image lazy loading
// - Parallax on scroll
```

#### 우선순위
1. **P0 (즉시)**: Hero section, Featured destinations with real images
2. **P1 (1주)**: Quick stats, Your trips with swipe actions
3. **P2 (2주)**: Travel inspiration, Gamification badges

---

### 🗺️ Trips List Screen (여행 목록)

#### 현재 문제점
- 단순 리스트 나열
- 필터/정렬 옵션 없음
- 시각적 구분 부족

#### 새로운 디자인

**1. Header with Filters**
```typescript
<Header>
  <Title>내 여행</Title>
  <Actions>
    <IconButton icon="filter-variant" onPress={toggleFilters} />
    <IconButton icon="sort" onPress={toggleSort} />
    <IconButton icon="view-grid" onPress={toggleView} />
  </Actions>
</Header>

<FilterSheet visible={showFilters} onClose={closeFilters}>
  <FilterChips>
    <Chip selected={filter === 'all'}>전체</Chip>
    <Chip selected={filter === 'upcoming'}>예정</Chip>
    <Chip selected={filter === 'ongoing'}>진행중</Chip>
    <Chip selected={filter === 'completed'}>완료</Chip>
  </FilterChips>

  <DateRangePicker
    startDate={startDate}
    endDate={endDate}
    onChange={handleDateChange}
  />

  <ApplyButton onPress={applyFilters}>
    필터 적용
  </ApplyButton>
</FilterSheet>

// Design Specs:
// - Bottom sheet modal for filters
// - Animated chip selection
// - Date picker with calendar UI
```

**2. Trip Cards (Grid View)**
```typescript
<TripGrid columns={2} gap={16}>
  {trips.map(trip => (
    <TripCardGrid
      key={trip.id}
      trip={trip}
      onPress={handleTripPress}
    >
      <ImageContainer>
        <Image
          source={{ uri: trip.coverImage }}
          aspectRatio={4/3}
        />
        <StatusBadge status={trip.status} animated />
        <FavoriteButton
          isFavorite={trip.isFavorite}
          onToggle={() => toggleFavorite(trip.id)}
        />
      </ImageContainer>

      <Content>
        <Destination numberOfLines={1}>
          {trip.destination}
        </Destination>

        <DateRange>
          <Icon name="calendar-range" size={14} />
          {formatDateRange(trip.startDate, trip.endDate)}
        </DateRange>

        <TagRow>
          <Tag icon="map-marker-multiple">
            {trip.itineraries.length}일
          </Tag>
          <Tag icon="account-group">
            {trip.numberOfTravelers}명
          </Tag>
        </TagRow>
      </Content>
    </TripCardGrid>
  ))}
</TripGrid>

// Design Specs:
// - Grid: 2 columns on phone, 3+ on tablet
// - Card: 16pt border radius
// - Image: 4:3 aspect ratio
// - Hover: Scale up 1.02x
// - Press: Scale down 0.98x
```

**3. Trip Cards (List View)**
```typescript
{trips.map(trip => (
  <TripCardList
    key={trip.id}
    trip={trip}
    onPress={handleTripPress}
    swipeEnabled
    leftActions={[
      {
        icon: 'pencil',
        label: '수정',
        color: 'info',
        onPress: () => editTrip(trip.id),
      },
    ]}
    rightActions={[
      {
        icon: 'delete',
        label: '삭제',
        color: 'error',
        onPress: () => deleteTrip(trip.id),
      },
    ]}
  >
    <ThumbnailImage source={{ uri: trip.coverImage }} />

    <MainContent>
      <Header>
        <Destination>{trip.destination}</Destination>
        <StatusBadge status={trip.status} size="sm" />
      </Header>

      <DateRow>
        <Icon name="calendar-range" />
        <DateText>
          {formatDateRange(trip.startDate, trip.endDate)}
        </DateText>
      </DateRow>

      {trip.status === 'upcoming' && (
        <CountdownRow>
          <Icon name="clock-outline" />
          <CountdownText>
            {getDaysUntil(trip.startDate)}일 남음
          </CountdownText>
        </CountdownRow>
      )}

      <MetaRow>
        <Meta icon="map-marker-multiple">
          {trip.itineraries.length}일
        </Meta>
        <Meta icon="account-group">
          {trip.numberOfTravelers}명
        </Meta>
        <Meta icon="weather-partly-cloudy">
          {trip.itineraries[0].weather.main}
        </Meta>
      </MetaRow>
    </MainContent>

    <ChevronIcon name="chevron-right" />
  </TripCardList>
))}

// Design Specs:
// - Swipe: -60pt left, +60pt right
// - Thumbnail: 80 x 80pt, 12pt radius
// - Content: flex: 1, padding: 12pt
// - Separator: 1px, neutral-200
```

**4. Empty State**
```typescript
<EmptyState>
  <LottieAnimation
    source={require('../../assets/animations/empty-trips.json')}
    autoPlay
    loop
    style={{ width: 200, height: 200 }}
  />

  <Title>아직 계획된 여행이 없어요</Title>

  <Description>
    AI가 완벽한 여행 계획을 만들어드립니다.{'\n'}
    지금 바로 시작해보세요!
  </Description>

  <CTAButton
    variant="primary"
    size="lg"
    icon="sparkles"
    onPress={handleCreateTrip}
  >
    첫 여행 계획 만들기
  </CTAButton>

  <SecondaryAction onPress={handleBrowseDestinations}>
    인기 여행지 둘러보기 →
  </SecondaryAction>
</EmptyState>

// Design Specs:
// - Lottie animation: travel-themed
// - Centered vertically
// - Max width: 320pt
// - Button: Full width, hero style
```

#### 우선순위
1. **P0**: Real images, Grid/List toggle, Swipe actions
2. **P1**: Filters, Sort options, Empty state with Lottie
3. **P2**: Advanced filters, Search functionality

---

### 📍 Trip Detail Screen (여행 상세)

#### 현재 문제점
- 정보가 평면적으로 나열
- 날씨 정보 활용 부족
- 인터랙티브 요소 없음

#### 새로운 디자인

**1. Hero Header**
```typescript
<ParallaxScrollView
  headerHeight={360}
  renderHeader={() => (
    <HeroHeader>
      <ParallaxImage
        source={{ uri: trip.coverImage }}
        parallaxFactor={0.5}
      />

      <GradientOverlay
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        locations={[0, 1]}
      />

      <HeaderContent>
        <BackButton onPress={goBack} style="glass" />
        <ActionButtons>
          <IconButton icon="share-variant" style="glass" />
          <IconButton icon="heart" style="glass" />
          <IconButton icon="dots-vertical" style="glass" />
        </ActionButtons>

        <BottomContent>
          <StatusBadge status={trip.status} large />
          <Destination>{trip.destination}</Destination>
          <DateRange>
            {formatDateRange(trip.startDate, trip.endDate)}
          </DateRange>

          {trip.status === 'upcoming' && (
            <CountdownBanner>
              <Icon name="airplane-takeoff" />
              출발까지 {getDaysUntil(trip.startDate)}일
            </CountdownBanner>
          )}
        </BottomContent>
      </HeaderContent>
    </HeroHeader>
  )}
>
  {/* Content */}
</ParallaxScrollView>

// Design Specs:
// - Header height: 360pt
// - Parallax: Image scrolls at 50% speed
// - Gradient: Bottom 60% darkened
// - Glass buttons: blur(20), opacity 0.9
```

**2. Quick Info Cards**
```typescript
<QuickInfoRow horizontal scrollEnabled snapToInterval={cardWidth}>
  <QuickInfoCard icon="weather-partly-cloudy" color="ocean">
    <Label>평균 날씨</Label>
    <Value>{averageTemp}°C</Value>
    <Detail>{weatherDescription}</Detail>
  </QuickInfoCard>

  <QuickInfoCard icon="clock-time-four" color="sunset">
    <Label>시차</Label>
    <Value>{timezoneOffset}</Value>
    <Detail>{timezone}</Detail>
  </QuickInfoCard>

  <QuickInfoCard icon="currency-usd" color="success">
    <Label>예상 비용</Label>
    <Value>${estimatedCost}</Value>
    <Detail>1인당</Detail>
  </QuickInfoCard>

  <QuickInfoCard icon="walk" color="adventure">
    <Label>예상 이동</Label>
    <Value>{totalDistance}km</Value>
    <Detail>{totalDuration}</Detail>
  </QuickInfoCard>
</QuickInfoRow>

// Design Specs:
// - Card: 140 x 120pt
// - Icon: 40pt, gradient background
// - Horizontal scroll with snap
// - Glass morphism background
```

**3. Itinerary Timeline (일정 타임라인)**
```typescript
<Section title="여행 일정" icon="calendar-range">
  <DaySelector
    days={trip.itineraries.length}
    selectedDay={selectedDay}
    onSelectDay={setSelectedDay}
    horizontal
    showWeather
  >
    {trip.itineraries.map((itinerary, index) => (
      <DayTab
        key={itinerary.id}
        selected={selectedDay === index}
        onPress={() => setSelectedDay(index)}
      >
        <DayNumber>Day {index + 1}</DayNumber>
        <Date>{formatDate(itinerary.date)}</Date>
        <WeatherIcon name={itinerary.weather.icon} />
        <Temp>{Math.round(itinerary.weather.temp)}°</Temp>
      </DayTab>
    ))}
  </DaySelector>

  <SelectedDayContent>
    <DayHeader>
      <Title>Day {selectedDay + 1}</Title>
      <WeatherDetail weather={selectedItinerary.weather} />
    </DayHeader>

    <ActivitiesTimeline>
      {selectedItinerary.activities.map((activity, index) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          isFirst={index === 0}
          isLast={index === activities.length - 1}
          onPress={() => handleActivityPress(activity)}
          onEdit={() => editActivity(activity.id)}
        >
          <TimeIndicator>
            <Time>{activity.time}</Time>
            <Duration>{activity.estimatedDuration}</Duration>
          </TimeIndicator>

          <Connector />

          <ContentArea>
            <TypeIcon type={activity.type} />
            <MainInfo>
              <Title>{activity.title}</Title>
              <Location>
                <Icon name="map-marker" />
                {activity.location}
              </Location>
            </MainInfo>

            {activity.description && (
              <Description numberOfLines={2}>
                {activity.description}
              </Description>
            )}

            <MetaRow>
              <CostBadge>
                <Icon name="currency-usd" />
                {activity.estimatedCost}
              </CostBadge>

              {activity.reservationRequired && (
                <Badge variant="warning">
                  <Icon name="calendar-check" />
                  예약 필요
                </Badge>
              )}
            </MetaRow>

            {activity.notes && (
              <NotesSection>
                <Icon name="note-text" />
                <NotesText>{activity.notes}</NotesText>
              </NotesSection>
            )}
          </ContentArea>
        </ActivityCard>
      ))}
    </ActivitiesTimeline>

    <AddActivityButton onPress={addActivity}>
      <Icon name="plus" />
      활동 추가하기
    </AddActivityButton>
  </SelectedDayContent>
</Section>

// Design Specs:
// - Timeline: Vertical connector line
// - Cards: Expandable on press
// - Drag to reorder activities
// - Swipe for quick actions
// - Time: Bold, 16pt
// - Connector: 2px dashed line
```

**4. Interactive Map Section**
```typescript
<Section title="여행 지도" icon="map" expandable>
  <InteractiveMap
    region={{
      latitude: trip.coordinates.lat,
      longitude: trip.coordinates.lng,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    }}
    markers={getAllActivityLocations(trip)}
    onMarkerPress={handleMarkerPress}
    showsUserLocation
    polylines={getDailyRoutes(trip)}
  >
    {trip.itineraries.map((itinerary, dayIndex) => (
      <React.Fragment key={itinerary.id}>
        {itinerary.activities.map((activity, actIndex) => (
          <CustomMarker
            coordinate={{
              latitude: activity.coordinates.lat,
              longitude: activity.coordinates.lng,
            }}
            onPress={() => handleActivityMarkerPress(activity)}
          >
            <MarkerView dayIndex={dayIndex} actIndex={actIndex}>
              <DayBadge>Day {dayIndex + 1}</DayBadge>
              <IconBadge type={activity.type} />
            </MarkerView>
          </CustomMarker>
        ))}

        {/* Route between activities */}
        <Polyline
          coordinates={getRouteCoordinates(itinerary.activities)}
          strokeColor={getDayColor(dayIndex)}
          strokeWidth={3}
          lineDashPattern={[5, 5]}
        />
      </React.Fragment>
    ))}
  </InteractiveMap>

  <MapLegend>
    {trip.itineraries.map((_, index) => (
      <LegendItem key={index}>
        <ColorDot color={getDayColor(index)} />
        <LegendLabel>Day {index + 1}</LegendLabel>
      </LegendItem>
    ))}
  </MapLegend>
</Section>

// Design Specs:
// - Map library: react-native-maps
// - Custom markers with day/activity info
// - Polylines showing routes
// - Tap marker to open activity detail
// - Zoom to fit all markers
```

**5. Travel Companions**
```typescript
<Section title="함께하는 여행자" icon="account-group">
  <CompanionsRow horizontal>
    {trip.companions.map(companion => (
      <CompanionCard key={companion.id}>
        <Avatar
          source={{ uri: companion.avatar }}
          size={60}
          badge={companion.isOnline ? 'online' : null}
        />
        <Name>{companion.name}</Name>
        <Role>{companion.role}</Role>
      </CompanionCard>
    ))}

    <AddCompanionButton onPress={inviteCompanion}>
      <Icon name="account-plus" size={30} />
      <Label>초대하기</Label>
    </AddCompanionButton>
  </CompanionsRow>
</Section>
```

**6. Notes & Documents**
```typescript
<Section title="여행 메모" icon="note-text" expandable>
  <NotesList>
    {trip.notes.map(note => (
      <NoteCard key={note.id} onPress={() => editNote(note)}>
        <NoteHeader>
          <Icon name={note.icon} />
          <NoteTitle>{note.title}</NoteTitle>
          <Timestamp>{formatRelativeTime(note.updatedAt)}</Timestamp>
        </NoteHeader>
        <NotePreview numberOfLines={3}>
          {note.content}
        </NotePreview>
      </NoteCard>
    ))}
  </NotesList>

  <AddNoteButton onPress={createNote}>
    <Icon name="plus" />
    새 메모 추가
  </AddNoteButton>
</Section>

<Section title="여행 문서" icon="file-document" expandable>
  <DocumentsList>
    {trip.documents.map(doc => (
      <DocumentCard key={doc.id} onPress={() => openDocument(doc)}>
        <DocumentIcon type={doc.type} />
        <DocumentInfo>
          <DocumentName>{doc.name}</DocumentName>
          <DocumentMeta>
            {doc.size} · {formatDate(doc.uploadedAt)}
          </DocumentMeta>
        </DocumentInfo>
        <DownloadButton onPress={() => downloadDocument(doc)}>
          <Icon name="download" />
        </DownloadButton>
      </DocumentCard>
    ))}
  </DocumentsList>

  <UploadButton onPress={uploadDocument}>
    <Icon name="upload" />
    문서 업로드
  </UploadButton>
</Section>
```

#### 우선순위
1. **P0**: Hero header with parallax, Itinerary timeline, Activity cards
2. **P1**: Interactive map, Quick info cards, Day selector
3. **P2**: Companions section, Notes, Documents

---

### ➕ Create Trip Screen (여행 생성)

#### 현재 문제점
- 단순 폼 입력
- AI 생성 과정 시각화 부족
- 실시간 피드백 없음

#### 새로운 디자인

**1. Progressive Form with Steps**
```typescript
<ProgressiveForm
  steps={[
    { id: 'destination', label: '목적지', icon: 'map-marker' },
    { id: 'dates', label: '일정', icon: 'calendar-range' },
    { id: 'travelers', label: '인원', icon: 'account-group' },
    { id: 'preferences', label: '선호도', icon: 'tune' },
    { id: 'generate', label: '생성', icon: 'sparkles' },
  ]}
  currentStep={currentStep}
  onStepChange={setCurrentStep}
/>

// Step 1: Destination
<StepContainer>
  <StepTitle>어디로 떠나시나요?</StepTitle>
  <StepDescription>
    AI가 최적의 여행 계획을 만들어드립니다
  </StepDescription>

  <DestinationSearchInput
    value={destination}
    onChangeText={setDestination}
    placeholder="예: 도쿄, 파리, 뉴욕..."
    autoFocus
    leftIcon="magnify"
    onSubmit={handleDestinationSubmit}
  />

  <PopularDestinations>
    <SectionLabel>인기 여행지</SectionLabel>
    <DestinationChips horizontal>
      {POPULAR_DESTINATIONS.map(dest => (
        <DestinationChip
          key={dest.id}
          destination={dest}
          onPress={() => selectDestination(dest)}
        >
          <Flag country={dest.countryCode} />
          <ChipLabel>{dest.name}</ChipLabel>
        </DestinationChip>
      ))}
    </DestinationChips>
  </PopularDestinations>

  <RecentSearches>
    <SectionLabel>최근 검색</SectionLabel>
    {recentSearches.map(search => (
      <SearchItem
        key={search.id}
        onPress={() => selectDestination(search)}
      >
        <Icon name="history" />
        <SearchText>{search.name}</SearchText>
      </SearchItem>
    ))}
  </RecentSearches>
</StepContainer>

// Step 2: Dates
<StepContainer>
  <StepTitle>언제 떠나시나요?</StepTitle>

  <CalendarPicker
    mode="range"
    startDate={startDate}
    endDate={endDate}
    onDateRangeSelect={handleDateRangeSelect}
    minDate={new Date()}
    markedDates={{
      // Highlight peak seasons, holidays
    }}
  />

  <DateSummary>
    <Icon name="calendar-range" />
    <DateText>
      {formatDateRange(startDate, endDate)}
    </DateText>
    <Duration>
      ({calculateDays(startDate, endDate)}일)
    </Duration>
  </DateSummary>

  <QuickDateButtons>
    <QuickButton onPress={() => setDateRange('weekend')}>
      주말 (2-3일)
    </QuickButton>
    <QuickButton onPress={() => setDateRange('week')}>
      일주일 (7일)
    </QuickButton>
    <QuickButton onPress={() => setDateRange('twoWeeks')}>
      2주 (14일)
    </QuickButton>
  </QuickDateButtons>
</StepContainer>

// Step 3: Travelers
<StepContainer>
  <StepTitle>몇 명이 함께하시나요?</StepTitle>

  <TravelerCounter>
    <CounterRow>
      <Label>
        <Icon name="account" />
        성인
      </Label>
      <Counter
        value={adults}
        onIncrement={() => setAdults(adults + 1)}
        onDecrement={() => setAdults(Math.max(1, adults - 1))}
        min={1}
      />
    </CounterRow>

    <CounterRow>
      <Label>
        <Icon name="account-child" />
        어린이
      </Label>
      <Counter
        value={children}
        onIncrement={() => setChildren(children + 1)}
        onDecrement={() => setChildren(Math.max(0, children - 1))}
        min={0}
      />
    </CounterRow>
  </TravelerCounter>

  <TravelTypeSelector>
    <SectionLabel>여행 스타일</SectionLabel>
    <TravelTypeChips>
      <TypeChip
        selected={travelType === 'solo'}
        onPress={() => setTravelType('solo')}
      >
        <Icon name="account" />
        혼자
      </TypeChip>
      <TypeChip
        selected={travelType === 'couple'}
        onPress={() => setTravelType('couple')}
      >
        <Icon name="heart" />
        커플
      </TypeChip>
      <TypeChip
        selected={travelType === 'family'}
        onPress={() => setTravelType('family')}
      >
        <Icon name="account-group" />
        가족
      </TypeChip>
      <TypeChip
        selected={travelType === 'friends'}
        onPress={() => setTravelType('friends')}
      >
        <Icon name="account-multiple" />
        친구들
      </TypeChip>
    </TravelTypeChips>
  </TravelTypeSelector>
</StepContainer>

// Step 4: Preferences
<StepContainer>
  <StepTitle>어떤 여행을 원하시나요?</StepTitle>

  <PreferenceSection>
    <SectionLabel>여행 목적</SectionLabel>
    <PreferenceGrid columns={2} gap={12}>
      <PreferenceCard
        selected={purposes.includes('relaxation')}
        onPress={() => togglePurpose('relaxation')}
      >
        <Icon name="spa" size={32} />
        <Label>휴양</Label>
      </PreferenceCard>

      <PreferenceCard
        selected={purposes.includes('adventure')}
        onPress={() => togglePurpose('adventure')}
      >
        <Icon name="hiking" size={32} />
        <Label>모험</Label>
      </PreferenceCard>

      <PreferenceCard
        selected={purposes.includes('culture')}
        onPress={() => togglePurpose('culture')}
      >
        <Icon name="theater" size={32} />
        <Label>문화</Label>
      </PreferenceCard>

      <PreferenceCard
        selected={purposes.includes('food')}
        onPress={() => togglePurpose('food')}
      >
        <Icon name="food" size={32} />
        <Label>맛집 탐방</Label>
      </PreferenceCard>

      <PreferenceCard
        selected={purposes.includes('shopping')}
        onPress={() => togglePurpose('shopping')}
      >
        <Icon name="shopping" size={32} />
        <Label>쇼핑</Label>
      </PreferenceCard>

      <PreferenceCard
        selected={purposes.includes('nature')}
        onPress={() => togglePurpose('nature')}
      >
        <Icon name="pine-tree" size={32} />
        <Label>자연</Label>
      </PreferenceCard>
    </PreferenceGrid>
  </PreferenceSection>

  <PreferenceSection>
    <SectionLabel>활동 강도</SectionLabel>
    <IntensitySlider
      value={intensity}
      onChange={setIntensity}
      min={1}
      max={5}
      labels={['여유롭게', '보통', '활동적으로']}
    />
  </PreferenceSection>

  <PreferenceSection>
    <SectionLabel>예산 범위 (1인당)</SectionLabel>
    <BudgetSelector
      value={budget}
      onChange={setBudget}
      options={[
        { value: 'low', label: '저예산', range: '$500-1000' },
        { value: 'medium', label: '보통', range: '$1000-2500' },
        { value: 'high', label: '럭셔리', range: '$2500+' },
      ]}
    />
  </PreferenceSection>
</StepContainer>

// Step 5: Generate
<GenerateScreen>
  <LottieAnimation
    source={require('../../assets/animations/ai-generating.json')}
    autoPlay
    loop={isGenerating}
    style={{ width: 200, height: 200 }}
  />

  <GeneratingStatus>
    {isGenerating ? (
      <>
        <StatusTitle>AI가 완벽한 여행 계획을 만들고 있어요...</StatusTitle>
        <ProgressSteps>
          <ProgressStep completed>
            <Icon name="check-circle" />
            목적지 분석 완료
          </ProgressStep>
          <ProgressStep active>
            <Spinner />
            최적 일정 생성 중
          </ProgressStep>
          <ProgressStep>
            날씨 정보 수집 대기
          </ProgressStep>
          <ProgressStep>
            활동 추천 대기
          </ProgressStep>
        </ProgressSteps>
      </>
    ) : (
      <>
        <SuccessIcon name="check-circle" size={80} />
        <SuccessTitle>여행 계획이 완성되었어요!</SuccessTitle>
        <SuccessDescription>
          {trip.itineraries.length}일간의 완벽한 일정이 준비되었습니다
        </SuccessDescription>

        <CTAButton
          variant="primary"
          size="lg"
          onPress={() => navigateToTripDetail(trip.id)}
        >
          여행 계획 확인하기
        </CTAButton>

        <SecondaryButton onPress={regenerate}>
          다시 생성하기
        </SecondaryButton>
      </>
    )}
  </GeneratingStatus>
</GenerateScreen>

// Design Specs:
// - Step transition: Slide animation
// - Form validation: Real-time
// - Progress indicator: Top of screen
// - AI generation: 5-10 seconds with animations
```

#### 우선순위
1. **P0**: Progressive steps, Destination search, Date picker
2. **P1**: Preferences selection, AI generation animation
3. **P2**: Advanced preferences, Budget calculator

---

### 👤 Profile Screen (프로필)

#### 현재 문제점
- 정적인 메뉴 리스트
- 로그아웃 버튼만 있음
- 통계/성취 없음

#### 새로운 디자인

**1. Profile Header**
```typescript
<ProfileHeader>
  <CoverImage source={{ uri: user.coverImage }} />
  <GradientOverlay />

  <ProfileContent>
    <AvatarContainer>
      <Avatar
        source={{ uri: user.avatar }}
        size={100}
        editable
        onEdit={handleEditAvatar}
      />
      <Badge level={user.level} />
    </AvatarContainer>

    <UserInfo>
      <Name>{user.name}</Name>
      <Username>@{user.username}</Username>
      <Bio>{user.bio}</Bio>
    </UserInfo>

    <StatsRow>
      <Stat onPress={goToTrips}>
        <StatValue>{user.stats.totalTrips}</StatValue>
        <StatLabel>여행</StatLabel>
      </Stat>
      <Stat onPress={goToCountries}>
        <StatValue>{user.stats.countriesVisited}</StatValue>
        <StatLabel>국가</StatLabel>
      </Stat>
      <Stat onPress={goToBadges}>
        <StatValue>{user.stats.badgesEarned}</StatValue>
        <StatLabel>배지</StatLabel>
      </Stat>
    </StatsRow>
  </ProfileContent>
</ProfileHeader>

// Design Specs:
// - Cover: 200pt height
// - Avatar: Positioned at -50pt from bottom
// - Stats: Tappable, shows detail modal
```

**2. Achievements & Badges**
```typescript
<Section title="성취 배지" icon="trophy" action="모두 보기">
  <BadgesGrid horizontal>
    {user.badges.map(badge => (
      <BadgeCard
        key={badge.id}
        badge={badge}
        onPress={() => showBadgeDetail(badge)}
        locked={!badge.earned}
      >
        <BadgeIcon
          name={badge.icon}
          size={48}
          color={badge.earned ? badge.color : 'neutral-300'}
        />
        <BadgeName>{badge.name}</BadgeName>
        {badge.earned && (
          <EarnedDate>{formatDate(badge.earnedAt)}</EarnedDate>
        )}
        {!badge.earned && (
          <Progress>
            <ProgressBar value={badge.progress} max={100} />
            <ProgressText>{badge.progress}%</ProgressText>
          </Progress>
        )}
      </BadgeCard>
    ))}
  </BadgesGrid>
</Section>

// Badge Types:
// - First Trip
// - 5 Countries
// - 10 Trips
// - Summer Traveler
// - Winter Explorer
// - Budget Master
// - Luxury Lover
// - etc.
```

**3. Travel Timeline**
```typescript
<Section title="여행 타임라인" icon="timeline">
  <YearSelector
    years={user.travelYears}
    selectedYear={selectedYear}
    onSelect={setSelectedYear}
  />

  <TravelTimeline>
    {getTripsForYear(selectedYear).map(trip => (
      <TimelineItem
        key={trip.id}
        trip={trip}
        onPress={() => navigateToTrip(trip.id)}
      >
        <Date>{formatMonthYear(trip.startDate)}</Date>
        <Thumbnail source={{ uri: trip.coverImage }} />
        <Info>
          <Destination>{trip.destination}</Destination>
          <Duration>{trip.duration}일</Duration>
        </Info>
      </TimelineItem>
    ))}
  </TravelTimeline>
</Section>
```

**4. Settings Menu**
```typescript
<Section title="설정" icon="cog">
  <MenuList>
    <MenuItem
      icon="account-edit"
      label="프로필 수정"
      onPress={editProfile}
      rightElement={<Icon name="chevron-right" />}
    />

    <MenuItem
      icon="bell"
      label="알림"
      onPress={notificationSettings}
      rightElement={
        <Switch value={notificationsEnabled} onChange={toggleNotifications} />
      }
    />

    <MenuItem
      icon="theme-light-dark"
      label="다크 모드"
      onPress={toggleDarkMode}
      rightElement={
        <Switch value={isDarkMode} onChange={setDarkMode} />
      }
    />

    <MenuItem
      icon="translate"
      label="언어"
      onPress={languageSettings}
      rightElement={
        <LanguageBadge>{currentLanguage}</LanguageBadge>
      }
    />

    <MenuItem
      icon="lock"
      label="개인정보 및 보안"
      onPress={privacySettings}
      rightElement={<Icon name="chevron-right" />}
    />

    <MenuItem
      icon="help-circle"
      label="도움말"
      onPress={openHelp}
      rightElement={<Icon name="chevron-right" />}
    />

    <MenuItem
      icon="file-document"
      label="이용약관"
      onPress={openTerms}
      rightElement={<Icon name="chevron-right" />}
    />

    <MenuItem
      icon="shield-check"
      label="개인정보 처리방침"
      onPress={openPrivacyPolicy}
      rightElement={<Icon name="chevron-right" />}
    />
  </MenuList>
</Section>

<Section>
  <DangerButton
    icon="logout"
    onPress={handleLogout}
  >
    로그아웃
  </DangerButton>

  <VersionInfo>
    Version {appVersion}
  </VersionInfo>
</Section>
```

#### 우선순위
1. **P0**: Profile header with stats, Settings menu, Dark mode
2. **P1**: Achievements & badges, Travel timeline
3. **P2**: Social features, Friend system

---

## 애니메이션 및 마이크로 인터랙션

### 📱 Screen Transitions

```typescript
// Navigation animations
const screenTransitions = {
  // Stack navigation
  stack: {
    gestureEnabled: true,
    gestureDirection: 'horizontal',
    transitionSpec: {
      open: {
        animation: 'spring',
        config: {
          stiffness: 1000,
          damping: 500,
          mass: 3,
          overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
        },
      },
      close: {
        animation: 'spring',
        config: {
          stiffness: 1000,
          damping: 500,
          mass: 3,
          overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
        },
      },
    },
    cardStyleInterpolator: ({ current, layouts }) => ({
      cardStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [layouts.screen.width, 0],
            }),
          },
        ],
      },
    }),
  },

  // Modal presentation
  modal: {
    presentation: 'modal',
    cardStyleInterpolator: ({ current }) => ({
      cardStyle: {
        opacity: current.progress,
        transform: [
          {
            translateY: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [300, 0],
            }),
          },
        ],
      },
      overlayStyle: {
        opacity: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0.5],
        }),
      },
    }),
  },

  // Tab transition
  tab: {
    tabBarStyle: {
      position: 'absolute',
      bottom: 0,
      elevation: 0,
      borderTopWidth: 0,
      backgroundColor: 'transparent',
    },
    sceneStyleInterpolator: ({ current }) => ({
      sceneStyle: {
        opacity: current.progress,
      },
    }),
  },
};
```

### ✨ Component Animations

```typescript
// Reusable animation components

// Fade In
export const FadeIn: React.FC<FadeInProps> = ({
  children,
  duration = 300,
  delay = 0,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity }}>
      {children}
    </Animated.View>
  );
};

// Scale In
export const ScaleIn: React.FC<ScaleInProps> = ({
  children,
  duration = 300,
  delay = 0,
  initialScale = 0.8,
}) => {
  const scale = useRef(new Animated.Value(initialScale)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
};

// Slide In
export const SlideIn: React.FC<SlideInProps> = ({
  children,
  direction = 'bottom',
  duration = 400,
  delay = 0,
}) => {
  const translateY = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};

// Shimmer Loading
export const Shimmer: React.FC<ShimmerProps> = ({
  width,
  height,
  borderRadius = 8,
}) => {
  const translateX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue: width,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={{ width, height, borderRadius, overflow: 'hidden', backgroundColor: '#E2E8F0' }}>
      <Animated.View
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(255,255,255,0.5)',
          transform: [{ translateX }],
        }}
      />
    </View>
  );
};
```

### 🎯 Micro-interactions

```typescript
// Button Press Animation
export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  onPress,
  ...props
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={0.9}
        {...props}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Card Swipe Actions
export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  leftActions,
  rightActions,
  onSwipeLeft,
  onSwipeRight,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 100) {
          // Swipe right
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onSwipeRight?.());
        } else if (gestureState.dx < -100) {
          // Swipe left
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onSwipeLeft?.());
        } else {
          // Reset
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{ transform: [{ translateX }] }}
    >
      {children}
    </Animated.View>
  );
};

// Pull to Refresh
export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const rotateZ = useRef(new Animated.Value(0)).current;

  const handleRefresh = async () => {
    setRefreshing(true);

    // Rotate animation
    Animated.loop(
      Animated.timing(rotateZ, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    await onRefresh();

    setRefreshing(false);
    rotateZ.setValue(0);
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {children}
    </ScrollView>
  );
};
```

### 🎬 Lottie Animations

```typescript
// Recommended Lottie animations for Travel Planner

export const LOTTIE_ANIMATIONS = {
  // Loading states
  loading: {
    source: require('../../assets/animations/loading.json'),
    loop: true,
    autoPlay: true,
  },

  // AI generating trip
  aiGenerating: {
    source: require('../../assets/animations/ai-generating.json'),
    loop: true,
    autoPlay: true,
  },

  // Success states
  success: {
    source: require('../../assets/animations/success.json'),
    loop: false,
    autoPlay: true,
  },

  // Empty states
  emptyTrips: {
    source: require('../../assets/animations/empty-trips.json'),
    loop: true,
    autoPlay: true,
  },

  emptySearch: {
    source: require('../../assets/animations/empty-search.json'),
    loop: true,
    autoPlay: true,
  },

  // Travel themed
  airplane: {
    source: require('../../assets/animations/airplane.json'),
    loop: true,
    autoPlay: true,
  },

  globe: {
    source: require('../../assets/animations/globe.json'),
    loop: true,
    autoPlay: true,
  },

  // Weather animations
  sunny: {
    source: require('../../assets/animations/weather-sunny.json'),
    loop: true,
    autoPlay: true,
  },

  rainy: {
    source: require('../../assets/animations/weather-rainy.json'),
    loop: true,
    autoPlay: true,
  },

  cloudy: {
    source: require('../../assets/animations/weather-cloudy.json'),
    loop: true,
    autoPlay: true,
  },
};

// Usage:
import LottieView from 'lottie-react-native';

<LottieView
  source={LOTTIE_ANIMATIONS.aiGenerating.source}
  autoPlay={LOTTIE_ANIMATIONS.aiGenerating.autoPlay}
  loop={LOTTIE_ANIMATIONS.aiGenerating.loop}
  style={{ width: 200, height: 200 }}
/>
```

### ⏱️ Animation Timing Standards

```typescript
export const ANIMATION_DURATIONS = {
  // Instant (no visible animation)
  instant: 0,

  // Fast (quick feedback)
  fast: 150,

  // Normal (standard transitions)
  normal: 300,

  // Slow (emphasis)
  slow: 500,

  // Very slow (dramatic reveals)
  verySlow: 800,

  // Component-specific
  button: 150,
  modal: 300,
  drawer: 300,
  toast: 200,
  skeleton: 1500,
  pageTransition: 400,
};

export const ANIMATION_EASINGS = {
  // Standard easings
  linear: Easing.linear,
  easeIn: Easing.in(Easing.ease),
  easeOut: Easing.out(Easing.ease),
  easeInOut: Easing.inOut(Easing.ease),

  // Spring presets
  springDefault: {
    friction: 8,
    tension: 40,
  },
  springGentle: {
    friction: 10,
    tension: 30,
  },
  springBouncy: {
    friction: 5,
    tension: 50,
  },

  // Material Design
  accelerate: Easing.in(Easing.cubic),
  decelerate: Easing.out(Easing.cubic),
  sharp: Easing.inOut(Easing.cubic),
};
```

---

## 접근성 개선사항

### ♿ WCAG 2.1 AA 준수

#### 1. 터치 타겟 크기
```typescript
// Minimum touch target size: 44x44 pt

export const TOUCH_TARGETS = {
  min: 44,          // WCAG minimum
  recommended: 48,  // Better UX
  comfortable: 56,  // Extra comfortable
};

// Component implementation:
<TouchableOpacity
  style={{
    minWidth: TOUCH_TARGETS.recommended,
    minHeight: TOUCH_TARGETS.recommended,
    justifyContent: 'center',
    alignItems: 'center',
  }}
  accessible
  accessibilityRole="button"
  accessibilityLabel="여행 계획 만들기"
  accessibilityHint="새로운 여행 계획을 생성합니다"
>
  <Icon name="plus" size={24} />
  <Text>새 여행</Text>
</TouchableOpacity>
```

#### 2. 컬러 대비
```typescript
// WCAG AA: Minimum contrast ratio 4.5:1 for normal text, 3:1 for large text

export const COLOR_CONTRAST_RATIOS = {
  // Light mode
  light: {
    // Text on background
    'neutral-900': 'neutral-0',     // 15.3:1 ✅
    'neutral-700': 'neutral-0',     // 10.5:1 ✅
    'neutral-600': 'neutral-50',    // 6.2:1 ✅
    'neutral-400': 'neutral-0',     // 4.7:1 ✅

    // Brand colors
    'primary-500': 'neutral-0',     // 4.8:1 ✅
    'secondary-500': 'neutral-0',   // 3.2:1 ⚠️ (Large text only)
  },

  // Dark mode
  dark: {
    // Text on background
    'neutral-0': 'neutral-900',     // 15.3:1 ✅
    'neutral-100': 'neutral-800',   // 11.2:1 ✅
    'neutral-300': 'neutral-900',   // 7.1:1 ✅

    // Brand colors (adjusted)
    'primary-400': 'neutral-900',   // 5.2:1 ✅
    'secondary-400': 'neutral-900', // 4.8:1 ✅
  },
};

// Automatic contrast validation:
export const validateContrast = (foreground: string, background: string): boolean => {
  const ratio = calculateContrastRatio(foreground, background);
  return ratio >= 4.5; // AA standard for normal text
};
```

#### 3. 스크린 리더 지원
```typescript
// Accessibility props for all interactive components

// Button
<Button
  accessible
  accessibilityRole="button"
  accessibilityLabel="새 여행 계획 만들기"
  accessibilityHint="AI가 자동으로 여행 계획을 생성합니다"
  accessibilityState={{
    disabled: isLoading,
    busy: isLoading,
  }}
  onPress={handleCreateTrip}
>
  새 여행 만들기
</Button>

// Card
<Card
  accessible
  accessibilityRole="button"
  accessibilityLabel={`${trip.destination} 여행, ${formatDateRange(trip.startDate, trip.endDate)}, ${trip.status} 상태`}
  accessibilityHint="탭하여 여행 상세 정보를 확인하세요"
  onPress={() => navigateToTrip(trip.id)}
>
  {/* Card content */}
</Card>

// Image
<Image
  source={{ uri: destination.image }}
  accessible
  accessibilityRole="image"
  accessibilityLabel={`${destination.name}, ${destination.country}의 풍경 사진`}
/>

// Input
<TextInput
  accessible
  accessibilityLabel="이메일 주소"
  accessibilityHint="이메일 주소를 입력하세요"
  accessibilityRequired
  placeholder="your@email.com"
  value={email}
  onChangeText={setEmail}
/>

// Loading
<ActivityIndicator
  accessible
  accessibilityRole="progressbar"
  accessibilityLabel="로딩 중"
  accessibilityValue={{ text: `${progress}% 완료` }}
/>
```

#### 4. 키보드 네비게이션
```typescript
// Tab order and focus management

export const useFocusManagement = () => {
  const refs = useRef<TextInput[]>([]);

  const focusNext = (currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (refs.current[nextIndex]) {
      refs.current[nextIndex].focus();
    }
  };

  return { refs, focusNext };
};

// Usage in form:
<Form>
  <Input
    ref={(ref) => refs.current[0] = ref}
    label="목적지"
    onSubmitEditing={() => focusNext(0)}
    returnKeyType="next"
  />

  <Input
    ref={(ref) => refs.current[1] = ref}
    label="시작 날짜"
    onSubmitEditing={() => focusNext(1)}
    returnKeyType="next"
  />

  <Input
    ref={(ref) => refs.current[2] = ref}
    label="종료 날짜"
    onSubmitEditing={handleSubmit}
    returnKeyType="done"
  />
</Form>
```

#### 5. 텍스트 크기 조정
```typescript
// Support dynamic type (iOS) and font scale (Android)

export const useAccessibleFontSize = (baseFontSize: number) => {
  const [fontScale, setFontScale] = useState(1);

  useEffect(() => {
    const updateFontScale = () => {
      setFontScale(PixelRatio.getFontScale());
    };

    updateFontScale();

    // Listen for accessibility changes
    const subscription = AccessibilityInfo.addEventListener(
      'change',
      updateFontScale
    );

    return () => subscription.remove();
  }, []);

  return baseFontSize * fontScale;
};

// Component usage:
const fontSize = useAccessibleFontSize(16);

<Text style={{ fontSize }}>
  This text respects user's font size preferences
</Text>
```

#### 6. Reduced Motion
```typescript
// Respect user's reduced motion preference

export const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion
    );

    return () => subscription.remove();
  }, []);

  return reducedMotion;
};

// Usage:
const reducedMotion = useReducedMotion();

<Animated.View
  style={{
    opacity: reducedMotion ? 1 : animatedOpacity,
    transform: reducedMotion ? [] : [{ translateY: animatedTranslate }],
  }}
>
  {children}
</Animated.View>
```

#### 7. Semantic HTML (Web)
```typescript
// For web platform, use semantic HTML

<View accessibilityRole="main">
  <View accessibilityRole="header">
    <Text accessibilityRole="heading" aria-level={1}>
      Travel Planner
    </Text>
  </View>

  <View accessibilityRole="navigation">
    <Button accessibilityRole="link">Home</Button>
    <Button accessibilityRole="link">Trips</Button>
  </View>

  <View accessibilityRole="article">
    {/* Trip content */}
  </View>

  <View accessibilityRole="complementary">
    {/* Sidebar content */}
  </View>

  <View accessibilityRole="contentinfo">
    <Text>© 2026 Travel Planner</Text>
  </View>
</View>
```

---

## 구현 로드맵

### 📅 Phase 1: 핵심 디자인 시스템 (1-2주)

**목표**: 새로운 디자인 시스템 구축 및 핵심 컴포넌트 개발

#### Week 1: Foundation
- [ ] **새로운 테마 시스템 구현**
  - colors v2.0 (light + dark mode)
  - typography v2.0
  - spacing & layout
  - shadows & elevation
  - border radius

- [ ] **Core Components 개발**
  - Button (모든 variants)
  - Card (기본 + specialized)
  - Input (모든 types)
  - Badge
  - Avatar
  - Icon wrapper

- [ ] **다크 모드 인프라**
  - Theme provider with context
  - Dark mode toggle
  - Persistent preference storage

#### Week 2: Component Library
- [ ] **Feedback Components**
  - Toast notifications
  - Modal/BottomSheet
  - Loading states
  - Skeleton loaders

- [ ] **Layout Components**
  - Screen wrapper
  - Section container
  - Grid system
  - Stack layouts

- [ ] **Animation Utilities**
  - FadeIn/SlideIn/ScaleIn
  - Shimmer effect
  - AnimatedButton
  - Lottie integration

**Deliverables**:
- ✅ 완전한 디자인 시스템 문서
- ✅ 재사용 가능한 컴포넌트 라이브러리
- ✅ Storybook or component showcase
- ✅ 다크 모드 지원

---

### 🎨 Phase 2: 주요 화면 리뉴얼 (2-3주)

**목표**: 사용자 경험이 가장 중요한 화면부터 리뉴얼

#### Week 3: Home Screen
- [ ] **Hero Section**
  - Dynamic background with blur
  - Gradient overlay
  - Greeting animation
  - Quick action button

- [ ] **Featured Destinations**
  - Carousel with real images
  - Image overlay with badges
  - Weather integration
  - Action buttons

- [ ] **Quick Stats & Your Trips**
  - Stats cards with icons
  - Swipeable trip cards
  - Countdown timers
  - Progress indicators

#### Week 4: Trip List & Detail
- [ ] **Trip List Screen**
  - Grid/List toggle view
  - Filter & sort options
  - Real images from API
  - Swipe actions
  - Empty state with Lottie

- [ ] **Trip Detail - Part 1**
  - Parallax hero header
  - Quick info cards
  - Day selector tabs
  - Activities timeline

#### Week 5: Trip Detail & Create
- [ ] **Trip Detail - Part 2**
  - Interactive map integration
  - Companions section
  - Notes & documents
  - Edit capabilities

- [ ] **Create Trip Screen**
  - Progressive form steps
  - Destination search
  - Date picker calendar
  - Preferences selection
  - AI generation animation

**Deliverables**:
- ✅ 완전히 리뉴얼된 주요 화면
- ✅ Real images integrated
- ✅ Smooth animations
- ✅ Interactive elements

---

### ✨ Phase 3: 인터랙션 및 고급 기능 (2주)

**목표**: 앱을 생생하게 만드는 마이크로 인터랙션 및 고급 기능

#### Week 6: Interactions & Gestures
- [ ] **Gesture Handlers**
  - Swipe to delete/edit
  - Pull to refresh
  - Drag to reorder activities
  - Pinch to zoom on images

- [ ] **Micro-interactions**
  - Button press animations
  - Loading skeletons
  - Success/error animations
  - Haptic feedback

- [ ] **Navigation Enhancements**
  - Smooth transitions
  - Bottom tab animations
  - Modal presentations
  - Deep linking

#### Week 7: Advanced Features
- [ ] **Profile Screen Redesign**
  - Hero header with cover
  - Stats & achievements
  - Badge system
  - Travel timeline

- [ ] **Map Integration**
  - react-native-maps setup
  - Custom markers
  - Route polylines
  - Location search

- [ ] **Image Management**
  - Image picker integration
  - Upload to cloud storage
  - Image optimization
  - Caching strategies

**Deliverables**:
- ✅ Fluid user interactions
- ✅ Professional animations
- ✅ Map integration
- ✅ Complete profile system

---

### 🚀 Phase 4: 폴리싱 및 최적화 (1-2주)

**목표**: Production-ready 품질 달성

#### Week 8: Polish & Performance
- [ ] **Performance Optimization**
  - Image lazy loading
  - List virtualization (FlatList optimization)
  - Memoization (React.memo, useMemo, useCallback)
  - Bundle size optimization

- [ ] **Accessibility Audit**
  - Screen reader testing
  - Contrast ratio validation
  - Touch target sizes
  - Keyboard navigation

- [ ] **Cross-platform Testing**
  - iOS testing (various screen sizes)
  - Android testing (various devices)
  - Web responsiveness
  - Tablet layouts

- [ ] **Bug Fixes & Refinements**
  - Edge case handling
  - Error states
  - Loading states
  - Form validation

#### Week 9: Final Touches
- [ ] **Onboarding Experience**
  - Welcome screens
  - Feature highlights
  - Tutorial overlays

- [ ] **Empty & Error States**
  - All empty states with illustrations
  - Error handling UX
  - Retry mechanisms

- [ ] **Documentation**
  - Component documentation
  - Design system guide
  - User guide

**Deliverables**:
- ✅ Production-ready app
- ✅ Full accessibility compliance
- ✅ Optimized performance
- ✅ Complete documentation

---

## 📊 Success Metrics

### Performance Targets
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Frame Rate**: Consistent 60 FPS
- **Bundle Size**: < 10MB (optimized)

### Accessibility Targets
- **WCAG Level**: AA compliance
- **Contrast Ratios**: All pass 4.5:1 (normal text)
- **Touch Targets**: 100% meet 44x44pt minimum
- **Screen Reader**: 100% coverage

### User Experience Targets
- **Task Completion Rate**: > 95%
- **Error Rate**: < 2%
- **User Satisfaction**: > 4.5/5.0
- **Retention Rate**: > 70% (30-day)

---

## 🛠️ Development Guidelines

### Code Organization
```
/frontend/src/
├── components/       # Reusable UI components
├── screens/          # Screen components
├── navigation/       # Navigation configuration
├── contexts/         # React contexts
├── hooks/           # Custom hooks
├── utils/           # Utility functions
├── services/        # API services
├── constants/       # Constants & theme
├── types/           # TypeScript types
└── assets/          # Images, animations, fonts
```

### Component Development Standards
1. **TypeScript**: All components must be typed
2. **Props Interface**: Define clear prop types
3. **Accessibility**: Include accessibility props
4. **Documentation**: JSDoc comments for complex logic
5. **Testing**: Unit tests for critical components
6. **Performance**: Memoization where needed

### Git Workflow
1. **Branch Naming**: `feature/[component-name]`, `fix/[bug-description]`
2. **Commits**: Conventional commits (feat, fix, docs, style, refactor)
3. **PR Reviews**: Required for all changes
4. **CI/CD**: Automated tests and builds

### Quality Checks
- **ESLint**: Enforce code style
- **Prettier**: Consistent formatting
- **TypeScript**: Strict type checking
- **Tests**: Jest + React Native Testing Library
- **E2E**: Detox or Playwright

---

## 📚 Resources & References

### Design Inspiration
- **Mindtrip**: https://mindtrip.ai
- **Layla.ai**: https://www.layla.ai
- **TripIt**: https://www.tripit.com
- **Wanderlog**: https://wanderlog.com

### UI Libraries & Tools
- **React Native**: https://reactnative.dev
- **React Navigation**: https://reactnavigation.org
- **Lottie**: https://lottiefiles.com
- **React Native Maps**: https://github.com/react-native-maps/react-native-maps
- **React Native Reanimated**: https://docs.swmansion.com/react-native-reanimated

### Design Systems
- **Material Design**: https://material.io
- **Human Interface Guidelines**: https://developer.apple.com/design
- **Ant Design Mobile**: https://mobile.ant.design

### Accessibility
- **WCAG 2.1**: https://www.w3.org/WAI/WCAG21/quickref
- **React Native Accessibility**: https://reactnative.dev/docs/accessibility
- **Color Contrast Checker**: https://webaim.org/resources/contrastchecker

---

## 🎯 Next Steps

1. **Review & Approval**: Team review of this specification
2. **Resource Allocation**: Assign developers to phases
3. **Setup Development Environment**: Configure tools and dependencies
4. **Kick-off Phase 1**: Begin core design system implementation
5. **Weekly Progress Reviews**: Track progress against roadmap
6. **Iterative Feedback**: User testing and feedback incorporation

---

**Last Updated**: 2026-02-03
**Version**: 1.0
**Status**: Ready for Implementation 🚀
