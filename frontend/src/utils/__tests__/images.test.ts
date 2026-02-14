import {
  buildUnsplashUrl,
  getDestinationImageUrl,
  getHeroImageUrl,
  HERO_PHOTOS,
} from '../images';

describe('images', () => {
  // ── buildUnsplashUrl ──

  describe('buildUnsplashUrl', () => {
    it('should build URL with default params', () => {
      const url = buildUnsplashUrl('photo-123');

      expect(url).toBe(
        'https://images.unsplash.com/photo-123?w=400&q=75&fm=webp&fit=crop',
      );
    });

    it('should apply custom width', () => {
      const url = buildUnsplashUrl('photo-123', { width: 800 });

      expect(url).toContain('w=800');
    });

    it('should apply custom quality', () => {
      const url = buildUnsplashUrl('photo-123', { quality: 90 });

      expect(url).toContain('q=90');
    });

    it('should apply both custom width and quality', () => {
      const url = buildUnsplashUrl('photo-123', { width: 1200, quality: 50 });

      expect(url).toContain('w=1200');
      expect(url).toContain('q=50');
      expect(url).toContain('fm=webp');
      expect(url).toContain('fit=crop');
    });
  });

  // ── getDestinationImageUrl ──

  describe('getDestinationImageUrl', () => {
    it('should return exact match for known destination', () => {
      const url = getDestinationImageUrl('도쿄');

      expect(url).toContain('photo-1540959733332-eab4deabeeaf');
    });

    it('should return exact match for Paris', () => {
      const url = getDestinationImageUrl('파리');

      expect(url).toContain('photo-1502602898657-3e91760cbb34');
    });

    it('should return partial match for destination with country', () => {
      const url = getDestinationImageUrl('도쿄, 일본');

      expect(url).toContain('photo-1540959733332-eab4deabeeaf');
    });

    it('should return default image for unknown destination', () => {
      const url = getDestinationImageUrl('알수없는곳');

      expect(url).toContain('photo-1488646953014-85cb44e25828');
    });

    it('should apply image options', () => {
      const url = getDestinationImageUrl('서울', { width: 600 });

      expect(url).toContain('w=600');
      expect(url).toContain('photo-1517154421773-0529f29ea451');
    });

    it('should match all known destinations', () => {
      const destinations = [
        '도쿄', '파리', '뉴욕', '런던', '로마',
        '바르셀로나', '서울', '방콕', '싱가포르', '홍콩', '오사카', '다낭',
      ];

      destinations.forEach((dest) => {
        const url = getDestinationImageUrl(dest);
        // Should NOT use default photo
        expect(url).not.toContain('photo-1488646953014-85cb44e25828');
      });
    });
  });

  // ── getHeroImageUrl ──

  describe('getHeroImageUrl', () => {
    it('should return travelDefault hero image', () => {
      const url = getHeroImageUrl('travelDefault');

      expect(url).toContain(HERO_PHOTOS.travelDefault);
    });

    it('should return createTrip hero image', () => {
      const url = getHeroImageUrl('createTrip');

      expect(url).toContain(HERO_PHOTOS.createTrip);
    });

    it('should return register hero image', () => {
      const url = getHeroImageUrl('register');

      expect(url).toContain(HERO_PHOTOS.register);
    });

    it('should apply custom options to hero image', () => {
      const url = getHeroImageUrl('travelDefault', {
        width: 1920,
        quality: 90,
      });

      expect(url).toContain('w=1920');
      expect(url).toContain('q=90');
    });
  });
});
