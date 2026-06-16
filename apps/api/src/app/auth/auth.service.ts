import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from './user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenBlacklistService } from './token-blacklist.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('User with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email, passwordHash,
      firstName: dto.firstName, lastName: dto.lastName,
      status: UserStatus.PENDING,
      isActive: false,
    });
    await this.userRepo.save(user);

    // Notify all admins
    const admins = await this.userRepo.query(
      `SELECT u.email, u.first_name FROM users u
       INNER JOIN roles r ON r.id::text = u.role_id::text
       WHERE LOWER(r.name) = 'admin' AND u.status = 'ACTIVE' AND u.deleted_at IS NULL`
    );
    for (const admin of admins) {
      await this.mailService.sendNewUserRequest(admin.email, admin.first_name, `${user.firstName} ${user.lastName}`, user.email);
    }

    return {
      message: 'Registration successful. Your account is pending admin approval.',
      status: 'PENDING',
    };
  }

  async login(dto: LoginDto, tenantId: string) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    if (user.status === UserStatus.PENDING)
      throw new ForbiddenException('Your account is pending admin approval. Please wait for confirmation.');
    if (user.status === UserStatus.REJECTED)
      throw new ForbiddenException('Your account registration was rejected. Please contact the administrator.');
    if (!user.isActive)
      throw new UnauthorizedException('Your account has been deactivated.');

    let roleName = null;
    let permissions = [];
    if (user.roleId) {
      const roleResult = await this.userRepo.query(`SELECT name, permissions FROM roles WHERE id = $1`, [user.roleId]);
      if (roleResult.length > 0) { roleName = roleResult[0].name; permissions = roleResult[0].permissions; }
    }

    const payload = { sub: user.id, email: user.email, tenantId, role: roleName, permissions };
    return {
      accessToken:  this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: roleName },
    };
  }

  async refreshToken(token: string) {
    const isBlacklisted = await this.tokenBlacklist.isBlacklisted(token);
    if (isBlacklisted) throw new UnauthorizedException('Token has been revoked');
    try {
      const payload = this.jwtService.verify(token);
      return { accessToken: this.jwtService.sign({ sub: payload.sub, email: payload.email, tenantId: payload.tenantId }, { expiresIn: '15m' }) };
    } catch { throw new UnauthorizedException('Invalid refresh token'); }
  }

  async logout(token: string) {
    await this.tokenBlacklist.blacklistToken(token);
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) return { message: 'If this email exists, a reset link has been sent' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    await this.userRepo.query(
      `UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3`,
      [resetTokenHash, new Date(Date.now() + 3600000), email]
    );
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    await this.mailService.sendForgotPassword(user.email, user.firstName, resetUrl);
    return { message: 'If this email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.userRepo.findOne({ where: { resetPasswordToken: tokenHash } });
    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date())
      throw new UnauthorizedException('Invalid or expired reset token');
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.userRepo.save(user);
    return { message: 'Password reset successfully' };
  }
}