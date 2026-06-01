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
      return this.commentRepo.find({
        where: { taskId },
        order: { createdAt: 'ASC' },
      });
    }
  
    async create(taskId: string, userId: string, dto: CreateCommentDto) {
      // @mentions extract karo content se
      const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
      const mentions: string[] = dto.mentions || [];
  
      // Content se @mentions automatically parse karo
      let match;
      while ((match = mentionPattern.exec(dto.content)) !== null) {
        if (!mentions.includes(match[2])) {
          mentions.push(match[2]);
        }
      }
  
      const comment = this.commentRepo.create({
        taskId,
        userId,
        content: dto.content,
        mentions,
      });
  
      return this.commentRepo.save(comment);
    }
  
    async update(id: string, userId: string, dto: UpdateCommentDto) {
      const comment = await this.commentRepo.findOne({ where: { id } });
  
      if (!comment) {
        throw new NotFoundException(`Comment ${id} not found`);
      }
  
      // Sirf apna comment update kar sakta hai
      if (comment.userId !== userId) {
        throw new ForbiddenException('You can only edit your own comments');
      }
  
      comment.content = dto.content;
      return this.commentRepo.save(comment);
    }
  
    async remove(id: string, userId: string) {
      const comment = await this.commentRepo.findOne({ where: { id } });
  
      if (!comment) {
        throw new NotFoundException(`Comment ${id} not found`);
      }
  
      // Sirf apna comment delete kar sakta hai
      if (comment.userId !== userId) {
        throw new ForbiddenException('You can only delete your own comments');
      }
  
      await this.commentRepo.remove(comment);
      return { message: 'Comment deleted successfully' };
    }
  }