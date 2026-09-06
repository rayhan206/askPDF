import { Queue, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import {
  QUEUE_NAMES,
  documentDeleteJobSchema,
  documentIngestJobSchema,
  progressEventSchema,
  type DocumentDeleteJob,
  type DocumentIngestJob,
  type ProgressEvent,
} from "@askpdf/contracts";

export interface QueueConfiguration {
  redisUrl: string;
  keyPrefix: string;
  attempts: number;
  backoffBaseMs: number;
}

export function createRedisConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
}

export function buildIngestJobId(documentId: string, processingVersion: number): string {
  return `${documentId}-${processingVersion}`;
}

export function buildDeleteJobId(documentId: string): string {
  return `delete-${documentId}`;
}

export class AskPdfQueues {
  readonly connection: Redis;
  readonly ingest: Queue<DocumentIngestJob>;
  readonly deletion: Queue<DocumentDeleteJob>;
  private readonly jobOptions: JobsOptions;
  private readonly keyPrefix: string;

  constructor(configuration: QueueConfiguration) {
    this.keyPrefix = configuration.keyPrefix;
    this.connection = createRedisConnection(configuration.redisUrl);
    this.ingest = new Queue(QUEUE_NAMES.documentIngest, {
      connection: this.connection,
      prefix: configuration.keyPrefix,
    });
    this.deletion = new Queue(QUEUE_NAMES.documentDelete, {
      connection: this.connection,
      prefix: configuration.keyPrefix,
    });
    this.jobOptions = {
      attempts: configuration.attempts,
      backoff: { type: "exponential", delay: configuration.backoffBaseMs },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    };
  }

  async enqueueIngest(payload: DocumentIngestJob): Promise<string> {
    const validated = documentIngestJobSchema.parse(payload);
    const jobId = buildIngestJobId(validated.documentId, validated.processingVersion);
    await this.ingest.add("document.ingest", validated, { ...this.jobOptions, jobId });
    return jobId;
  }

  async enqueueDelete(payload: DocumentDeleteJob): Promise<string> {
    const validated = documentDeleteJobSchema.parse(payload);
    const jobId = buildDeleteJobId(validated.documentId);
    await this.deletion.add("document.delete", validated, { ...this.jobOptions, jobId });
    return jobId;
  }

  async ping(): Promise<void> {
    await this.connection.ping();
  }

  async consumeRateLimit(
    scope: string,
    subjectHash: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
    const script = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
      local ttl = redis.call('TTL', KEYS[1])
      return {current, ttl}
    `;
    const result: unknown = await this.connection.eval(
      script,
      1,
      `${this.keyPrefix}:rate:${scope}:${subjectHash}`,
      String(windowSeconds),
    );
    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      typeof result[0] !== "number" ||
      typeof result[1] !== "number"
    )
      throw new Error("Redis returned an invalid rate-limit response");
    return {
      allowed: result[0] <= limit,
      remaining: Math.max(0, limit - result[0]),
      retryAfterSeconds: Math.max(1, result[1]),
    };
  }

  async close(): Promise<void> {
    await Promise.all([this.ingest.close(), this.deletion.close()]);
    this.connection.disconnect();
  }
}

export class ProgressBus {
  private readonly publisher: Redis;
  private readonly keyPrefix: string;

  constructor(redisUrl: string, keyPrefix: string) {
    this.publisher = createRedisConnection(redisUrl);
    this.keyPrefix = keyPrefix;
  }

  channel(documentId: string): string {
    return `${this.keyPrefix}:document:${documentId}:progress`;
  }

  async publish(event: ProgressEvent): Promise<void> {
    const validated = progressEventSchema.parse(event);
    await this.publisher.publish(this.channel(validated.documentId), JSON.stringify(validated));
  }

  async close(): Promise<void> {
    this.publisher.disconnect();
  }
}
