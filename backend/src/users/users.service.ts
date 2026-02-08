import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, AuthProvider } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

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

  async validatePassword(
    user: User,
    password: string,
  ): Promise<boolean> {
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
      throw new BadRequestException('소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('현재 비밀번호가 일치하지 않습니다.');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.update(id, { passwordHash: newHash });

    return { message: '비밀번호가 변경되었습니다.' };
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }
}
