import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AcademicsService } from './academics.service';
import { DatabaseService } from '../database/database.service';

describe('AcademicsService', () => {
  let service: AcademicsService;
  let db: {
    query: jest.Mock;
    queryOne: jest.Mock;
    queryMany: jest.Mock;
    transaction: jest.Mock;
  };

  const userId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    db = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      queryOne: jest.fn().mockResolvedValue(null),
      queryMany: jest.fn().mockResolvedValue([]),
      transaction: jest.fn().mockImplementation(async (cb) => {
        const client = {
          query: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return cb(client);
      }),
    };
    service = new AcademicsService(db as unknown as DatabaseService);
  });

  describe('getStructure', () => {
    it('seeds the CBSE Grade 9 preset when the user has no subjects', async () => {
      db.queryOne.mockImplementation(async (text: string) => {
        if (text.includes('SELECT COUNT')) return { count: '0' };
        if (text.includes('FROM academic_profiles')) return null;
        return null;
      });

      const structure = await service.getStructure(userId);

      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(structure.subjects).toHaveLength(0);
    });

    it('does not seed again when subjects already exist', async () => {
      db.queryOne.mockImplementation(async (text: string) => {
        if (text.includes('SELECT COUNT')) return { count: '6' };
        return null;
      });

      await service.getStructure(userId);

      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('returns the nested subject → chapter → topic tree', async () => {
      db.queryOne.mockImplementation(async (text: string) => {
        if (text.includes('SELECT COUNT')) return { count: '1' };
        if (text.includes('FROM academic_profiles')) {
          return {
            user_id: userId,
            country: 'India',
            board: 'CBSE',
            school: null,
            grade: '9',
            academic_year: '2026-27',
          };
        }
        return null;
      });
      db.queryMany.mockImplementation(async (text: string) => {
        if (text.includes('FROM subjects')) {
          return [
            {
              id: 's1',
              user_id: userId,
              name: 'Mathematics',
              programme: null,
              color: 'indigo',
              icon: 'calculator',
              sort_order: 0,
            },
          ];
        }
        if (text.includes('FROM chapters')) {
          return [
            {
              id: 'c1',
              subject_id: 's1',
              user_id: userId,
              name: 'Number Systems',
              description: null,
              order_index: 0,
            },
          ];
        }
        if (text.includes('FROM topics')) {
          return [
            {
              id: 't1',
              chapter_id: 'c1',
              user_id: userId,
              name: 'Irrational numbers',
              learning_objective: 'Represent real numbers.',
              order_index: 0,
            },
          ];
        }
        return [];
      });

      const structure = await service.getStructure(userId);

      expect(structure.profile?.board).toBe('CBSE');
      expect(structure.subjects).toHaveLength(1);
      expect(structure.subjects[0].chapters).toHaveLength(1);
      expect(structure.subjects[0].chapters[0].topics[0].name).toBe('Irrational numbers');
      expect(structure.subjects[0].chapters[0].topics[0].learningObjective).toBe(
        'Represent real numbers.',
      );
    });
  });

  describe('createSubject', () => {
    it('inserts a subject and returns camelCase fields', async () => {
      db.queryOne.mockResolvedValue({
        id: 's1',
        user_id: userId,
        name: 'Physics',
        programme: null,
        color: 'blue',
        icon: null,
        sort_order: 0,
      });

      const subject = await service.createSubject(userId, { name: 'Physics', color: 'blue' });

      expect(db.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subjects'),
        expect.arrayContaining([userId, 'Physics', null, 'blue', null, 0]),
      );
      expect(subject).toMatchObject({ id: 's1', name: 'Physics', color: 'blue', sortOrder: 0 });
    });

    it('throws ConflictException on a duplicate name', async () => {
      db.queryOne.mockRejectedValue({ code: '23505' });

      await expect(service.createSubject(userId, { name: 'Physics' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('deleteSubject', () => {
    it('throws NotFoundException when the subject does not exist', async () => {
      db.queryOne.mockResolvedValue(null);

      await expect(service.deleteSubject(userId, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the subject belongs to another user', async () => {
      db.queryOne.mockResolvedValue({ user_id: '22222222-2222-2222-2222-222222222222' });

      await expect(service.deleteSubject(userId, 's1')).rejects.toThrow(ForbiddenException);
    });

    it('deletes the subject when owned by the user', async () => {
      db.queryOne.mockResolvedValue({ user_id: userId });

      await service.deleteSubject(userId, 's1');

      expect(db.query).toHaveBeenCalledWith('DELETE FROM subjects WHERE id = $1', ['s1']);
    });
  });

  describe('addPortion', () => {
    it('throws ConflictException when the chapter is already in the portion', async () => {
      db.queryOne
        .mockResolvedValueOnce({ user_id: userId }) // assertOwned('exams')
        .mockResolvedValueOnce({ user_id: userId }) // assertOwned('chapters')
        .mockRejectedValueOnce({ code: '23505' }); // duplicate insert

      await expect(
        service.addPortion(userId, 'e1', { chapterId: 'c1', weight: 1 }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
