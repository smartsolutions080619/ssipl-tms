/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// NOTE: CommentsController (tasks/:taskId/comments) removed —
// TasksController already handles GET/POST tasks/:id/comments via TasksService.
// This file only handles PROJECT comments.

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/comments')
export class ProjectCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all comments for a project' })
  async findByProject(@Param('projectId') projectId: string) {
    return this.commentsService.findByProject(projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a comment to a project' })
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.commentsService.createForProject(projectId, user.userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a comment' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.commentsService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a comment' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.commentsService.remove(id, user.userId);
  }
}