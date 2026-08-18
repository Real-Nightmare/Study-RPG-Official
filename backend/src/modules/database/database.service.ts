import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * Owns the PostgreSQL connection pool and exposes the query helpers used by
 * every repository-style service across the API. Raw SQL only — no ORM.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({
      host: this.configService.get<string>('DATABASE_HOST'),
      port: this.configService.get<number>('DATABASE_PORT'),
      user: this.configService.get<string>('DATABASE_USER'),
      password: this.configService.get<string>('DATABASE_PASSWORD'),
      database: this.configService.get<string>('DATABASE_NAME'),
      min: this.configService.get<number>('DATABASE_POOL_MIN', 2),
      max: this.configService.get<number>('DATABASE_POOL_MAX', 10),
      keepAlive: true,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 30000,
    });

    // A dropped idle connection must never crash the process.
    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle client', err);
    });

    await this.probeConnection();
  }

  private async probeConnection(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    this.logger.log('Database connection pool closed');
  }

  /** Runs a parameterised statement and returns the full pg result. */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const started = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      this.logger.debug(`Query executed in ${Date.now() - started}ms: ${text.slice(0, 100)}`);
      return result;
    } catch (error) {
      this.logger.error(`Query failed: ${text}`, error);
      throw error;
    }
  }

  /** Runs a statement and returns only the first row (or null when none). */
  async queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T | null> {
    const { rows } = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  /** Runs a statement and returns all rows. */
  async queryMany<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const { rows } = await this.query<T>(text, params);
    return rows;
  }

  /** Borrows a dedicated client (caller releases it). */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Runs `callback` inside a transaction. Commits on success, rolls back on
   * failure, and always returns the borrowed client to the pool.
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const outcome = await callback(client);
      await client.query('COMMIT');
      return outcome;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /** Cheap liveness probe used by health endpoints. */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
