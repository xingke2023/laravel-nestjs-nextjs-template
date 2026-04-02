import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('sso_users')
export class SsoUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sso_user_id', unique: true })
  ssoUserId: number;

  @Column({ name: 'local_user_id' })
  localUserId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
