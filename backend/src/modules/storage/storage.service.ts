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

export type StorageProviderName = 'minio' | 'r2' | 'supabase' | 'cloudinary' | 'appwrite';

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
 * Multi-provider object storage adapter.
 *
 * Default: MinIO (S3-compatible, self-hosted, zero-config in Docker).
 * Also supports: Cloudflare R2, Supabase Storage, Cloudinary, Appwrite.
 *
 * Switch via STORAGE_PROVIDER env var. All S3-compatible providers (MinIO, R2)
 * use the same AWS SDK client with different endpoint/credentials.
 * Non-S3 providers (Supabase, Cloudinary, Appwrite) use their native REST APIs.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private bucket: string;
  private publicUrl: string;
  private provider: StorageProviderName;
  private endpoint: string | undefined;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.provider = this.configService.get<StorageProviderName>('STORAGE_PROVIDER', 'minio');
    this.bucket = this.configService.get<string>('STORAGE_BUCKET', 'studyrpg-uploads');
    this.publicUrl = this.configService.get<string>('STORAGE_PUBLIC_URL', '');
    this.endpoint = this.configService.get<string>('STORAGE_ENDPOINT');

    if (this.provider === 'minio' || this.provider === 'r2') {
      this.initS3Client();
    }

    this.logger.log(`Storage provider: ${this.provider}, bucket: ${this.bucket}`);
  }

  private initS3Client(): void {
    const accessKeyId = this.configService.get<string>('STORAGE_ACCESS_KEY_ID', this.configService.get<string>('AWS_ACCESS_KEY_ID', ''));
    const secretAccessKey = this.configService.get<string>('STORAGE_SECRET_ACCESS_KEY', this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''));
    const region = this.configService.get<string>('STORAGE_REGION', this.configService.get<string>('AWS_REGION', 'us-east-1'));

    let endpoint: string | undefined;

    if (this.provider === 'minio') {
      endpoint = this.endpoint || this.configService.get<string>('MINIO_ENDPOINT', 'http://minio:9000');
    } else if (this.provider === 'r2') {
      const accountId = this.configService.get<string>('R2_ACCOUNT_ID', '');
      endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    }

    this.s3Client = new S3Client({
      region: this.provider === 'minio' ? 'us-east-1' : region,
      endpoint,
      forcePathStyle: this.provider === 'minio',
      credentials: { accessKeyId, secretAccessKey },
    });

    if (!this.publicUrl && this.provider === 'minio') {
      const minioHost = this.configService.get<string>('MINIO_PUBLIC_HOST', 'localhost');
      const minioPort = this.configService.get<string>('MINIO_API_PORT', '9000');
      this.publicUrl = `http://${minioHost}:${minioPort}/${this.bucket}`;
    }
  }

  private generateKey(filename: string, folder?: string): string {
    const ext = filename.split('.').pop() || '';
    const key = `${uuidv4()}.${ext}`;
    return folder ? `${folder}/${key}` : key;
  }

  private ensureS3(): S3Client {
    if (!this.s3Client) {
      throw new Error(`Storage provider '${this.provider}' requires S3 client. Check STORAGE_PROVIDER and credentials.`);
    }
    return this.s3Client;
  }

  // ── S3-compatible upload (MinIO / R2) ───────────────────────────

  async upload(
    file: Buffer | Readable,
    filename: string,
    options?: UploadOptions,
  ): Promise<{ key: string; url: string }> {
    if (this.provider === 'cloudinary') return this.uploadCloudinary(file, filename, options);
    if (this.provider === 'supabase') return this.uploadSupabase(file, filename, options);
    if (this.provider === 'appwrite') return this.uploadAppwrite(file, filename, options);

    const client = this.ensureS3();
    const key = this.generateKey(filename, options?.folder);

    if (file instanceof Buffer) {
      await client.send(
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
        client,
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
    this.logger.debug(`File uploaded (${this.provider}) - Key: ${key}`);
    return { key, url };
  }

  async uploadWithKey(
    file: Buffer,
    key: string,
    options?: Omit<UploadOptions, 'folder'>,
  ): Promise<{ key: string; url: string }> {
    const client = this.ensureS3();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
      }),
    );
    const url = this.publicUrl ? `${this.publicUrl}/${key}` : key;
    return { key, url };
  }

  async download(key: string): Promise<Buffer> {
    if (this.provider === 'cloudinary') return this.downloadCloudinary(key);
    if (this.provider === 'supabase') return this.downloadSupabase(key);
    if (this.provider === 'appwrite') return this.downloadAppwrite(key);

    const client = this.ensureS3();
    try {
      const response = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    } catch (error) {
      throw new Error(`Failed to download file: ${key} — ${(error as Error).message}`);
    }
  }

  async getStream(key: string): Promise<Readable> {
    const client = this.ensureS3();
    const response = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return response.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    if (this.provider === 'cloudinary') { await this.deleteCloudinary(key); return; }
    if (this.provider === 'supabase') { await this.deleteSupabase(key); return; }
    if (this.provider === 'appwrite') { await this.deleteAppwrite(key); return; }
    const client = this.ensureS3();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  async exists(key: string): Promise<boolean> {
    if (this.provider !== 'minio' && this.provider !== 'r2') {
      const info = await this.getInfo(key);
      return info !== null;
    }
    try {
      const client = this.ensureS3();
      await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async getInfo(key: string): Promise<FileInfo | null> {
    if (this.provider !== 'minio' && this.provider !== 'r2') {
      // For non-S3 providers, do a HEAD-like probe via download range or list
      try {
        const buf = await this.download(key);
        return { key, size: buf.length, lastModified: new Date() };
      } catch {
        return null;
      }
    }
    try {
      const client = this.ensureS3();
      const response = await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
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
    if (this.provider !== 'minio' && this.provider !== 'r2') return [];
    const client = this.ensureS3();
    const response = await client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, MaxKeys: maxKeys }));
    return (response.Contents || []).map((obj) => ({
      key: obj.Key || '', size: obj.Size || 0, lastModified: obj.LastModified || new Date(),
    }));
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    const client = this.ensureS3();
    await client.send(new CopyObjectCommand({
      Bucket: this.bucket, CopySource: `${this.bucket}/${sourceKey}`, Key: destinationKey,
    }));
  }

  async move(sourceKey: string, destinationKey: string): Promise<void> {
    await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
  }

  async getSignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
    if (this.provider !== 'minio' && this.provider !== 'r2') {
      return this.getPublicUrl(key);
    }
    const client = this.ensureS3();
    return getSignedUrl(client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), { expiresIn });
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.provider !== 'minio' && this.provider !== 'r2') {
      return this.getPublicUrl(key);
    }
    const client = this.ensureS3();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }

  getPublicUrl(key: string): string {
    return this.publicUrl ? `${this.publicUrl}/${key}` : key;
  }

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

  getProvider(): StorageProviderName { return this.provider; }

  async healthCheck(): Promise<boolean> {
    try {
      if (this.provider !== 'minio' && this.provider !== 'r2') return true;
      const client = this.ensureS3();
      await client.send(new ListObjectsV2Command({ Bucket: this.bucket, MaxKeys: 1 }));
      return true;
    } catch {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Cloudinary adapter (free tier: ~25 credits/mo, no CC)
  // ═══════════════════════════════════════════════════════════════════

  private get cloudName(): string { return this.configService.get('CLOUDINARY_CLOUD_NAME', ''); }
  private get cloudApiKey(): string { return this.configService.get('CLOUDINARY_API_KEY', ''); }
  private get cloudApiSecret(): string { return this.configService.get('CLOUDINARY_API_SECRET', ''); }

  private async uploadCloudinary(file: Buffer | Readable, filename: string, options?: UploadOptions): Promise<{ key: string; url: string }> {
    const folder = options?.folder || 'studyrpg';
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `${folder}/${uuidv4()}_${filename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const paramsToSign: Record<string, string | number> = { public_id: publicId, timestamp };
    const signature = await this.signCloudinary(paramsToSign);
    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', this.cloudApiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    if (file instanceof Buffer) {
      const ext = filename.split('.').pop() || 'bin';
      formData.append('file', new Blob([file]), `${publicId}.${ext}`);
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of file) chunks.push(Buffer.from(chunk));
      const ext = filename.split('.').pop() || 'bin';
      formData.append('file', new Blob([Buffer.concat(chunks)]), `${publicId}.${ext}`);
    }
    const res = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as { secure_url: string; public_id: string };
    return { key: data.public_id, url: data.secure_url };
  }

  private async signCloudinary(params: Record<string, string | number>): Promise<string> {
    const crypto = await import('crypto');
    const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    return crypto.createHash('sha256').update(`${sorted}${this.cloudApiSecret}`).digest('hex');
  }

  private async downloadCloudinary(key: string): Promise<Buffer> {
    const res = await fetch(`https://res.cloudinary.com/${this.cloudName}/raw/upload/${key}`);
    if (!res.ok) throw new Error(`Cloudinary download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  private async deleteCloudinary(key: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await this.signCloudinary({ public_id: key, timestamp });
    const formData = new FormData();
    formData.append('public_id', key);
    formData.append('api_key', this.cloudApiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/raw/destroy`, { method: 'POST', body: formData });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Supabase Storage adapter (free tier: 1 GB, no CC)
  // ═══════════════════════════════════════════════════════════════════

  private get supabaseUrl(): string { return this.configService.get('SUPABASE_URL', ''); }
  private get supabaseKey(): string { return this.configService.get('SUPABASE_SERVICE_KEY', ''); }

  private async uploadSupabase(file: Buffer | Readable, filename: string, options?: UploadOptions): Promise<{ key: string; url: string }> {
    const folder = options?.folder || 'studyrpg';
    const key = `${folder}/${uuidv4()}_${filename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const body = file instanceof Buffer ? file : Buffer.concat(await (async () => { const c: Buffer[] = []; for await (const ch of file) c.push(Buffer.from(ch)); return c; })());
    const res = await fetch(`${this.supabaseUrl}/storage/v1/object/${this.bucket}/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.supabaseKey}`, 'Content-Type': options?.contentType || 'application/octet-stream' },
      body,
    });
    if (!res.ok) throw new Error(`Supabase upload failed: ${res.status} ${await res.text()}`);
    return { key, url: `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${key}` };
  }

  private async downloadSupabase(key: string): Promise<Buffer> {
    const res = await fetch(`${this.supabaseUrl}/storage/v1/object/${this.bucket}/${key}`, {
      headers: { Authorization: `Bearer ${this.supabaseKey}` },
    });
    if (!res.ok) throw new Error(`Supabase download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  private async deleteSupabase(key: string): Promise<void> {
    await fetch(`${this.supabaseUrl}/storage/v1/object/${this.bucket}/${key}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${this.supabaseKey}` },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Appwrite Storage adapter (free tier: 2 GB, no CC)
  // ═══════════════════════════════════════════════════════════════════

  private get appwriteUrl(): string { return this.configService.get('APPWRITE_ENDPOINT', ''); }
  private get appwriteKey(): string { return this.configService.get('APPWRITE_API_KEY', ''); }
  private get appwriteProject(): string { return this.configService.get('APPWRITE_PROJECT_ID', ''); }

  private async uploadAppwrite(file: Buffer | Readable, filename: string, options?: UploadOptions): Promise<{ key: string; url: string }> {
    const folder = options?.folder || 'studyrpg';
    const key = `${folder}/${uuidv4()}_${filename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const body = file instanceof Buffer ? file : Buffer.concat(await (async () => { const c: Buffer[] = []; for await (const ch of file) c.push(Buffer.from(ch)); return c; })());
    const bucketId = this.bucket.replace(/-/g, '_');
    const res = await fetch(`${this.appwriteUrl}/storage/buckets/${bucketId}/files`, {
      method: 'POST',
      headers: { 'X-Appwrite-Key': this.appwriteKey, 'X-Appwrite-Project': this.appwriteProject },
      body: (() => { const fd = new FormData(); fd.append('file', new Blob([body]), filename); fd.append('permissions[]', 'read("any")'); return fd; })(),
    });
    if (!res.ok) throw new Error(`Appwrite upload failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as { $id: string };
    const fileId = data.$id;
    return { key: fileId, url: `${this.appwriteUrl}/storage/buckets/${bucketId}/files/${fileId}/view?project=${this.appwriteProject}` };
  }

  private async downloadAppwrite(key: string): Promise<Buffer> {
    const bucketId = this.bucket.replace(/-/g, '_');
    const res = await fetch(`${this.appwriteUrl}/storage/buckets/${bucketId}/files/${key}/download?project=${this.appwriteProject}`, {
      headers: { 'X-Appwrite-Key': this.appwriteKey },
    });
    if (!res.ok) throw new Error(`Appwrite download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  private async deleteAppwrite(key: string): Promise<void> {
    const bucketId = this.bucket.replace(/-/g, '_');
    await fetch(`${this.appwriteUrl}/storage/buckets/${bucketId}/files/${key}?project=${this.appwriteProject}`, {
      method: 'DELETE', headers: { 'X-Appwrite-Key': this.appwriteKey },
    });
  }
}
