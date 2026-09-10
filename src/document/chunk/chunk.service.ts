import { Injectable } from '@nestjs/common';

@Injectable()
export class ChunkService {
  splitText(text: string, chunkSize = 1000, overlap = 200): string[] {
    const chunks: string[] = [];

    let start = 0;

    while (start < text.length) {
      const end = start + chunkSize;

      const chunk = text.slice(start, end);

      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }

      start += chunkSize - overlap;
    }

    return chunks;
  }
}
