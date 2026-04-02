import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Public } from '../auth/public.decorator';

interface AuthenticatedRequest extends Request {
  userId: number;
}

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Public()
  @Get()
  findAll(@Query('page') page = '1', @Query('perPage') perPage = '10') {
    return this.postsService.findAll(parseInt(page), parseInt(perPage));
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreatePostDto, @Req() req: AuthenticatedRequest) {
    const post = await this.postsService.create(dto, req.userId);
    return { message: 'Post created successfully', post };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const post = await this.postsService.update(id, dto, req.userId);
    return { message: 'Post updated successfully', post };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.postsService.remove(id, req.userId);
    return { message: 'Post deleted successfully' };
  }
}
