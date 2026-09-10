import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { ToolService } from './tool.service';

import { Document } from '../document/entities/document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  providers: [ToolService],
  exports: [ToolService],
})
export class ToolModule {}
