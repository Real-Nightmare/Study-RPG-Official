/**
 * Appwrite Storage adapter (owner policy T3 — free tier, no credit card).
 *
 * Documented REST contract (appwrite.io/docs/storage):
 *   create   POST   {endpoint}/storage/buckets/{bucket}/files  (multipart)
 *            fields: fileId (client-chosen), file (blob)
 *            headers: X-Appwrite-Project, X-Appwrite-Key
 *   download GET    {endpoint}/storage/buckets/{bucket}/files/{id}/download
 *   delete   DELETE {endpoint}/storage/buckets/{bucket}/files/{id}
 *
 * Appwrite has no presigned URLs; downloads go through the (server-held)
 * API key or the bucket's public view URL.
 */

import { ConfigService } from '@nestjs/config';
import { RestStorageProvider, RestUploadResult } from './rest-storage.provider';

export class AppwriteStorageProvider extends RestStorageProvider {
  readonly name = 'Appwrite';

  private readonly endpoint: string;
  private readonly projectId: string;
  private readonly apiKey: string;
  private readonly bucketId: string;

  constructor(config: ConfigService) {
    super();
    this.endpoint = (config.get<string>('APPWRITE_ENDPOINT') || '').replace(/\/$/, '');
    this.projectId = config.get<string>('APPWRITE_PROJECT_ID', '');
    this.apiKey = config.get<string>('APPWRITE_API_KEY', '');
    this.bucketId = config.get<string>('APPWRITE_BUCKET_ID', 'studyrpg-uploads');
    if (!this.endpoint || !this.projectId || !this.apiKey) {
      throw new Error(
        'STORAGE_PROVIDER=appwrite requires APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID and APPWRITE_API_KEY.',
      );
    }
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      'X-Appwrite-Project': this.projectId,
      'X-Appwrite-Key': this.apiKey,
      ...extra,
    };
  }

  private fileUrl(key: string): string {
    return `${this.endpoint}/storage/buckets/${this.bucketId}/files/${key}`;
  }

  async upload(file: Buffer, key: string, contentType?: string): Promise<RestUploadResult> {
    const form = new FormData();
    form.append('fileId', key);
    form.append(
      'file',
      new Blob([new Uint8Array(file)], { type: contentType || 'application/octet-stream' }),
      key,
    );
    const res = await fetch(`${this.endpoint}/storage/buckets/${this.bucketId}/files`, {
      method: 'POST',
      headers: this.headers(), // let the runtime set the multipart boundary
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(
        `Appwrite upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
      );
    }
    return { key, url: this.publicUrl(key) };
  }

  async download(key: string): Promise<Buffer> {
    const res = await fetch(`${this.fileUrl(key)}/download`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`Appwrite download failed (${res.status}) for key ${key}`);
    }
    return this.readBuffer(res);
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(this.fileUrl(key), {
      method: 'DELETE',
      headers: this.headers(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Appwrite delete failed (${res.status}) for key ${key}`);
    }
  }

  publicUrl(key: string): string {
    const base = process.env.APPWRITE_PUBLIC_URL?.replace(/\/$/, '') || this.endpoint;
    return `${base}/storage/buckets/${this.bucketId}/files/${key}/view?project=${this.projectId}`;
  }
}
