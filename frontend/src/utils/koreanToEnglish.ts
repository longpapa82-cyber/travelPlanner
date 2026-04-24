/**
 * Korean Dubeolsik keyboard → English key conversion utility.
 *
 * When a user types with the Korean keyboard active, the same physical keys
 * produce Korean jamo instead of English letters. This utility converts
 * Korean characters back to the English keys that would have been typed
 * on a QWERTY keyboard with the standard Korean dubeolsik layout.
 *
 * Handles:
 * - Compatibility jamo (ㄱ-ㅣ, U+3130-318F)
 * - Composed Hangul syllables (가-힣, U+AC00-D7AF) via Unicode decomposition
 * - Jamo block (U+1100-11FF)
 * - Compound jongseong (ㄳ, ㄵ, etc.) → two individual keys
 */

// Jamo → physical key on dubeolsik keyboard
const JAMO_TO_KEY: Record<string, string> = {
  // Consonants (basic)
  'ㅂ': 'q', 'ㅈ': 'w', 'ㄷ': 'e', 'ㄱ': 'r', 'ㅅ': 't',
  'ㅁ': 'a', 'ㄴ': 's', 'ㅇ': 'd', 'ㄹ': 'f', 'ㅎ': 'g',
  'ㅋ': 'z', 'ㅌ': 'x', 'ㅊ': 'c', 'ㅍ': 'v',
  // Consonants (double / shift)
  'ㅃ': 'Q', 'ㅉ': 'W', 'ㄸ': 'E', 'ㄲ': 'R', 'ㅆ': 'T',
  // Vowels
  'ㅛ': 'y', 'ㅕ': 'u', 'ㅑ': 'i', 'ㅐ': 'o', 'ㅔ': 'p',
  'ㅗ': 'h', 'ㅓ': 'j', 'ㅏ': 'k', 'ㅣ': 'l',
  'ㅠ': 'b', 'ㅜ': 'n', 'ㅡ': 'm',
  'ㅒ': 'O', 'ㅖ': 'P',
  // Compound vowels (decompose to constituent key strokes)
  'ㅘ': 'hk', 'ㅙ': 'ho', 'ㅚ': 'hl', 'ㅝ': 'nj', 'ㅞ': 'np', 'ㅟ': 'nl', 'ㅢ': 'ml',
};

// Compound jongseong → two individual jamo
const COMPOUND_JONG: Record<string, string> = {
  'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ',
  'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ',
  'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ',
  'ㅄ': 'ㅂㅅ',
};

// Unicode Hangul syllable decomposition arrays
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

/** Decompose a Hangul syllable (가-힣) into its constituent jamo. */
function decomposeHangul(ch: string): string[] {
  const code = ch.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7AF) return [ch];
  const offset = code - 0xAC00;
  const choIdx = Math.floor(offset / 588);
  const jungIdx = Math.floor((offset % 588) / 28);
  const jongIdx = offset % 28;
  const result = [CHO[choIdx], JUNG[jungIdx]];
  if (jongIdx > 0) result.push(JONG[jongIdx]);
  return result;
}

/** Map a single jamo to the English key(s). Handles compound jongseong. */
function jamoToKey(jamo: string): string {
  if (JAMO_TO_KEY[jamo]) return JAMO_TO_KEY[jamo];
  const compound = COMPOUND_JONG[jamo];
  if (compound) {
    return compound.split('').map(j => JAMO_TO_KEY[j] ?? j).join('');
  }
  return jamo;
}

/** Regex matching any Korean character (jamo or composed syllable). */
export const KOREAN_REGEX = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;

/**
 * Convert Korean characters to their English keyboard equivalents
 * using the standard Korean dubeolsik layout.
 * Non-Korean characters pass through unchanged.
 */
export function convertKoreanToEnglish(text: string): string {
  if (!KOREAN_REGEX.test(text)) return text;
  let result = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7AF) {
      result += decomposeHangul(ch).map(jamoToKey).join('');
    } else if (code >= 0x3130 && code <= 0x318F) {
      result += jamoToKey(ch);
    } else if (code >= 0x1100 && code <= 0x11FF) {
      result += jamoToKey(ch);
    } else {
      result += ch;
    }
  }
  return result;
}
