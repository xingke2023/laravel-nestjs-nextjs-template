import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepo: Repository<Post>,
  ) {}

  async findAll(page = 1, perPage = 10) {
    const [data, total] = await this.postsRepo.findAndCount({
      where: { published: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return {
      data: data.map((p) => ({
        ...p,
        user: p.user ? { id: p.user.id, name: p.user.name, email: p.user.email } : undefined,
      })),
      total,
      page,
      perPage,
      lastPage: Math.ceil(total / perPage),
    };
  }

  async findOne(id: number) {
    const post = await this.postsRepo.findOne({ where: { id }, relations: ['user'] });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async create(dto: CreatePostDto, userId: number) {
    const post = this.postsRepo.create({ ...dto, userId });
    return this.postsRepo.save(post);
  }

  async update(id: number, dto: UpdatePostDto, userId: number) {
    const post = await this.findOne(id);
    if (post.userId !== userId) throw new ForbiddenException('You do not own this post');
    Object.assign(post, dto);
    return this.postsRepo.save(post);
  }

  async remove(id: number, userId: number) {
    const post = await this.findOne(id);
    if (post.userId !== userId) throw new ForbiddenException('You do not own this post');
    await this.postsRepo.remove(post);
  }
}
