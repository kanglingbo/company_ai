import { IsIn, IsOptional, IsString } from 'class-validator';

export class UploadDto {
  @IsOptional()
  @IsString()
  @IsIn(['公共', '财务部', '技术部'])
  department?: string;
}
