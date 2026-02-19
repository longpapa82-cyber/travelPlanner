/**
 * Common selectors for TravelPlanner E2E tests.
 * Uses data-testid where possible, falls back to text/role selectors.
 */

export const SEL = {
  // Auth
  auth: {
    emailInput: 'input[placeholder*="이메일"], input[placeholder*="email" i]',
    passwordInput: 'input[type="password"]',
    nameInput: 'input[placeholder*="이름"], input[placeholder*="name" i]',
    loginButton: '[role="button"] >> text=/로그인|Log ?In|ログイン/i',
    // Fallback for cases where role="button" is missing (text-only match)
    loginButtonText: 'text=/로그인|Log ?In|ログイン/i',
    registerButton: 'text=/회원가입|Sign Up|Register/i',
    skipButton: 'text=/건너뛰기|Skip|スキップ/i',
    nextButton: 'text=/다음|Next|次へ/i',
    startButton: 'text=/시작하기|Get Started|始める/i',
  },

  // Navigation
  nav: {
    homeTab: 'text=/홈|Home|ホーム/i',
    tripsTab: 'text=/내 여행|My Trips|旅行/i',
    profileTab: 'text=/프로필|Profile|プロフィール/i',
    backButton: '[aria-label*="뒤로"], [aria-label*="back" i], [aria-label*="戻る"]',
  },

  // Home
  home: {
    heroSection: '[data-testid="home-hero"]',
    statsCard: '[data-testid="trip-stats"]',
    newTripButton: 'text=/AI 여행 계획|새 여행 만들기|Create.*Travel|AI旅行プラン/i',
    popularDestinations: '[data-testid="popular-destinations"]',
  },

  // Trip Creation
  create: {
    destinationInput: 'input[placeholder*="도시"], input[placeholder*="city" i], input[placeholder*="都市"]',
    quickDestination: (name: string) => `text=${name}`,
    durationOption: (label: string) => `text=${label}`,
    travelerOption: (count: string) => `text=${count}`,
    startDateField: 'text=/출발일|Departure|出発日/i',
    endDateField: 'text=/도착일|Return|帰国日/i',
    notesInput: 'textarea, input[placeholder*="예:"], input[placeholder*="e.g."]',
    submitButton: 'text=/여행 계획 만들기|Create Travel Plan|旅行プランを作成/i',
    loadingText: 'text=/AI가.*만들|AI is creating|AI.*creating.*plan/i',
  },

  // Trip List
  list: {
    searchInput: 'input[placeholder*="검색"], input[placeholder*="Search" i]',
    filterAll: '[data-testid="filter-all"]',
    filterUpcoming: '[data-testid="filter-upcoming"]',
    filterOngoing: '[data-testid="filter-ongoing"]',
    filterCompleted: '[data-testid="filter-completed"]',
    tripCard: '[data-testid="trip-card"]',
    emptyState: 'text=/아직.*여행|No trips|まだ旅行/i',
    deleteButton: '[aria-label*="삭제"], [aria-label*="delete" i]',
  },

  // Trip Detail
  detail: {
    heroImage: '[data-testid="detail-hero"]',
    editButton: '[aria-label*="수정"], [aria-label*="edit" i]',
    duplicateButton: '[aria-label*="복제"], [aria-label*="duplicate" i]',
    shareButton: '[aria-label*="공유"], [aria-label*="share" i]',
    dayHeader: (day: number) => `text=Day ${day}`,
    activityCard: '[data-testid="activity-card"]',
    addActivityButton: 'text=/활동 추가|Add Activity|アクティビティを追加/i',
    progressBar: 'text=/진행률|progress/i',
    completedBanner: 'text=/여행 완료|Trip Completed|旅行完了/i',
    affiliateSection: 'text=/숙소.*예약|Book Hotels|宿泊/i',
  },

  // Activity
  activity: {
    editIcon: '[aria-label*="수정"], [aria-label*="edit" i]',
    deleteIcon: '[aria-label*="삭제"], [aria-label*="delete" i]',
    toggleCircle: '[aria-label*="완료"], [aria-label*="complete" i]',
    dragHandle: '[aria-label*="순서"], [aria-label*="reorder" i]',
    modal: {
      titleInput: 'input[placeholder*="제목"], input[placeholder*="title" i]',
      locationInput: 'input[placeholder*="장소"], input[placeholder*="location" i]',
      timeInput: 'input[type="time"], input[placeholder*="시간"]',
      saveButton: 'text=/저장|Save|保存/i',
      cancelButton: 'text=/취소|Cancel|キャンセル/i',
    },
  },

  // Edit Trip
  edit: {
    destinationInput: 'input[placeholder*="직접 입력"], input[placeholder*="manually" i]',
    saveButton: 'text=/저장|Save|保存/i',
    savingText: 'text=/저장 중|Saving|保存中/i',
  },

  // Profile
  profile: {
    nameDisplay: '[data-testid="profile-name"]',
    emailDisplay: '[data-testid="profile-email"]',
    editNameButton: 'text=/프로필 수정|이름 변경|Edit Profile|Change Name/i',
    changePasswordButton: 'text=/비밀번호 변경|Change Password/i',
    languageSelector: 'text=/언어|Language|言語/i',
    darkModeToggle: 'text=/다크 모드|Dark Mode|ダークモード/i',
    logoutButton: 'text=/로그아웃|Logout|ログアウト/i',
    deleteAccountButton: 'text=/계정 삭제|Delete Account|アカウント削除/i',
  },

  // Share
  share: {
    modal: '[data-testid="share-modal"]',
    generateButton: 'text=/링크 생성|Generate Link|リンク生成/i',
    copyButton: 'text=/복사|Copy|コピー/i',
    disableButton: 'text=/공유 해제|Disable|共有解除/i',
  },

  // Common
  common: {
    confirmButton: 'text=/확인|OK|Confirm|はい/i',
    cancelButton: 'text=/취소|Cancel|キャンセル/i',
    deleteConfirmButton: 'text=/삭제|Delete|削除/i',
    errorMessage: '[role="alert"], .error-message',
    loadingSpinner: '[data-testid="loading"]',
    toast: '[data-testid="toast"]',
  },
};
