/**
 * Supabase Storage adapter (owner policy T3 — free tier, no credit card).
 *
 * Documented REST contract (supabase.com/docs/reference/api):
 *   upload    POST   {url}/storage/v1/object/{bucket}/{key}      (binary body)
 *   download  GET    {url}/storage/v1/object/{bucket}/{key}
 *   delete    DELETE {url}/storage/v1/object/{bucket}/{key}
 *   signed    POST   {url}/storage/v1/object/sign/{bucket}/{key} {"expiresIn"}
 * Auth: `Authorization: Bearer <service key>` (server-side only).
 */

import { ConfigService } from '@nestjs/config';
import { RestStorageProvider, RestUploadResult } from './rest-storage.provider';

export class SupabaseStorageProvider extends RestStorageProvider {
  readonly name = 'Supabase';

  private readonly baseUrl: string;
  private readonly serviceKey: string;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    super();
    this.baseUrl = (config.get<string>('SUPABASE_URL') || '').replace(/\/$/, '');
    this.serviceKey = config.get<string>('SUPABASE_SERVICE_KEY', '');
    this.bucket = config.get<string>('SUPABASE_BUCKET', 'studyrpg-uploads');
    if (!this.baseUrl || !this.serviceKey) {
      throw new Error('STORAGE_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_KEY.');
    }
  }

  private objectUrl(key: string): string {
    return `${this.baseUrl}/storage/v1/object/${this.bucket}/${key}`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceKey}`,
      ...extra,
    };
  }

  async upload(file: Buffer, key: string, contentType?: string): Promise<RestUploadResult> {
    const res = await fetch(this.objectUrl(key), {
      method: 'POST',
      headers: this.headers({
        'Content-Type': contentType || 'application/octet-stream',
        'x-upsert': 'true',
      }),
      body: new Uint8Array(file),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(
        `Supabase upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
      );
    }
    return { key, url: this.publicUrl(key) };
  }

  async download(key: string): Promise<Buffer> {
    const res = await fetch(this.objectUrl(key), {
      headers: this.headers(),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`Supabase download failed (${res.status}) for key ${key}`);
    }
    return this.readBuffer(res);
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(this.objectUrl(key), {
      method: 'DELETE',
      headers: this.headers(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Supabase delete failed (${res.status}) for key ${key}`);
    }
  }

  /** Presigned-style URL via the sign endpoint (valid for expiresIn seconds). */
  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const res = await fetch(`${this.baseUrl}/storage/v1/object/sign/${this.bucket}/${key}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Supabase sign failed (${res.status}) for key ${key}`);
    }
    const data = (await res.json()) as { signedURL?: string };
    if (!data.signedURL) {
      throw new Error('Supabase sign returned no signedURL.');
    }
    return `${this.baseUrl}/storage/v1${data.signedURL}`;
  }

  publicUrl(key: string): string {
    const base =
      process.env.SUPABASE_PUBLIC_URL?.replace(/\/$/, '') ||
      `${this.baseUrl}/storage/v1/object/public`;
    return `${base}/${this.bucket}/${key}`;
  }
}
