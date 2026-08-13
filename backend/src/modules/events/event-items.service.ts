import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * Event items (PDF Phase 7 §28–§29): Abstracted Errors, Abstracted Fragments
 * and Extinction Sigils. Counted inventory with atomic grant/consume helpers
 * that can run inside a caller-owned transaction (client) or standalone.
 */
@Injectable()
export class EventItemsService {
  constructor(private readonly db: DatabaseService) {}

  private async itemIdBySlug(slug: string): Promise<string | null> {
    const row = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM event_items WHERE slug = $1',
      [slug],
    );
    return row?.id ?? null;
  }

  async grantItemWithClient(
    client: import('pg').PoolClient,
    userId: string,
    slug: string,
    quantity: number,
  ): Promise<void> {
    const id = await this.itemIdBySlug(slug);
    if (!id) {
      throw new BadRequestException(`Unknown event item: ${slug}`);
    }
    await client.query(
      `INSERT INTO user_event_items (user_id, item_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, item_id) DO UPDATE SET
         quantity = user_event_items.quantity + EXCLUDED.quantity,
         updated_at = NOW()`,
      [userId, id, quantity],
    );
  }

  async consumeItemWithClient(
    client: import('pg').PoolClient,
    userId: string,
    slug: string,
    quantity: number,
  ): Promise<void> {
    const id = await this.itemIdBySlug(slug);
    if (!id) {
      throw new BadRequestException(`Unknown event item: ${slug}`);
    }
    const updated = await client.query<{ quantity: number }>(
      `UPDATE user_event_items SET quantity = quantity - $3, updated_at = NOW()
       WHERE user_id = $1 AND item_id = $2 AND quantity >= $3
       RETURNING quantity`,
      [userId, id, quantity],
    );
    if (updated.rowCount === 0) {
      throw new BadRequestException(`Not enough ${slug} — need ${quantity}`);
    }
  }

  async grantItem(userId: string, slug: string, quantity: number): Promise<void> {
    return this.db.transaction((client) =>
      this.grantItemWithClient(client as import('pg').PoolClient, userId, slug, quantity),
    );
  }

  async quantityOf(userId: string, slug: string): Promise<number> {
    const row = await this.db.queryOne<{ quantity: number }>(
      `SELECT COALESCE(uei.quantity, 0)::int AS quantity
       FROM event_items ei
       LEFT JOIN user_event_items uei ON uei.item_id = ei.id AND uei.user_id = $2
       WHERE ei.slug = $1`,
      [slug, userId],
    );
    return row ? Number(row.quantity) : 0;
  }

  async getItems(userId: string): Promise<
    Array<{
      slug: string;
      name: string;
      description: string | null;
      tradable: boolean;
      quantity: number;
    }>
  > {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT ei.slug, ei.name, ei.description, ei.tradable, COALESCE(uei.quantity, 0)::int AS quantity
       FROM event_items ei
       LEFT JOIN user_event_items uei ON uei.item_id = ei.id AND uei.user_id = $1
       ORDER BY ei.slug`,
      [userId],
    );
    return rows.map((r) => ({
      slug: r.slug as string,
      name: r.name as string,
      description: (r.description ?? null) as string | null,
      tradable: Boolean(r.tradable),
      quantity: Number(r.quantity ?? 0),
    }));
  }
}
