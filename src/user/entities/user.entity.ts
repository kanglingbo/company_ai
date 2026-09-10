import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../../auth/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  username: string;

  @Column()
  password: string;

  @Column({
    type: 'varchar',
    default: Role.EMPLOYEE,
  })
  role: Role;

  @Column({
    nullable: true,
  })
  department: string;

  @CreateDateColumn()
  createdAt: Date;
}
