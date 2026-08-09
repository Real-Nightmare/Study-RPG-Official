import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LearningPathsService } from './learning-paths.service';

function makeMocks() {
  const db = {
    queryOne: jest.fn(),
    queryMany: jest.fn(),
    query: jest.fn(),
  };
  const ai = { complete: jest.fn(), completeJson: jest.fn() };
  const programmes = {
    findOne: jest.fn(),
  };
  const service = new LearningPathsService(db as never, ai as never, programmes as never);
  return { db, ai, programmes, service };
}

const pathRow = {
  id: 'path-1',
  user_id: 'user-1',
  title: 'Revision Centre — Personal Path',
  description: 'A plan for this student.',
  subject: 'revision_centre',
  difficulty: 'intermediate',
  estimated_hours: 20,
  steps: '[]',
  progress: 0,
  programme_id: 'prog-1',
  programme_name: 'Revision Centre',
  review: '{"verdict":"accepted","score":85,"reasons":[]}',
  needs_regeneration: false,
  created_at: '2026-08-06T00:00:00Z',
  updated_at: '2026-08-06T00:00:00Z',
};

function activeProgramme() {
  return {
    id: 'prog-1',
    name: 'Revision Centre',
    description: 'A structured revision programme.',
    kind: 'revision_centre',
    status: 'active',
    content: { objectives: ['Master quadratic equations'], milestones: ['Pass the mid-term quiz'] },
    rewardPolicy: { xpPerMilestone: 150 },
  };
}

describe('LearningPathsService (Phase 8 — programme-to-path generation & lifecycle)', () => {
  describe('create', () => {
    it('inserts a path with default beginner difficulty and empty steps', async () => {
      const { db, service } = makeMocks();
      db.queryOne.mockResolvedValueOnce(pathRow);
      const result = await service.create('user-1', {
        title: 'Biology Basics',
        subject: 'biology',
      });
      expect(result.title).toBe('Revision Centre — Personal Path');
      expect(db.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO learning_paths'),
        expect.arrayContaining(['user-1', 'Biology Basics', 'biology', 'beginner']),
      );
    });
  });

  describe('generateFromProgramme', () => {
    it('rejects a programme that is not active', async () => {
      const { programmes, service } = makeMocks();
      programmes.findOne.mockResolvedValueOnce({ ...activeProgramme(), status: 'suggested' });
      await expect(service.generateFromProgramme('user-1', 'prog-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(programmes.findOne).toHaveBeenCalledWith('prog-1', 'user-1');
    });

    it('rejects when the programme does not exist', async () => {
      const { programmes, service } = makeMocks();
      programmes.findOne.mockResolvedValueOnce(null);
      await expect(service.generateFromProgramme('user-1', 'prog-1')).rejects.toBeInstanceOf(Error);
    });

    it('builds steps from the AI response, self-reviews, and links the programme', async () => {
      const { db, ai, programmes, service } = makeMocks();
      programmes.findOne.mockResolvedValueOnce(activeProgramme());
      ai.completeJson
        .mockResolvedValueOnce({
          title: 'Personal Revision Path',
          description: 'Four weeks to mastery.',
          estimatedHours: 20,
          steps: [
            {
              order: 1,
              title: 'Diagnostic quiz',
              description: 'Find the gaps.',
              type: 'quiz',
              estimatedMinutes: 45,
            },
            {
              order: 2,
              title: 'Practice puzzles',
              description: 'Drill the weak spots.',
              type: 'practice',
              estimatedMinutes: 90,
            },
          ],
        })
        .mockResolvedValueOnce({ verdict: 'accepted', score: 85, reasons: ['Coherent plan'] });
      db.query.mockResolvedValueOnce(undefined);
      db.queryOne.mockResolvedValueOnce(pathRow);

      const result = await service.generateFromProgramme('user-1', 'prog-1');

      expect(result.programmeId).toBe('prog-1');
      expect(result.programmeName).toBe('Revision Centre');
      expect(result.needsRegeneration).toBe(false);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO learning_paths'),
        expect.arrayContaining(['user-1', 'prog-1']),
      );
      const insertParams = db.query.mock.calls[0][1];
      const steps = JSON.parse(insertParams[6]);
      expect(steps).toHaveLength(2);
      expect(steps[0].type).toBe('quiz');
      expect(steps[0].resourceType).toBeNull();
      expect(insertParams[7]).toBe('prog-1');
    });

    it('flags needsRegeneration when the self-review score is below 60', async () => {
      const { db, ai, programmes, service } = makeMocks();
      programmes.findOne.mockResolvedValueOnce(activeProgramme());
      ai.completeJson
        .mockResolvedValueOnce({
          title: 'Weak Path',
          description: 'Rushed.',
          estimatedHours: 10,
          steps: [
            {
              order: 1,
              title: 'Flashcards',
              description: 'Basics.',
              type: 'study',
              estimatedMinutes: 30,
            },
          ],
        })
        .mockResolvedValueOnce({ verdict: 'rejected', score: 40, reasons: ['Too vague'] });
      db.query.mockResolvedValueOnce(undefined);
      db.queryOne.mockResolvedValueOnce({ ...pathRow, needs_regeneration: true });

      const result = await service.generateFromProgramme('user-1', 'prog-1');
      expect(result.needsRegeneration).toBe(true);
      const insertParams = db.query.mock.calls[0][1];
      expect(insertParams[9]).toBe(true);
    });

    it('throws when the AI returns no steps', async () => {
      const { ai, programmes, service } = makeMocks();
      programmes.findOne.mockResolvedValueOnce(activeProgramme());
      ai.completeJson.mockResolvedValueOnce({ title: 'Empty', description: '', steps: [] });
      await expect(service.generateFromProgramme('user-1', 'prog-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('falls back gracefully when the self-review fails', async () => {
      const { db, ai, programmes, service } = makeMocks();
      programmes.findOne.mockResolvedValueOnce(activeProgramme());
      ai.completeJson
        .mockResolvedValueOnce({
          title: 'Fallback Path',
          description: 'ok',
          estimatedHours: 12,
          steps: [
            {
              order: 1,
              title: 'Study',
              description: 'Read.',
              type: 'study',
              estimatedMinutes: 30,
            },
          ],
        })
        .mockRejectedValueOnce(new Error('AI review timeout'));
      db.query.mockResolvedValueOnce(undefined);
      db.queryOne.mockResolvedValueOnce(pathRow);

      const result = await service.generateFromProgramme('user-1', 'prog-1');
      expect(result.title).toBe('Revision Centre — Personal Path');
      const review = JSON.parse(db.query.mock.calls[0][1][8]);
      expect(review.verdict).toBe('accepted');
      expect(review.score).toBeNull();
    });
  });

  describe('completeStep', () => {
    it('throws NotFound for a missing path', async () => {
      const { db, service } = makeMocks();
      db.queryOne.mockResolvedValueOnce(null);
      await expect(service.completeStep('path-1', 'step-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws Forbidden when the path belongs to another user', async () => {
      const { db, service } = makeMocks();
      db.queryOne.mockResolvedValueOnce({ ...pathRow, user_id: 'user-2' });
      await expect(service.completeStep('path-1', 'step-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('marks the step complete and recalculates progress', async () => {
      const { db, service } = makeMocks();
      const row = {
        ...pathRow,
        steps: JSON.stringify([
          {
            id: 'step-1',
            order: 1,
            title: 'A',
            description: 'd',
            type: 'study',
            resourceId: null,
            resourceType: null,
            estimatedMinutes: 30,
            isCompleted: false,
            completedAt: null,
          },
          {
            id: 'step-2',
            order: 2,
            title: 'B',
            description: 'd',
            type: 'quiz',
            resourceId: null,
            resourceType: null,
            estimatedMinutes: 30,
            isCompleted: false,
            completedAt: null,
          },
        ]),
      };
      db.queryOne.mockResolvedValueOnce(row).mockResolvedValueOnce({
        ...row,
        progress: 50,
        steps: JSON.stringify([
          {
            id: 'step-1',
            order: 1,
            title: 'A',
            description: 'd',
            type: 'study',
            resourceId: null,
            resourceType: null,
            estimatedMinutes: 30,
            isCompleted: true,
            completedAt: '2026-08-06T00:00:00Z',
          },
          {
            id: 'step-2',
            order: 2,
            title: 'B',
            description: 'd',
            type: 'quiz',
            resourceId: null,
            resourceType: null,
            estimatedMinutes: 30,
            isCompleted: false,
            completedAt: null,
          },
        ]),
      });
      db.query.mockResolvedValueOnce(undefined);

      const result = await service.completeStep('path-1', 'step-1', 'user-1');

      expect(result.progress).toBe(50);
      const update = db.query.mock.calls[0];
      expect(update[0]).toContain('UPDATE learning_paths');
      const steps = JSON.parse(update[1][0]);
      expect(steps[0].isCompleted).toBe(true);
      expect(steps[1].isCompleted).toBe(false);
      expect(update[1][1]).toBe(50);
    });
  });

  describe('delete', () => {
    it('deletes the path when authorized', async () => {
      const { db, service } = makeMocks();
      db.queryOne.mockResolvedValueOnce(pathRow);
      db.query.mockResolvedValueOnce(undefined);
      await service.delete('path-1', 'user-1');
      expect(db.query).toHaveBeenCalledWith('DELETE FROM learning_paths WHERE id = $1', ['path-1']);
    });

    it('throws Forbidden for another user', async () => {
      const { db, service } = makeMocks();
      db.queryOne.mockResolvedValueOnce({ ...pathRow, user_id: 'user-2' });
      await expect(service.delete('path-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
