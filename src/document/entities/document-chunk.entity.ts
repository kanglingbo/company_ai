import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Document } from './document.entity';

@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Document, (document) => document.chunks, {
    onDelete: 'CASCADE',
  })
  document: Document;

  @Column()
  chunkIndex: number;

  @Column('text')
  content: string;

  @Column({
    type: 'vector',
    length: 1024,
    nullable: true,
  })
  embedding: number[];
}
