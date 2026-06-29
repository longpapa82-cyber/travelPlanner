/**
 * Channel-agnostic descriptor for a marketing stock photo (Pexels).
 *
 * One MarketingImage is fetched per slot and reused across BOTH publishing
 * channels:
 *   - self-blog embeds `srcUrl` directly as <img src> (Pexels permits hotlinking)
 *   - the Naver draft email attaches `buffer` (downloaded bytes) and inserts a
 *     placement marker referencing the attached file.
 *
 * Attribution fields (`photographer`, `photographerUrl`) are stored RAW — every
 * consumer MUST run them through escapeHtml before placing them in HTML. Pexels
 * asks crediting photographers when possible, so both channels render
 * "Photo by <photographer> on Pexels".
 *
 * `buffer` is present ONLY when the image was downloaded for an email attachment
 * (fetchImages called with { withBuffers: true }); the self-blog channel never
 * needs it.
 */
export interface MarketingImage {
  /** Pexels-hosted src URL (e.g. photo.src.large). <img src> + download source. */
  readonly srcUrl: string;
  /** photo.photographer (raw; escape before HTML use). */
  readonly photographer: string;
  /** photo.photographer_url, validated to start with http (else ''). */
  readonly photographerUrl: string;
  /** photo.alt if non-empty, else a built fallback. */
  readonly alt: string;
  /** Image natural width (for explicit <img width> — avoids CLS). 0 if unknown. */
  readonly width: number;
  /** Image natural height (for explicit <img height>). 0 if unknown. */
  readonly height: number;
  /** Downloaded bytes — present only when fetched for an email attachment. */
  readonly buffer?: Buffer;
  /** File extension inferred from Content-Type (no dot), e.g. 'jpg'. */
  readonly ext: string;
}
