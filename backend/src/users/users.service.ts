import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, AuthProvider } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { t } from '../common/i18n';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: {
    email?: string;
    password?: string;
    name: string;
    provider: AuthProvider;
    providerId?: string;
    profileImage?: string;
  }): Promise<User> {
    const user = this.userRepository.create({
      email: data.email,
      passwordHash: data.password
        ? await bcrypt.hash(data.password, 10)
        : undefined,
      name: data.name,
      provider: data.provider,
      providerId: data.providerId,
      profileImage: data.profileImage,
    });

    return await this.userRepository.save(user);
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByProviderAndId(
    provider: AuthProvider,
    providerId: string,
  ): Promise<User | null> {
    return this.userRepository.findOne({
      where: { provider, providerId },
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) {
      return false;
    }
    return bcrypt.compare(password, user.passwordHash);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    return this.findById(id);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    lang: 'ko' | 'en' | 'ja' = 'ko',
  ): Promise<{ message: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!user.passwordHash) {
      throw new BadRequestException(t('password.socialNotAllowed', lang));
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException(t('password.currentInvalid', lang));
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.update(id, { passwordHash: newHash });

    return { message: t('password.changed', lang) };
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }
}
