import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';

export interface Document {
  id: string;
  studySetId: string;
  userId: string;
  title: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  pageCount: number | null;
  extractedText: string | null;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentDto {
  studySetId: string;
  title: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface UpdateDocumentDto {
  title?: string;
  extractedText?: string;
  pageCount?: number;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Uploaded study documents: metadata rows plus the backing object in R2.
 * Deletion removes the stored file first, then the row.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  async create(userId: string, dto: CreateDocumentDto): Promise<Document> {
    const id = uuidv4();
    const now = new Date();

    const result = await this.db.queryOne<Document>(
      `INSERT INTO documents (id, study_set_id, user_id, title, file_name, file_url, file_size, mime_type, processing_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
       RETURNING *`,
      [
        id,
        dto.studySetId,
        userId,
        dto.title,
        dto.fileName,
        dto.fileUrl,
        dto.fileSize,
        dto.mimeType,
        now,
        now,
      ],
    );

    this.logger.log(`Document created: ${id}`);
    return this.mapDocument(result!);
  }

  async findById(id: string): Promise<Document | null> {
    const result = await this.db.queryOne<Document>('SELECT * FROM documents WHERE id = $1', [id]);
    return result ? this.mapDocument(result) : null;
  }

  async findByIdWithAccess(id: string, userId: string): Promise<Document> {
    const document = await this.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    if (document.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return document;
  }

  async findByStudySet(studySetId: string): Promise<Document[]> {
    const results = await this.db.queryMany<Document>(
      'SELECT * FROM documents WHERE study_set_id = $1 ORDER BY created_at DESC',
      [studySetId],
    );
    return results.map((row) => this.mapDocument(row));
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Document[]; total: number }> {
    const offset = (page - 1) * limit;

    const [results, countResult] = await Promise.all([
      this.db.queryMany<Document>(
        `SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      ),
      this.db.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM documents WHERE user_id = $1',
        [userId],
      ),
    ]);

    return {
      data: results.map((row) => this.mapDocument(row)),
      total: parseInt(countResult?.count || '0', 10),
    };
  }

  async update(id: string, userId: string, dto: UpdateDocumentDto): Promise<Document> {
    await this.findByIdWithAccess(id, userId);

    const assignments = this.buildAssignments(dto);
    const values = [...assignments.values, new Date(), id];

    const result = await this.db.queryOne<Document>(
      `UPDATE documents SET ${assignments.sql}, updated_at = $${assignments.values.length + 1} WHERE id = $${assignments.values.length + 2} RETURNING *`,
      values,
    );

    return this.mapDocument(result!);
  }

  async updateProcessingStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    extractedText?: string,
    pageCount?: number,
  ): Promise<void> {
    const assignments = ['processing_status = $1', 'updated_at = $2'];
    const values: unknown[] = [status, new Date()];
    let paramIndex = 3;

    if (extractedText !== undefined) {
      assignments.push(`extracted_text = $${paramIndex++}`);
      values.push(extractedText);
    }
    if (pageCount !== undefined) {
      assignments.push(`page_count = $${paramIndex++}`);
      values.push(pageCount);
    }

    values.push(id);

    await this.db.query(
      `UPDATE documents SET ${assignments.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );
  }

  async delete(id: string, userId: string): Promise<void> {
    const document = await this.findByIdWithAccess(id, userId);

    try {
      const key = document.fileUrl.split('/').pop();
      if (key) {
        await this.storageService.delete(key);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete file from storage: ${error}`);
    }

    await this.db.query('DELETE FROM documents WHERE id = $1', [id]);
    this.logger.log(`Document deleted: ${id}`);
  }

  async getDownloadUrl(id: string, userId: string): Promise<string> {
    const document = await this.findByIdWithAccess(id, userId);
    const key = document.fileUrl.split('/').pop();
    if (!key) {
      throw new Error('Invalid file URL');
    }
    return this.storageService.getSignedDownloadUrl(key);
  }

  private buildAssignments(dto: UpdateDocumentDto): { sql: string; values: unknown[] } {
    const assignments: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.title !== undefined) {
      assignments.push(`title = $${paramIndex++}`);
      values.push(dto.title);
    }
    if (dto.extractedText !== undefined) {
      assignments.push(`extracted_text = $${paramIndex++}`);
      values.push(dto.extractedText);
    }
    if (dto.pageCount !== undefined) {
      assignments.push(`page_count = $${paramIndex++}`);
      values.push(dto.pageCount);
    }
    if (dto.processingStatus !== undefined) {
      assignments.push(`processing_status = $${paramIndex++}`);
      values.push(dto.processingStatus);
    }

    return { sql: assignments.join(', '), values };
  }

  private mapDocument(row: unknown): Document {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      studySetId: r.study_set_id as string,
      userId: r.user_id as string,
      title: r.title as string,
      fileName: r.file_name as string,
      fileUrl: r.file_url as string,
      fileSize: r.file_size as number,
      mimeType: r.mime_type as string,
      pageCount: r.page_count as number | null,
      extractedText: r.extracted_text as string | null,
      processingStatus: r.processing_status as Document['processingStatus'],
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }
}
