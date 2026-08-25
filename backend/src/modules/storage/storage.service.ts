import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import { RestStorageProvider } from './providers/rest-storage.provider';
import { SupabaseStorageProvider } from './providers/supabase-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { AppwriteStorageProvider } from './providers/appwrite-storage.provider';

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  folder?: string;
}

export interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

/**
 * Object storage adapter behind one interface.
 *
 * Provider selection (`STORAGE_PROVIDER`, owner policy T3 — storage is the
 * ONE area where external SaaS is allowed, and only free/no-credit-card
 * options):
 *   - `minio`      — DEFAULT for docker/self-host: the compose stack runs a
 *                    local MinIO; zero accounts, unlimited disk. S3 API.
 *   - `r2`         — Cloudflare R2 (needs R2_* credentials).
 *   - `supabase`   — Supabase Storage REST (1 GB free, no card).
 *   - `cloudinary` — Cloudinary (~25 GB/mo free, no card; good for images).
 *   - `appwrite`   — Appwrite Storage REST (2 GB free, no card).
 *
 * S3-compatible providers use the AWS SDK client directly; the three REST
 * providers implement the upload/download/delete/public-URL surface behind
 * the same public methods (operations they cannot honour throw a clear
 * error instead of pretending). Switching provider is purely an environment
 * change — no code changes anywhere else.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;
  private provider: string;
  /** Non-S3 provider delegation (supabase | cloudinary | appwrite). */
  private restProvider: RestStorageProvider | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const configured = (this.configService.get<string>('STORAGE_PROVIDER') || '').toLowerCase();
    const hasR2 = !!this.configService.get<string>('R2_ACCOUNT_ID');
    // Docker default is minio; bare-metal default stays r2 when R2 is set up.
    this.provider = configured || (hasR2 ? 'r2' : 'minio');
    this.restProvider = null;

    if (this.provider === 'minio') {
      const endpoint = (
        this.configService.get<string>('MINIO_ENDPOINT') || 'http://localhost:9000'
      ).replace(/\/$/, '');
      this.bucket = this.configService.get<string>('MINIO_BUCKET', 'studyrpg-uploads');
      this.publicUrl =
        this.configService.get<string>('MINIO_PUBLIC_URL', '') || `${endpoint}/${this.bucket}`;
      // MinIO serves buckets under the path — path-style addressing is mandatory.
      this.client = new S3Client({
        region: this.configService.get<string>('MINIO_REGION', 'us-east-1'),
        endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.configService.get<string>('MINIO_ACCESS_KEY', ''),
          secretAccessKey: this.configService.get<string>('MINIO_SECRET_KEY', ''),
        },
      });
      this.logger.log(
        `MinIO storage client initialized - Endpoint: ${endpoint}, Bucket: ${this.bucket}`,
      );
    } else if (this.provider === 'r2') {
      const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
      const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
      this.bucket = this.configService.get<string>('R2_BUCKET_NAME', 'study_rpg');
      this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL', '');

      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: accessKeyId || '',
          secretAccessKey: secretAccessKey || '',
        },
      });
      this.logger.log(
        `R2 Storage client initialized - Bucket: ${this.bucket}, Public URL: ${this.publicUrl || 'Not configured'}`,
      );
    } else if (this.provider === 'supabase') {
      this.restProvider = new SupabaseStorageProvider(this.configService);
      this.bucket = this.configService.get<string>('SUPABASE_BUCKET', 'studyrpg-uploads');
      this.logger.log('Supabase storage provider initialized');
    } else if (this.provider === 'cloudinary') {
      this.restProvider = new CloudinaryStorageProvider(this.configService);
      this.bucket = 'cloudinary';
      this.logger.log('Cloudinary storage provider initialized');
    } else if (this.provider === 'appwrite') {
      this.restProvider = new AppwriteStorageProvider(this.configService);
      this.bucket = this.configService.get<string>('APPWRITE_BUCKET_ID', 'studyrpg-uploads');
      this.logger.log('Appwrite storage provider initialized');
    } else {
      throw new Error(
        `Unsupported STORAGE_PROVIDER "${this.provider}". Supported: minio, r2, supabase, cloudinary, appwrite.`,
      );
    }
  }

  getProvider(): string {
    return this.provider;
  }

  /** Delegation helpers for the REST-backed providers. */
  private requireRest(): RestStorageProvider {
    if (!this.restProvider) {
      throw new Error(`No REST provider configured (provider=${this.provider}).`);
    }
    return this.restProvider;
  }

  private generateKey(filename: string, folder?: string): string {
    const ext = filename.split('.').pop() || '';
    const key = `${uuidv4()}.${ext}`;
    return folder ? `${folder}/${key}` : key;
  }

  async upload(
    file: Buffer | Readable,
    filename: string,
    options?: UploadOptions,
  ): Promise<{ key: string; url: string }> {
    if (this.restProvider) {
      if (file instanceof Buffer) {
        const key = this.generateKey(filename, options?.folder);
        const result = await this.restProvider.upload(file, key, options?.contentType);
        this.logger.debug(`File uploaded via ${this.provider} - Key: ${result.key}`);
        return result;
      }
      this.requireRest().unsupported('streaming upload (buffer only)');
    }

    const key = this.generateKey(filename, options?.folder);

    if (file instanceof Buffer) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: options?.contentType,
          Metadata: options?.metadata,
        }),
      );
    } else {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: options?.contentType,
          Metadata: options?.metadata,
        },
      });

      await upload.done();
    }

    const url = this.publicUrl ? `${this.publicUrl}/${key}` : key;
    this.logger.debug(`File uploaded to R2 - Key: ${key}, Public URL: ${url}`);

    return { key, url };
  }

  async uploadWithKey(
    file: Buffer,
    key: string,
    options?: Omit<UploadOptions, 'folder'>,
  ): Promise<{ key: string; url: string }> {
    if (this.restProvider) {
      const result = await this.restProvider.upload(file, key, options?.contentType);
      this.logger.debug(`File uploaded via ${this.provider} with key: ${key}`);
      return result;
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
      }),
    );

    const url = this.publicUrl ? `${this.publicUrl}/${key}` : key;
    this.logger.debug(`File uploaded with key: ${key}`);

    return { key, url };
  }

  async download(key: string): Promise<Buffer> {
    if (this.restProvider) {
      return this.restProvider.download(key);
    }
    try {
      this.logger.debug(`Downloading file from bucket: ${this.bucket}, key: ${key}`);

      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);
      this.logger.debug(`File downloaded successfully: ${key}, size: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      this.logger.error(
        `Failed to download file from R2. Bucket: ${this.bucket}, Key: ${key}`,
        error,
      );
      throw new Error(`Failed to download file from storage: ${error.message}`);
    }
  }

  async getStream(key: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    return response.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    if (this.restProvider) {
      return this.restProvider.delete(key);
    }
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    this.logger.debug(`File deleted: ${key}`);
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
    this.logger.debug(`${keys.length} files deleted`);
  }

  async exists(key: string): Promise<boolean> {
    if (this.restProvider) {
      return this.restProvider.exists(key);
    }
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getInfo(key: string): Promise<FileInfo | null> {
    if (this.restProvider) {
      return this.restProvider.getInfo(key);
    }
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType,
      };
    } catch {
      return null;
    }
  }

  async list(prefix?: string, maxKeys = 1000): Promise<FileInfo[]> {
    if (this.restProvider) {
      this.requireRest().unsupported('listing objects');
    }
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      }),
    );

    return (response.Contents || []).map((obj) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    }));
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    if (this.restProvider) {
      this.requireRest().unsupported('copying objects');
    }
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destinationKey,
      }),
    );
    this.logger.debug(`File copied: ${sourceKey} -> ${destinationKey}`);
  }

  async move(sourceKey: string, destinationKey: string): Promise<void> {
    await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
    this.logger.debug(`File moved: ${sourceKey} -> ${destinationKey}`);
  }

  async getSignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
    if (this.restProvider) {
      return this.requireRest().getSignedUploadUrl();
    }
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.restProvider) {
      return this.requireRest().getSignedDownloadUrl(key, expiresIn);
    }
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  getPublicUrl(key: string): string {
    if (
      this.restProvider &&
      typeof (this.restProvider as { publicUrl?: unknown }).publicUrl === 'function'
    ) {
      return (this.restProvider as unknown as { publicUrl: (k: string) => string }).publicUrl(key);
    }
    return this.publicUrl ? `${this.publicUrl}/${key}` : key;
  }

  /**
   * Turns a public URL back into a storage key. Handles three cases: URLs
   * under our public prefix (prefix stripped), foreign absolute URLs (path
   * extracted), and bare keys (returned untouched).
   */
  extractKeyFromUrl(url: string): string {
    if (this.publicUrl && url.startsWith(this.publicUrl)) {
      return url.replace(`${this.publicUrl}/`, '');
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      return parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
    }

    return url;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          MaxKeys: 1,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
