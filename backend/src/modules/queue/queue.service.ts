import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

export type JobProcessor<T = unknown, R = unknown> = (job: Job<T>) => Promise<R>;

export interface QueueConfig {
  name: string;
  processor: JobProcessor;
  concurrency?: number;
}

/**
 * Central BullMQ facade. Owns the Redis connection, lazily instantiates
 * queues, registers workers, and exposes job/queue administration helpers.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection: IORedis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.connection = new IORedis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: null,
    });

    this.connection.on('error', (err) => {
      this.logger.error('BullMQ Redis connection error', err);
    });

    this.logger.log('BullMQ connection initialized');
  }

  async onModuleDestroy(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const events of this.queueEvents.values()) {
      await events.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    await this.connection.quit();
    this.logger.log('BullMQ connections closed');
  }

  /** Returns the named queue, creating it on first use. */
  getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection });
      this.queues.set(name, queue);
      this.logger.debug(`Queue ${name} created`);
    }
    return queue;
  }

  /** Registers a processor for a queue (idempotent per queue name). */
  registerWorker<T = unknown, R = unknown>(
    queueName: string,
    processor: JobProcessor<T, R>,
    concurrency = 1,
  ): Worker<T, R> {
    const existing = this.workers.get(queueName);
    if (existing) {
      return existing as Worker<T, R>;
    }

    const worker = new Worker<T, R>(queueName, processor, {
      connection: this.connection,
      concurrency,
    });

    worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} in ${queueName} completed`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} in ${queueName} failed: ${err.message}`);
    });

    this.workers.set(queueName, worker);
    this.logger.log(`Worker registered for queue ${queueName} with concurrency ${concurrency}`);

    return worker;
  }

  /** Enqueues a single job with sensible retention defaults. */
  async addJob<T = unknown>(
    queueName: string,
    name: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(name, data, {
      removeOnComplete: 100,
      removeOnFail: 1000,
      ...options,
    });
    this.logger.debug(`Job ${job.id} added to ${queueName}`);
    return job;
  }

  /** Enqueues many jobs in one round-trip. */
  async addBulkJobs<T = unknown>(
    queueName: string,
    jobs: Array<{ name: string; data: T; options?: JobsOptions }>,
  ): Promise<Job<T>[]> {
    const queue = this.getQueue(queueName);
    const enqueued = await queue.addBulk(
      jobs.map((job) => ({
        name: job.name,
        data: job.data,
        opts: {
          removeOnComplete: 100,
          removeOnFail: 1000,
          ...job.options,
        },
      })),
    );
    this.logger.debug(`${enqueued.length} jobs added to ${queueName}`);
    return enqueued;
  }

  async getJob<T = unknown>(queueName: string, jobId: string): Promise<Job<T> | undefined> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId) as Promise<Job<T> | undefined>;
  }

  async getJobState(queueName: string, jobId: string): Promise<string | null> {
    const job = await this.getJob(queueName, jobId);
    return job ? job.getState() : null;
  }

  async getJobProgress(queueName: string, jobId: string): Promise<number | null> {
    const job = await this.getJob(queueName, jobId);
    return job ? (job.progress as number) : null;
  }

  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      this.logger.debug(`Job ${jobId} removed from ${queueName}`);
    }
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    this.logger.log(`Queue ${queueName} paused`);
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    this.logger.log(`Queue ${queueName} resumed`);
  }

  async drainQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.drain();
    this.logger.log(`Queue ${queueName} drained`);
  }

  /**
   * Attaches event listeners to a queue's event stream. Safe to call multiple
   * times — the underlying QueueEvents instance is created once per queue.
   */
  subscribeToEvents(
    queueName: string,
    callbacks: {
      onCompleted?: (jobId: string, result: unknown) => void;
      onFailed?: (jobId: string, error: Error) => void;
      onProgress?: (jobId: string, progress: number) => void;
    },
  ): QueueEvents {
    let events = this.queueEvents.get(queueName);
    if (!events) {
      events = new QueueEvents(queueName, { connection: this.connection });
      this.queueEvents.set(queueName, events);
    }

    if (callbacks.onCompleted) {
      events.on('completed', ({ jobId, returnvalue }) => {
        callbacks.onCompleted!(jobId, returnvalue);
      });
    }

    if (callbacks.onFailed) {
      events.on('failed', ({ jobId, failedReason }) => {
        callbacks.onFailed!(jobId, new Error(failedReason));
      });
    }

    if (callbacks.onProgress) {
      events.on('progress', ({ jobId, data }) => {
        callbacks.onProgress!(jobId, data as number);
      });
    }

    return events;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.connection.ping();
      return true;
    } catch {
      return false;
    }
  }
}
