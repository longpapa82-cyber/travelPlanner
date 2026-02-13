/**
 * Centralized image utility for Unsplash image optimization.
 *
 * - Single source of truth for destination photo IDs
 * - Generates optimized URLs with webp, quality, and width params
 * - Supports responsive sizing based on usage context
 */

// ─── Unsplash Photo IDs ────────────────────────────────────────────────
// Only store the photo ID; URL params are generated dynamically.

const DESTINATION_PHOTO_IDS: Record<string, string> = {
  '도쿄': 'photo-1540959733332-eab4deabeeaf',
  '파리': 'photo-1502602898657-3e91760cbb34',
  '뉴욕': 'photo-1496442226666-8d4d0e62e6e9',
  '런던': 'photo-1513635269975-59663e0ac1ad',
  '로마': 'photo-1552832230-c0197dd311b5',
  '바르셀로나': 'photo-1562883676-8c7feb83f09b',
  '서울': 'photo-1517154421773-0529f29ea451',
  '방콕': 'photo-1508009603885-50cf7c579365',
  '싱가포르': 'photo-1525625293386-3f8f99389edd',
  '홍콩': 'photo-1536599424071-5408d47d1ceb',
  '오사카': 'photo-1590559899731-a382839e5549',
  '다낭': 'photo-1559592413-7cec4d0cae2b',
  default: 'photo-1488646953014-85cb44e25828',
};

/** Standalone hero/background photo IDs used across screens */
export const HERO_PHOTOS = {
  travelDefault: 'photo-1488646953014-85cb44e25828',
  createTrip: 'photo-1436491865332-7a61a109cc05',
  register: 'photo-1469854523086-cc02fe5d8800',
} as const;

// ─── URL Builder ────────────────────────────────────────────────────────

interface ImageOptions {
  width?: number;
  quality?: number;
}

/**
 * Build an optimized Unsplash URL from a photo ID.
 * Always applies fm=webp and fit=crop for consistent performance.
 */
export function buildUnsplashUrl(
  photoId: string,
  { width = 400, quality = 75 }: ImageOptions = {},
): string {
  return `https://images.unsplash.com/${photoId}?w=${width}&q=${quality}&fm=webp&fit=crop`;
}

// ─── Destination Image Lookup ───────────────────────────────────────────

/**
 * Get an optimized image URL for a destination name.
 * Supports exact and partial matching (e.g. "도쿄, 일본" → "도쿄").
 */
export function getDestinationImageUrl(
  destination: string,
  options?: ImageOptions,
): string {
  // Exact match
  const exactId = DESTINATION_PHOTO_IDS[destination];
  if (exactId) return buildUnsplashUrl(exactId, options);

  // Partial match
  const matchingKey = Object.keys(DESTINATION_PHOTO_IDS).find(
    (key) => key !== 'default' && (destination.includes(key) || key.includes(destination)),
  );
  const photoId = matchingKey
    ? DESTINATION_PHOTO_IDS[matchingKey]
    : DESTINATION_PHOTO_IDS.default;

  return buildUnsplashUrl(photoId, options);
}

/**
 * Get a hero/background image URL for a named hero photo.
 */
export function getHeroImageUrl(
  heroKey: keyof typeof HERO_PHOTOS,
  options?: ImageOptions,
): string {
  return buildUnsplashUrl(HERO_PHOTOS[heroKey], options);
}
