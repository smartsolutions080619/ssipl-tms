import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
  ) {}

  async findByTask(taskId: string) {
    return this.commentRepo.query(
      `SELECT c.id, c.task_id, c.user_id, c.content, c.mentions,
              c.created_at, c.updated_at,
              u.first_name, u.last_name, u.email
       FROM tenant_ssipl.comments c
       LEFT JOIN tenant_ssipl.users u ON u.id = c.user_id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId],
    );
  }

  async findByProject(projectId: string) {
    return this.commentRepo.query(
      `SELECT c.id, c.project_id, c.user_id, c.content, c.mentions,
              c.created_at, c.updated_at,
              u.first_name, u.last_name, u.email
       FROM tenant_ssipl.comments c
       LEFT JOIN tenant_ssipl.users u ON u.id = c.user_id
       WHERE c.project_id = $1
       ORDER BY c.created_at ASC`,
      [projectId],
    );
  }

  async create(taskId: string, userId: string, dto: CreateCommentDto) {
    const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = dto.mentions || [];
    let match;
    while ((match = mentionPattern.exec(dto.content)) !== null) {
      if (!mentions.includes(match[2])) mentions.push(match[2]);
    }

    const result = await this.commentRepo.query(
      `INSERT INTO tenant_ssipl.comments
         (id, task_id, user_id, content, mentions, created_at, updated_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4::jsonb, NOW(), NOW())
       RETURNING *`,
      [taskId, userId, dto.content, JSON.stringify(mentions)],
    );

    return result[0];
  }

  async createForProject(projectId: string, userId: string, dto: CreateCommentDto) {
    const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = dto.mentions || [];
    let match;
    while ((match = mentionPattern.exec(dto.content)) !== null) {
      if (!mentions.includes(match[2])) mentions.push(match[2]);
    }

    const result = await this.commentRepo.query(
      `INSERT INTO tenant_ssipl.comments
         (id, project_id, user_id, content, mentions, created_at, updated_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4::jsonb, NOW(), NOW())
       RETURNING *`,
      [projectId, userId, dto.content, JSON.stringify(mentions)],
    );

    return result[0];
  }

  async update(id: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException(`Comment ${id} not found`);
    if (comment.userId !== userId) throw new ForbiddenException('You can only edit your own comments');

    const result = await this.commentRepo.query(
      `UPDATE tenant_ssipl.comments
       SET content = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [dto.content, id],
    );

    return result[0];
  }

  async remove(id: string, userId: string) {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException(`Comment ${id} not found`);
    if (comment.userId !== userId) throw new ForbiddenException('You can only delete your own comments');

    await this.commentRepo.query(
      `DELETE FROM tenant_ssipl.comments WHERE id = $1`,
      [id],
    );

    return { message: 'Comment deleted successfully' };
  }
}