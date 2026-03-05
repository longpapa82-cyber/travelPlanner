import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { TripLike } from './entities/trip-like.entity';
import { Trip } from '../trips/entities/trip.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(TripLike)
    private readonly tripLikeRepository: Repository<TripLike>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Follow / Unfollow ─────────────────────────

  async follow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const target = await this.userRepository.findOne({
      where: { id: followingId },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    // Idempotent follow — silently succeed if already following
    const existing = await this.followRepository.findOne({
      where: { followerId, followingId },
    });
    if (existing) {
      return;
    }

    await this.followRepository.save(
      this.followRepository.create({ followerId, followingId }),
    );

    // Atomic counter increments
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ followingCount: () => '"followingCount" + 1' })
      .where('id = :id', { id: followerId })
      .execute();

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ followersCount: () => '"followersCount" + 1' })
      .where('id = :id', { id: followingId })
      .execute();

    // Notification to target user
    const follower = await this.userRepository.findOne({
      where: { id: followerId },
    });
    if (follower) {
      this.notificationsService
        .create(
          followingId,
          NotificationType.NEW_FOLLOWER,
          'New follower',
          `${follower.name} started following you`,
          { followerId, followerName: follower.name },
        )
        .catch((err) =>
          this.logger.warn('Failed to create follow notification', err),
        );
    }
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const existing = await this.followRepository.findOne({
      where: { followerId, followingId },
    });
    if (!existing) {
      return; // Idempotent — already not following
    }

    await this.followRepository.remove(existing);

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ followingCount: () => 'GREATEST("followingCount" - 1, 0)' })
      .where('id = :id', { id: followerId })
      .execute();

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ followersCount: () => 'GREATEST("followersCount" - 1, 0)' })
      .where('id = :id', { id: followingId })
      .execute();
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const count = await this.followRepository.count({
      where: { followerId, followingId },
    });
    return count > 0;
  }

  async getFollowers(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ users: Partial<User>[]; total: number }> {
    const [follows, total] = await this.followRepository
      .createQueryBuilder('follow')
      .leftJoin('follow.follower', 'follower')
      .addSelect(['follower.id', 'follower.name', 'follower.profileImage'])
      .where('follow.followingId = :userId', { userId })
      .orderBy('follow.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const users = follows.map((f) => ({
      id: f.follower.id,
      name: f.follower.name,
      profileImage: f.follower.profileImage,
    }));

    return { users, total };
  }

  async getFollowing(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ users: Partial<User>[]; total: number }> {
    const [follows, total] = await this.followRepository
      .createQueryBuilder('follow')
      .leftJoin('follow.following', 'following')
      .addSelect(['following.id', 'following.name', 'following.profileImage'])
      .where('follow.followerId = :userId', { userId })
      .orderBy('follow.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const users = follows.map((f) => ({
      id: f.following.id,
      name: f.following.name,
      profileImage: f.following.profileImage,
    }));

    return { users, total };
  }

  // ─── Like / Unlike ─────────────────────────────

  async likeTrip(userId: string, tripId: string): Promise<void> {
    const trip = await this.tripRepository.findOne({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    if (!trip.isPublic) {
      throw new BadRequestException('Cannot like a private trip');
    }

    // Idempotent like — silently succeed if already liked
    const existing = await this.tripLikeRepository.findOne({
      where: { userId, tripId },
    });
    if (existing) {
      return;
    }

    await this.tripLikeRepository.save(
      this.tripLikeRepository.create({ userId, tripId }),
    );

    // Atomic increment
    await this.tripRepository
      .createQueryBuilder()
      .update(Trip)
      .set({ likesCount: () => '"likesCount" + 1' })
      .where('id = :id', { id: tripId })
      .execute();

    // Notify trip owner (don't notify yourself)
    if (trip.userId !== userId) {
      const liker = await this.userRepository.findOne({
        where: { id: userId },
      });
      if (liker) {
        this.notificationsService
          .create(
            trip.userId,
            NotificationType.TRIP_LIKED,
            'Trip liked',
            `${liker.name} liked your trip to ${trip.destination}`,
            { tripId, likerId: userId, likerName: liker.name },
          )
          .catch((err) =>
            this.logger.warn('Failed to create like notification', err),
          );
      }
    }
  }

  async unlikeTrip(userId: string, tripId: string): Promise<void> {
    const existing = await this.tripLikeRepository.findOne({
      where: { userId, tripId },
    });
    if (!existing) {
      return; // Idempotent — already not liked
    }

    await this.tripLikeRepository.remove(existing);

    await this.tripRepository
      .createQueryBuilder()
      .update(Trip)
      .set({ likesCount: () => 'GREATEST("likesCount" - 1, 0)' })
      .where('id = :id', { id: tripId })
      .execute();
  }

  // ─── Discover Feed ─────────────────────────────

  async getDiscoverFeed(
    userId: string,
    page = 1,
    limit = 20,
    tab: 'following' | 'trending' = 'trending',
  ) {
    if (tab === 'following') {
      return this.getFollowingFeed(userId, page, limit);
    }
    return this.getTrendingFeed(userId, page, limit);
  }

  private async getFollowingFeed(userId: string, page: number, limit: number) {
    const qb = this.tripRepository
      .createQueryBuilder('trip')
      .innerJoin(Follow, 'f', 'f."followingId" = trip."userId"')
      .leftJoin('trip.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.profileImage'])
      .where('f."followerId" = :userId', { userId })
      .andWhere('trip."isPublic" = true')
      .orderBy('trip.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [trips, total] = await qb.getManyAndCount();

    const likedTripIds = await this.getUserLikedTripIds(
      userId,
      trips.map((t) => t.id),
    );

    const items = trips.map((trip) => this.formatFeedTrip(trip, likedTripIds));
    return { items, total };
  }

  private async getTrendingFeed(userId: string, page: number, limit: number) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const qb = this.tripRepository
      .createQueryBuilder('trip')
      .leftJoin('trip.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.profileImage'])
      .where('trip."isPublic" = true')
      .andWhere('trip."createdAt" > :since', { since: thirtyDaysAgo })
      .orderBy('trip.likesCount', 'DESC')
      .addOrderBy('trip.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [trips, total] = await qb.getManyAndCount();

    const likedTripIds = await this.getUserLikedTripIds(
      userId,
      trips.map((t) => t.id),
    );

    const items = trips.map((trip) => this.formatFeedTrip(trip, likedTripIds));
    return { items, total };
  }

  private async getUserLikedTripIds(
    userId: string,
    tripIds: string[],
  ): Promise<Set<string>> {
    if (tripIds.length === 0) return new Set();

    const likes = await this.tripLikeRepository
      .createQueryBuilder('tl')
      .where('tl."userId" = :userId', { userId })
      .andWhere('tl."tripId" IN (:...tripIds)', { tripIds })
      .getMany();

    return new Set(likes.map((l) => l.tripId));
  }

  private formatFeedTrip(trip: Trip, likedTripIds: Set<string>) {
    return {
      id: trip.id,
      destination: trip.destination,
      country: trip.country,
      coverImage: trip.coverImage,
      startDate: trip.startDate,
      endDate: trip.endDate,
      likesCount: trip.likesCount,
      isLiked: likedTripIds.has(trip.id),
      user: {
        id: trip.user?.id,
        name: trip.user?.name,
        profileImage: trip.user?.profileImage,
      },
    };
  }

  // ─── User Profile ──────────────────────────────

  async getUserProfile(viewerId: string, profileUserId: string) {
    const user = await this.userRepository.findOne({
      where: { id: profileUserId },
      select: [
        'id',
        'name',
        'profileImage',
        'followersCount',
        'followingCount',
      ],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isFollowing =
      viewerId !== profileUserId
        ? await this.isFollowing(viewerId, profileUserId)
        : false;

    const [publicTrips, tripsTotal] = await this.tripRepository.findAndCount({
      where: { userId: profileUserId, isPublic: true },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    // Check which trips the viewer has liked
    const likedTripIds = await this.getUserLikedTripIds(
      viewerId,
      publicTrips.map((t) => t.id),
    );

    return {
      id: user.id,
      name: user.name,
      profileImage: user.profileImage,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      isFollowing,
      publicTrips: publicTrips.map((trip) =>
        this.formatFeedTrip(trip, likedTripIds),
      ),
      publicTripsTotal: tripsTotal,
    };
  }
}
