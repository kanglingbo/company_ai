import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { Role } from '../../auth/role.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsIn([Role.EMPLOYEE, Role.MANAGER, Role.ADMIN])
  role?: Role;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  department?: string;
}
