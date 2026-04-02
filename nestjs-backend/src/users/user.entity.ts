import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Post } from '../posts/post.entity';

@Entity('users')
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true, unique: true, default: null })
  username: string | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true, unique: true, default: null })
  email: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamp', nullable: true, default: null })
  emailVerifiedAt: Date | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  password: string | null;

  @Column({ name: 'remember_token', type: 'varchar', nullable: true, default: null, length: 100 })
  rememberToken: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];
}
