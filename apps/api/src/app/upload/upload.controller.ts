import {
    Controller, Post, UseInterceptors, UploadedFile,
    UploadedFiles, UseGuards, BadRequestException, Param, Delete,
  } from '@nestjs/common';
  import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
  import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
  import { diskStorage } from 'multer';
  import { extname, join } from 'path';
  import { existsSync, mkdirSync, unlinkSync } from 'fs';
  import { JwtAuthGuard } from '../auth/guards/jwt.guard';
  import { CurrentUser } from '../common/decorators/current-user.decorator';
  import { ConfigService } from '@nestjs/config';
  
  const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'application/zip',
  ];
  
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  
  const storage = diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = join(process.cwd(), 'uploads');
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  });
  
  const fileFilter = (req: any, file: any, cb: any) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException(`File type ${file.mimetype} not allowed`), false);
    }
  };
  
  @ApiTags('Uploads')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Controller('uploads')
  export class UploadController {
    constructor(private readonly configService: ConfigService) {}
  
    private getFileUrl(filename: string): string {
      const baseUrl = this.configService.get('BACKEND_URL') || 'http://localhost:3000';
      return `${baseUrl}/uploads/${filename}`;
    }
  
    @Post()
    @ApiOperation({ summary: 'Upload a single file (max 10MB)' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', { storage, fileFilter, limits: { fileSize: MAX_SIZE } }))
    async uploadFile(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
      if (!file) throw new BadRequestException('No file provided');
  
      return {
        url:          this.getFileUrl(file.filename),
        filename:     file.filename,
        originalName: file.originalname,
        mimetype:     file.mimetype,
        size:         file.size,
        uploadedBy:   user.userId,
      };
    }
  
    @Post('multiple')
    @ApiOperation({ summary: 'Upload multiple files (max 5 files, 10MB each)' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FilesInterceptor('files', 5, { storage, fileFilter, limits: { fileSize: MAX_SIZE } }))
    async uploadFiles(@UploadedFiles() files: Express.Multer.File[], @CurrentUser() user: any) {
      if (!files || files.length === 0) throw new BadRequestException('No files provided');
  
      return files.map(file => ({
        url:          this.getFileUrl(file.filename),
        filename:     file.filename,
        originalName: file.originalname,
        mimetype:     file.mimetype,
        size:         file.size,
        uploadedBy:   user.userId,
      }));
    }
  
    @Delete(':filename')
    @ApiOperation({ summary: 'Delete an uploaded file' })
    async deleteFile(@Param('filename') filename: string) {
      const filePath = join(process.cwd(), 'uploads', filename);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        return { message: 'File deleted successfully' };
      }
      throw new BadRequestException('File not found');
    }
  }