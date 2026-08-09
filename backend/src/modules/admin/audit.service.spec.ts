import { AuditService, LogAuditParams } from './audit.service';

function makeDb() {
  const rows: unknown[] = [];
  const queryOne = jest.fn(async (_text: string, params?: unknown[]) => {
    if (params && params.length > 0 && typeof params[5] === 'string') {
      // insert path: return the inserted row
      const row = {
        id: params[0],
        actor_id: params[1],
        action: params[2],
        target_type: params[3],
        target_id: params[4],
        reason: params[5],
        details: params[6],
        created_at: new Date().toISOString(),
      };
      rows.push(row);
      return row;
    }
    return null;
  });
  return {
    rows,
    queryOne: queryOne as jest.Mock<Promise<unknown>>,
    queryMany: jest.fn(async () => []) as jest.Mock<Promise<unknown[]>>,
  };
}

describe('AuditService', () => {
  let service: AuditService;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    service = new AuditService(db as never);
  });

  it('writes an audit entry when a reason is provided', async () => {
    const entry = await service.log({
      actorId: 'admin-1',
      action: 'admin.create_user',
      targetType: 'user',
      targetId: 'user-9',
      reason: 'New teacher onboarded for Grade 9',
    });

    expect(entry.action).toBe('admin.create_user');
    expect(entry.reason).toBe('New teacher onboarded for Grade 9');
    expect(db.rows).toHaveLength(1);
  });

  it('trims and rejects empty reasons — every admin action needs a reason', async () => {
    await expect(
      service.log({
        actorId: 'admin-1',
        action: 'admin.create_user',
        reason: '   ',
      }),
    ).rejects.toThrow('Audit log requires a reason');
    expect(db.rows).toHaveLength(0);
  });

  it('rejects missing reasons entirely', async () => {
    const params = {
      actorId: 'admin-1',
      action: 'admin.delete_user',
    } as LogAuditParams;
    await expect(service.log(params)).rejects.toThrow('Audit log requires a reason');
  });

  it('lists entries with filters', async () => {
    db.queryMany.mockResolvedValueOnce([
      {
        id: '1',
        actor_id: 'admin-1',
        action: 'admin.seed',
        target_type: null,
        target_id: null,
        reason: 'bootstrap',
        details: '{}',
        created_at: new Date().toISOString(),
        actor_name: 'Nightmare',
      },
    ]);
    db.queryOne.mockResolvedValueOnce({ count: '1' } as never);

    const result = await service.list({ action: 'admin.seed' });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(db.queryMany).toHaveBeenCalled();
  });
});
