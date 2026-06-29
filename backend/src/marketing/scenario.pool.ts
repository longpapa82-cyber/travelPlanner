/**
 * Pure diversity data + pure helpers for the daily viral-marketing automation.
 *
 * No I/O, no Nest decorators — this module is trivially unit-testable and shared
 * by ScenarioService (selection) and the content/email publishers (prompting).
 *
 * Diversity model: six independent dimension pools. Each run picks exactly ONE
 * element from each pool, producing a Scenario. The product of pool sizes is in
 * the hundreds of thousands, so the 30-day no-reuse window (a few dozen rows)
 * almost never forces a retry, yet guarantees posts don't look bot-templated.
 */

export interface Destination {
  /** Korean display name used in copy/prompts (e.g. "도쿄"). */
  readonly name: string;
  /** URL-safe romanized fragment used in slugs (e.g. "tokyo"). */
  readonly slug: string;
}

export interface Scenario {
  readonly destination: string;
  readonly destinationSlug: string;
  readonly travelType: string;
  readonly durationLabel: string;
  readonly durationDays: number;
  readonly persona: string;
  readonly emphasis: string;
  readonly structure: string;
}

export interface Duration {
  readonly label: string;
  readonly days: number;
}

/** ~32 destinations (Korean name + romanized slug fragment). */
export const DESTINATIONS: readonly Destination[] = Object.freeze([
  { name: '도쿄', slug: 'tokyo' },
  { name: '교토', slug: 'kyoto' },
  { name: '오사카', slug: 'osaka' },
  { name: '후쿠오카', slug: 'fukuoka' },
  { name: '삿포로', slug: 'sapporo' },
  { name: '서울', slug: 'seoul' },
  { name: '부산', slug: 'busan' },
  { name: '제주', slug: 'jeju' },
  { name: '방콕', slug: 'bangkok' },
  { name: '치앙마이', slug: 'chiangmai' },
  { name: '싱가포르', slug: 'singapore' },
  { name: '발리', slug: 'bali' },
  { name: '다낭', slug: 'danang' },
  { name: '호치민', slug: 'hochiminh' },
  { name: '쿠알라룸푸르', slug: 'kualalumpur' },
  { name: '타이베이', slug: 'taipei' },
  { name: '홍콩', slug: 'hongkong' },
  { name: '파리', slug: 'paris' },
  { name: '런던', slug: 'london' },
  { name: '바르셀로나', slug: 'barcelona' },
  { name: '로마', slug: 'rome' },
  { name: '프라하', slug: 'prague' },
  { name: '암스테르담', slug: 'amsterdam' },
  { name: '빈', slug: 'vienna' },
  { name: '이스탄불', slug: 'istanbul' },
  { name: '뉴욕', slug: 'newyork' },
  { name: '하와이', slug: 'hawaii' },
  { name: '시드니', slug: 'sydney' },
  { name: '두바이', slug: 'dubai' },
  { name: '세부', slug: 'cebu' },
  { name: '나트랑', slug: 'nhatrang' },
  { name: '괌', slug: 'guam' },
]);

/** ~8 travel companions / trip framings. */
export const TRAVEL_TYPES: readonly string[] = Object.freeze([
  '혼자',
  '커플',
  '가족',
  '친구들',
  '부모님 효도',
  '신혼',
  '출장 겸 여행',
  '워케이션',
]);

/** ~7 durations (label + day count for slug/title and entity column). */
export const DURATIONS: readonly Duration[] = Object.freeze([
  { label: '1박 2일', days: 2 },
  { label: '2박 3일', days: 3 },
  { label: '3박 4일', days: 4 },
  { label: '4박 5일', days: 5 },
  { label: '5박 6일', days: 6 },
  { label: '6박 7일', days: 7 },
  { label: '7박 8일', days: 8 },
]);

/** ~8 personas (who is writing the diary). */
export const PERSONAS: readonly string[] = Object.freeze([
  '20대 첫 해외여행자',
  '30대 직장인',
  '워킹맘',
  '은퇴 부부',
  '대학생',
  '프리랜서',
  '사진 찍는 걸 좋아하는 사람',
  '미식가',
]);

/** ~8 product features the post naturally highlights. */
export const EMPHASES: readonly string[] = Object.freeze([
  'AI 자동 일정 생성',
  '실시간 경비 정산',
  '공동 여행자 협업',
  '현지 날씨 반영 동선',
  '오프라인에서도 보이는 일정',
  '추천 맛집과 동선',
  '일자별 진행률',
  '여행 후 추억 정리',
]);

/** ~6 narrative structures (rotated so posts don't read templated). */
export const STRUCTURES: readonly string[] = Object.freeze([
  '일기형(시간순)',
  '문제→해결형',
  'Q&A형',
  '체크리스트와 후기 혼합형',
  'Day-by-Day 요약형',
  '예전 방식 vs 앱 비교형',
]);

/** Total number of distinct scenario combinations. */
export function totalCombinations(): number {
  return (
    DESTINATIONS.length *
    TRAVEL_TYPES.length *
    DURATIONS.length *
    PERSONAS.length *
    EMPHASES.length *
    STRUCTURES.length
  );
}

/**
 * Build the stable dedup key for a scenario. Normalized (lower/trim) and joined
 * with '|' so the same six dimensions always produce the same key regardless of
 * incidental whitespace/casing.
 */
export function buildScenarioKey(s: Scenario): string {
  return [
    s.destination,
    s.travelType,
    String(s.durationDays),
    s.persona,
    s.emphasis,
    s.structure,
  ]
    .map((part) => part.trim().toLowerCase())
    .join('|');
}

function pickRandom<T>(pool: readonly T[]): T {
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

function assembleScenario(): Scenario {
  const destination = pickRandom(DESTINATIONS);
  const duration = pickRandom(DURATIONS);
  return {
    destination: destination.name,
    destinationSlug: destination.slug,
    travelType: pickRandom(TRAVEL_TYPES),
    durationLabel: duration.label,
    durationDays: duration.days,
    persona: pickRandom(PERSONAS),
    emphasis: pickRandom(EMPHASES),
    structure: pickRandom(STRUCTURES),
  };
}

/**
 * Pure selection. Random-picks one element from each pool and rejects any
 * combination whose key is in `recentKeys`. Bounded retries (never an unbounded
 * loop), then falls back to the last assembled scenario even if recently used —
 * the huge combination space makes that fallback effectively unreachable, but it
 * guarantees termination if the pools are ever shrunk drastically.
 *
 * Deterministic given the same Math.random sequence; the only non-determinism is
 * the random pick, which is intentional (diversity).
 */
export function selectScenario(
  recentKeys: ReadonlySet<string>,
  maxAttempts = 50,
): Scenario {
  let candidate = assembleScenario();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const key = buildScenarioKey(candidate);
    if (!recentKeys.has(key)) {
      return candidate;
    }
    candidate = assembleScenario();
  }
  // Bounded fallback: accept the last candidate to guarantee termination.
  return candidate;
}
