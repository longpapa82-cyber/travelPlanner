import { Injectable, Logger } from '@nestjs/common';
import { AIService } from '../services/ai.service';
import { TemplateService } from '../services/template.service';
import { getErrorMessage } from '../../common/types/request.types';

/**
 * Top 50 travel destinations worldwide for template pre-generation.
 * Ordered roughly by global tourism volume.
 */
const TOP_DESTINATIONS = [
  // Asia
  { destination: 'Tokyo, Japan', country: 'Japan', city: 'Tokyo' },
  { destination: 'Seoul, South Korea', country: 'South Korea', city: 'Seoul' },
  { destination: 'Osaka, Japan', country: 'Japan', city: 'Osaka' },
  { destination: 'Bangkok, Thailand', country: 'Thailand', city: 'Bangkok' },
  { destination: 'Singapore', country: 'Singapore', city: 'Singapore' },
  { destination: 'Hong Kong', country: 'China', city: 'Hong Kong' },
  { destination: 'Taipei, Taiwan', country: 'Taiwan', city: 'Taipei' },
  { destination: 'Bali, Indonesia', country: 'Indonesia', city: 'Bali' },
  { destination: 'Hanoi, Vietnam', country: 'Vietnam', city: 'Hanoi' },
  { destination: 'Kyoto, Japan', country: 'Japan', city: 'Kyoto' },

  // Europe
  { destination: 'Paris, France', country: 'France', city: 'Paris' },
  {
    destination: 'London, United Kingdom',
    country: 'United Kingdom',
    city: 'London',
  },
  { destination: 'Rome, Italy', country: 'Italy', city: 'Rome' },
  { destination: 'Barcelona, Spain', country: 'Spain', city: 'Barcelona' },
  {
    destination: 'Amsterdam, Netherlands',
    country: 'Netherlands',
    city: 'Amsterdam',
  },
  {
    destination: 'Prague, Czech Republic',
    country: 'Czech Republic',
    city: 'Prague',
  },
  { destination: 'Istanbul, Turkey', country: 'Turkey', city: 'Istanbul' },
  { destination: 'Vienna, Austria', country: 'Austria', city: 'Vienna' },
  { destination: 'Berlin, Germany', country: 'Germany', city: 'Berlin' },
  {
    destination: 'Zurich, Switzerland',
    country: 'Switzerland',
    city: 'Zurich',
  },

  // Americas
  { destination: 'New York, USA', country: 'USA', city: 'New York' },
  { destination: 'Los Angeles, USA', country: 'USA', city: 'Los Angeles' },
  { destination: 'Cancun, Mexico', country: 'Mexico', city: 'Cancun' },
  { destination: 'Honolulu, USA', country: 'USA', city: 'Honolulu' },
  { destination: 'San Francisco, USA', country: 'USA', city: 'San Francisco' },
  { destination: 'Las Vegas, USA', country: 'USA', city: 'Las Vegas' },
  { destination: 'Miami, USA', country: 'USA', city: 'Miami' },
  {
    destination: 'Buenos Aires, Argentina',
    country: 'Argentina',
    city: 'Buenos Aires',
  },
  { destination: 'Lima, Peru', country: 'Peru', city: 'Lima' },
  { destination: 'Vancouver, Canada', country: 'Canada', city: 'Vancouver' },

  // Oceania
  { destination: 'Sydney, Australia', country: 'Australia', city: 'Sydney' },
  {
    destination: 'Melbourne, Australia',
    country: 'Australia',
    city: 'Melbourne',
  },
  {
    destination: 'Auckland, New Zealand',
    country: 'New Zealand',
    city: 'Auckland',
  },

  // Middle East & Africa
  { destination: 'Dubai, UAE', country: 'UAE', city: 'Dubai' },
  { destination: 'Cairo, Egypt', country: 'Egypt', city: 'Cairo' },
  { destination: 'Marrakech, Morocco', country: 'Morocco', city: 'Marrakech' },
  {
    destination: 'Cape Town, South Africa',
    country: 'South Africa',
    city: 'Cape Town',
  },

  // South Korea — popular domestic destinations
  { destination: 'Busan, South Korea', country: 'South Korea', city: 'Busan' },
  { destination: 'Jeju, South Korea', country: 'South Korea', city: 'Jeju' },
  {
    destination: 'Gyeongju, South Korea',
    country: 'South Korea',
    city: 'Gyeongju',
  },
  {
    destination: 'Gangneung, South Korea',
    country: 'South Korea',
    city: 'Gangneung',
  },
  { destination: 'Yeosu, South Korea', country: 'South Korea', city: 'Yeosu' },

  // Additional popular
  { destination: 'Fukuoka, Japan', country: 'Japan', city: 'Fukuoka' },
  { destination: 'Da Nang, Vietnam', country: 'Vietnam', city: 'Da Nang' },
  { destination: 'Phuket, Thailand', country: 'Thailand', city: 'Phuket' },
  {
    destination: 'Kuala Lumpur, Malaysia',
    country: 'Malaysia',
    city: 'Kuala Lumpur',
  },
  {
    destination: 'Manila, Philippines',
    country: 'Philippines',
    city: 'Manila',
  },
  { destination: 'Florence, Italy', country: 'Italy', city: 'Florence' },
  { destination: 'Lisbon, Portugal', country: 'Portugal', city: 'Lisbon' },
  {
    destination: 'Edinburgh, United Kingdom',
    country: 'United Kingdom',
    city: 'Edinburgh',
  },
];

/** Common durations to pre-generate for each destination */
const DURATIONS = [2, 3, 4, 5, 7];

/** Languages to pre-generate */
const LANGUAGES = ['ko', 'en', 'ja'];

@Injectable()
export class SeedTemplatesCommand {
  private readonly logger = new Logger(SeedTemplatesCommand.name);

  constructor(
    private aiService: AIService,
    private templateService: TemplateService,
  ) {}

  /**
   * Seed templates for all top destinations.
   * Can be called from a controller endpoint or CLI.
   *
   * @param options.destinations - Limit to specific destinations (defaults to all)
   * @param options.durations - Limit to specific durations (defaults to [2,3,4,5,7])
   * @param options.languages - Limit to specific languages (defaults to [ko,en,ja])
   * @param options.skipExisting - Skip destinations that already have templates
   */
  async seed(options?: {
    destinations?: string[];
    durations?: number[];
    languages?: string[];
    skipExisting?: boolean;
  }): Promise<{ generated: number; skipped: number; failed: number }> {
    const destinations = options?.destinations
      ? TOP_DESTINATIONS.filter((d) =>
          options.destinations!.some(
            (name) =>
              d.city.toLowerCase() === name.toLowerCase() ||
              d.destination.toLowerCase().includes(name.toLowerCase()),
          ),
        )
      : TOP_DESTINATIONS;
    const durations = options?.durations || DURATIONS;
    const languages = options?.languages || LANGUAGES;
    const skipExisting = options?.skipExisting ?? true;

    let generated = 0;
    let skipped = 0;
    let failed = 0;
    const total = destinations.length * durations.length * languages.length;

    this.logger.log(
      `Starting template seed: ${destinations.length} destinations × ${durations.length} durations × ${languages.length} languages = ${total} templates`,
    );

    for (const dest of destinations) {
      for (const duration of durations) {
        for (const lang of languages) {
          try {
            // Check if template already exists
            if (skipExisting) {
              const existing = await this.templateService.findTemplate({
                destination: dest.destination,
                durationDays: duration,
                language: lang,
              });
              if (existing && !existing.isStale) {
                skipped++;
                continue;
              }
            }

            this.logger.log(
              `Generating: "${dest.destination}" ${duration}d [${lang}] (${generated + skipped + failed + 1}/${total})`,
            );

            const now = new Date();
            const tripContext = {
              destination: dest.destination,
              country: dest.country,
              city: dest.city,
              startDate: now,
              endDate: new Date(now.getTime() + (duration - 1) * 86400000),
              numberOfTravelers: 2,
              language: lang,
            };

            // Generate via AI (this also auto-saves via the template integration)
            const itineraries =
              await this.aiService.generateAllItineraries(tripContext);

            if (itineraries.some((it) => it.activities.length > 0)) {
              generated++;
            } else {
              this.logger.warn(
                `Empty result for "${dest.destination}" ${duration}d [${lang}]`,
              );
              failed++;
            }

            // Rate limit: wait 1s between API calls to avoid OpenAI rate limits
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            this.logger.error(
              `Failed: "${dest.destination}" ${duration}d [${lang}]: ${getErrorMessage(error)}`,
            );
            failed++;
          }
        }
      }
    }

    this.logger.log(
      `Seed complete: ${generated} generated, ${skipped} skipped, ${failed} failed`,
    );
    return { generated, skipped, failed };
  }

  /** Get the list of top destinations (useful for admin/API) */
  getTopDestinations() {
    return TOP_DESTINATIONS;
  }
}
