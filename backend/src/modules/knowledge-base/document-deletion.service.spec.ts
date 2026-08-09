import { ConflictException } from '@nestjs/common';
import { DocumentDeletionService } from './document-deletion.service';
import { DatabaseService } from '../database/database.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { CollectionResolver } from '../qdrant/collection-resolver.service';

describe('DocumentDeletionService', () => {
  let service: DocumentDeletionService;
  let db: { queryOne: jest.Mock; query: jest.Mock; queryMany: jest.Mock };
  let qdrant: { deleteByFilter: jest.Mock };
  let resolver: { activeCollectionName: jest.Mock };

  const doc = { id: 'doc-1', ingestion_state: 'ready', last_error: null };

  beforeEach(() => {
    db = {
      queryOne: jest.fn().mockResolvedValue(doc),
      query: jest.fn().mockResolvedValue({}),
      queryMany: jest.fn().mockResolvedValue([]),
    };
    qdrant = { deleteByFilter: jest.fn().mockResolvedValue(undefined) };
    resolver = { activeCollectionName: jest.fn().mockResolvedValue('knowledge_base_v2') };
    service = new DocumentDeletionService(
      db as unknown as DatabaseService,
      qdrant as unknown as QdrantService,
      resolver as unknown as CollectionResolver,
    );
  });

  it('deletes chunks, removes vectors and marks the document deleted', async () => {
    await service.deleteDocument('kb-1', 'doc-1');

    // transitions deleting → deleted (state passed as a parameter)
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE documents SET ingestion_state'),
      ['deleting', 'doc-1'],
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE documents SET ingestion_state'),
      ['deleted', 'doc-1'],
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM kb_chunks'),
      expect.arrayContaining(['kb-1', 'doc-1']),
    );
    expect(qdrant.deleteByFilter).toHaveBeenCalledWith(
      'knowledge_base_v2',
      expect.objectContaining({
        must: expect.arrayContaining([
          { key: 'knowledgeBaseId', match: { value: 'kb-1' } },
          { key: 'documentId', match: { value: 'doc-1' } },
        ]),
      }),
    );
  });

  it('removes the row when removeRow is requested', async () => {
    await service.deleteDocument('kb-1', 'doc-1', { removeRow: true });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM documents WHERE id = $1'),
      ['doc-1'],
    );
  });

  it('refuses deletion while ingestion is mid-flight', async () => {
    db.queryOne.mockResolvedValue({ id: 'doc-1', ingestion_state: 'embedding', last_error: null });

    await expect(service.deleteDocument('kb-1', 'doc-1')).rejects.toThrow(ConflictException);
  });

  it('rolls back to failed with the error recorded when chunk removal fails', async () => {
    db.query.mockImplementation(async (sql: string) => {
      if (sql.includes('DELETE FROM kb_chunks')) {
        throw new Error('chunk delete failed');
      }
      return {};
    });

    await expect(service.deleteDocument('kb-1', 'doc-1')).rejects.toThrow('chunk delete failed');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('ingestion_state = $1, last_error = $2'),
      expect.arrayContaining(['failed', 'doc-1', expect.stringContaining('chunk delete failed')]),
    );
  });

  it('cleans up a whole knowledge base', async () => {
    await service.deleteAllForKnowledgeBase('kb-1');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM kb_chunks WHERE knowledge_base_id = $1'),
      ['kb-1'],
    );
    expect(qdrant.deleteByFilter).toHaveBeenCalledWith(
      'knowledge_base_v2',
      expect.objectContaining({ must: [{ key: 'knowledgeBaseId', match: { value: 'kb-1' } }] }),
    );
  });
});
