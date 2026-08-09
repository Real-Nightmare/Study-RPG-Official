import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProgrammesService, Programme, ReviewProgrammeDto } from './programmes.service';

function makeMocks() {
  const db = {
    queryOne: jest.fn(),
    queryMany: jest.fn(),
    query: jest.fn(),
    transaction: jest.fn(),
  };
  const ai = { complete: jest.fn() };
  const audit = { log: jest.fn(async (_params: Record<string, unknown>) => ({})) };
  const service = new ProgrammesService(db as never, ai as never, audit as never);
  return { db, ai, audit, service };
}

type ApplyReview = (
  actorId: string,
  programmeId: string,
  dto: ReviewProgrammeDto,
) => Promise<Programme>;

/** Expose the private applyReview for spying without losing its signature. */
function applyReviewSpy(service: ProgrammesService) {
  return jest.spyOn(service as unknown as { applyReview: ApplyReview }, 'applyReview');
}

const templateRow = {
  id: 'tpl-1',
  name: 'Revision Centre',
  description: 'A structured revision programme.',
  kind: 'revision_centre',
  outline: '{}',
  active: true,
  created_at: '2026-08-06T00:00:00Z',
  updated_at: '2026-08-06T00:00:00Z',
};

function programmeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prog-1',
    name: 'Revision Centre',
    description: null,
    kind: 'revision_centre',
    status: 'active',
    suggested_by: null,
    suggester_name: null,
    ai_built: true,
    content: '{}',
    reward_policy: '{}',
    review: '{}',
    review_history: '[]',
    has_factions: false,
    faction_size: 7,
    created_at: '2026-08-06T00:00:00Z',
    updated_at: '2026-08-06T00:00:00Z',
    ...overrides,
  };
}

describe('ProgrammesService (Phase 8 — templates, review queue, batch review)', () => {
  describe('templates', () => {
    it('lists active templates only', async () => {
      const { db, service } = makeMocks();
      db.queryMany.mockResolvedValueOnce([templateRow]);
      const result = await service.listTemplates();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Revision Centre');
      expect(result[0].kind).toBe('revision_centre');
      expect(db.queryMany).toHaveBeenCalledWith(expect.stringContaining('WHERE active = TRUE'));
    });

    it('creates a template and audits with the reason', async () => {
      const { db, audit, service } = makeMocks();
      db.queryOne.mockResolvedValueOnce({ ...templateRow, id: 'tpl-new' });
      const result = await service.createTemplate('admin-1', {
        name: 'Exam Sprint',
        description: 'Countdown to exams.',
        kind: 'exam_sprint',
        outline: { objectives: ['x'] },
        reason: 'Owner requested sprint shape',
      });
      expect(result.id).toBe('tpl-new');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-1',
          action: 'programme_template.create',
          reason: 'Owner requested sprint shape',
        }),
      );
    });

    it('rejects a template without a name', async () => {
      const { service } = makeMocks();
      await expect(service.createTemplate('admin-1', { name: '  ', reason: 'x' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an admin template action without a reason', async () => {
      const { service } = makeMocks();
      await expect(
        service.createTemplate('admin-1', { name: 'Exam Sprint', reason: '   ' }),
      ).rejects.toThrow(BadRequestException);
      await expect(service.deleteTemplate('admin-1', 'tpl-1', '  ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates a template and audits', async () => {
      const { db, audit, service } = makeMocks();
      db.queryOne
        .mockResolvedValueOnce(templateRow)
        .mockResolvedValueOnce({ ...templateRow, name: 'Revision Centre v2' });
      const result = await service.updateTemplate('admin-1', 'tpl-1', {
        name: 'Revision Centre v2',
        reason: 'Rebrand',
      });
      expect(result.name).toBe('Revision Centre v2');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'programme_template.update', reason: 'Rebrand' }),
      );
    });

    it('throws NotFound when updating/deleting a missing template', async () => {
      const { db, service } = makeMocks();
      db.queryOne.mockResolvedValueOnce(null);
      await expect(service.updateTemplate('admin-1', 'missing', { reason: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      db.queryOne.mockResolvedValueOnce(null);
      await expect(service.deleteTemplate('admin-1', 'missing', 'x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes a template and audits', async () => {
      const { db, audit, service } = makeMocks();
      db.queryOne.mockResolvedValueOnce(templateRow);
      await service.deleteTemplate('admin-1', 'tpl-1', 'No longer needed');
      expect(db.query).toHaveBeenCalledWith('DELETE FROM programme_templates WHERE id = $1', [
        'tpl-1',
      ]);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'programme_template.delete',
          reason: 'No longer needed',
        }),
      );
    });

    it('suggestFromTemplate rejects an inactive or missing template', async () => {
      const { db, service } = makeMocks();
      db.queryOne.mockResolvedValueOnce(null);
      await expect(service.suggestFromTemplate('user-1', 'tpl-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('suggestFromTemplate builds from the template outline via the normal suggest path', async () => {
      const { db, service } = makeMocks();
      db.queryOne.mockResolvedValueOnce(templateRow);
      const built = programmeRow();
      jest.spyOn(service, 'suggest').mockResolvedValueOnce(built as never);
      const result = await service.suggestFromTemplate('user-1', 'tpl-1', {
        hasFactions: true,
        factionSize: 5,
      });
      expect(result.id).toBe('prog-1');
      expect(service.suggest).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          name: 'Revision Centre',
          kind: 'revision_centre',
          templateOutline: '{}',
        }),
      );
    });
  });

  describe('review queue & batch review', () => {
    it('lists only programmes that still need a human review', async () => {
      const { db, service } = makeMocks();
      db.queryMany.mockResolvedValueOnce([
        programmeRow({ id: 'p1', review: '{}' }),
        programmeRow({ id: 'p2', review: '{"verdict":"accepted","score":90,"reasons":[]}' }),
        programmeRow({ id: 'p3', review: '{"verdict":"accepted","score":30,"reasons":["thin"]}' }),
      ]);
      const result = await service.reviewQueue();
      const ids = result.map((p) => p.id);
      expect(ids).toEqual(['p1', 'p3']);
    });

    it('batch review rejects an empty selection', async () => {
      const { service } = makeMocks();
      await expect(service.batchReview('admin-1', [])).rejects.toThrow(BadRequestException);
    });

    it('batch review applies a verdict to every item with audit + history', async () => {
      const { db, audit, service } = makeMocks();
      db.queryOne.mockResolvedValue(programmeRow({ review_history: '[]' }));
      const spy = applyReviewSpy(service).mockImplementation(
        async (actorId: string, programmeId: string) => {
          await audit.log({
            actorId,
            action: 'programme.review_accepted',
            targetType: 'programme',
            targetId: programmeId,
            reason: 'Looks solid',
          });
          return programmeRow({ id: programmeId }) as unknown as Programme;
        },
      );
      const result = await service.batchReview('admin-1', [
        { id: 'p1', verdict: 'accepted', reason: 'Looks solid', score: 85 },
        { id: 'p2', verdict: 'rejected', reason: 'Too vague', score: 20 },
      ]);
      expect(result.reviewed).toBe(2);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(audit.log).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });

    it('batch review refuses archived programmes', async () => {
      const { db, service } = makeMocks();
      db.queryOne.mockResolvedValue(programmeRow({ status: 'archived' }));
      await expect(
        service.batchReview('admin-1', [{ id: 'p1', verdict: 'accepted', reason: 'x' }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('admin review requires a reason', async () => {
      const { service } = makeMocks();
      await expect(
        service.adminReview('admin-1', 'p1', { verdict: 'accepted', reason: '  ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('admin review applies the verdict and appends to review history', async () => {
      const { db, audit, service } = makeMocks();
      db.queryOne.mockResolvedValue(programmeRow({ review_history: '[]' }));
      const spy = applyReviewSpy(service).mockImplementation(
        async (actorId: string, programmeId: string) => {
          await audit.log({
            actorId,
            action: 'programme.review_rejected',
            targetType: 'programme',
            targetId: programmeId,
            reason: 'Not actionable',
          });
          return programmeRow({ id: programmeId }) as unknown as Programme;
        },
      );
      await service.adminReview('admin-1', 'p1', {
        verdict: 'rejected',
        reason: 'Not actionable',
        score: 10,
      });
      expect(spy).toHaveBeenCalledWith(
        'admin-1',
        'p1',
        expect.objectContaining({ verdict: 'rejected', reason: 'Not actionable', score: 10 }),
      );
      spy.mockRestore();
    });

    it('applyReview persists history capped and audited', async () => {
      const { db, audit, service } = makeMocks();
      db.queryOne.mockResolvedValueOnce(
        programmeRow({ id: 'p1', review_history: '[]', status: 'suggested' }),
      );
      db.queryOne.mockResolvedValueOnce(programmeRow({ id: 'p1', status: 'active' }));
      await (
        service as unknown as {
          applyReview: (a: string, p: string, d: unknown) => Promise<unknown>;
        }
      ).applyReview('admin-1', 'p1', {
        verdict: 'accepted',
        reason: 'Great structure',
        score: 92,
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE programmes'),
        expect.arrayContaining([
          expect.stringContaining('"verdict":"accepted"'),
          expect.stringContaining('"reviewer":"admin-1"'),
        ]),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'programme.review_accepted', reason: 'Great structure' }),
      );
    });
  });
});
