import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './comment.entity';
import { CommentsService } from './comments.service';
// CommentsController removed — TasksController already handles
// GET/POST tasks/:id/comments via TasksService

@Module({
  imports: [TypeOrmModule.forFeature([Comment])],
  providers: [CommentsService],
  controllers: [],   // ← removed CommentsController
  exports: [CommentsService],
})
export class CommentsModule {}