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
  
  @ApiTags('Comments')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Controller('tasks/:taskId/comments')
  export class CommentsController {
    constructor(private readonly commentsService: CommentsService) {}
  
    @Get()
    @ApiOperation({ summary: 'Get all comments for a task' })
    async findByTask(@Param('taskId') taskId: string) {
      return this.commentsService.findByTask(taskId);
    }
  
    @Post()
    @ApiOperation({ summary: 'Add a comment to a task' })
    async create(
      @Param('taskId') taskId: string,
      @Body() dto: CreateCommentDto,
      @CurrentUser() user: any,
    ) {
      return this.commentsService.create(taskId, user.userId, dto);
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