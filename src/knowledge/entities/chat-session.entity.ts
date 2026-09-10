import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('chat_sessions')
@Index(['userId'])
export class ChatSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  sessionId: string;

  @Column()
  userId: number;

  @Column({
    default: '新会话',
  })
  title: string;

  @CreateDateColumn()
  createdAt: Date;
}
