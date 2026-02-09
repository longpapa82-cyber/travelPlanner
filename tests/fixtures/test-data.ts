/**
 * Seed data definitions for each worker.
 * Used by global-setup to create test data via API before tests run.
 */

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export const SEED_TRIPS = {
  // W4: 5 trips for list testing (2 upcoming, 1 ongoing, 2 completed)
  W4: [
    {
      destination: '도쿄',
      startDate: futureDate(10),
      endDate: futureDate(14),
      numberOfTravelers: 2,
      description: 'W4 도쿄 예정 여행',
    },
    {
      destination: '파리',
      startDate: futureDate(30),
      endDate: futureDate(37),
      numberOfTravelers: 4,
      description: 'W4 파리 예정 여행',
    },
    {
      destination: '방콕',
      startDate: pastDate(2),
      endDate: futureDate(3),
      numberOfTravelers: 2,
      description: 'W4 방콕 진행중 여행',
    },
    {
      destination: '런던',
      startDate: pastDate(20),
      endDate: pastDate(14),
      numberOfTravelers: 3,
      description: 'W4 런던 완료 여행',
    },
    {
      destination: '바르셀로나',
      startDate: pastDate(40),
      endDate: pastDate(34),
      numberOfTravelers: 2,
      description: 'W4 바르셀로나 완료 여행',
    },
  ],

  // W5: 2 trips for detail/activity testing
  W5: [
    {
      destination: '오사카',
      startDate: futureDate(5),
      endDate: futureDate(8),
      numberOfTravelers: 2,
      description: 'W5 오사카 활동 테스트용',
    },
    {
      destination: '싱가포르',
      startDate: pastDate(1),
      endDate: futureDate(2),
      numberOfTravelers: 3,
      description: 'W5 싱가포르 진행중',
    },
  ],

  // W6: 3 trips for edit testing (1 upcoming, 1 ongoing, 1 completed)
  W6: [
    {
      destination: '뉴욕',
      startDate: futureDate(15),
      endDate: futureDate(21),
      numberOfTravelers: 2,
      description: 'W6 뉴욕 수정 테스트용',
    },
    {
      destination: '다낭',
      startDate: pastDate(1),
      endDate: futureDate(4),
      numberOfTravelers: 2,
      description: 'W6 다낭 진행중',
    },
    {
      destination: '홍콩',
      startDate: pastDate(15),
      endDate: pastDate(10),
      numberOfTravelers: 4,
      description: 'W6 홍콩 완료',
    },
  ],

  // W7: 1 trip for sharing
  W7: [
    {
      destination: '도쿄',
      startDate: futureDate(7),
      endDate: futureDate(11),
      numberOfTravelers: 2,
      description: 'W7 공유 테스트용',
    },
  ],

  // W8: 1 trip for error/security testing
  W8: [
    {
      destination: '파리',
      startDate: futureDate(20),
      endDate: futureDate(25),
      numberOfTravelers: 2,
      description: 'W8 보안 테스트용',
    },
  ],

  // DESTROY: 1 trip for destructive tests
  DESTROY: [
    {
      destination: '런던',
      startDate: futureDate(10),
      endDate: futureDate(14),
      numberOfTravelers: 2,
      description: '삭제 테스트용',
    },
  ],
};

export const SAMPLE_ACTIVITY = {
  time: '10:00',
  title: '테스트 관광',
  description: '테스트용 관광 활동',
  location: '테스트 장소',
  estimatedDuration: 120,
  estimatedCost: 50,
  type: 'sightseeing',
};
