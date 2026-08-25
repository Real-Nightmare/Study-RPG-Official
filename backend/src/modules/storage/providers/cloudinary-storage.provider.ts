/**
 * Cloudinary storage adapter (owner policy T3 — free tier, no credit card).
 *
 * Documented REST contract (cloudinary.com/documentation):
 *   upload  POST https://api.cloudinary.com/v1_1/{cloud}/auto/upload
 *           multipart fields: file (base64 data URI), public_id, timestamp,
 *           api_key, signature = sha1(sorted params + api_secret)
 *   destroy POST https://api.cloudinary.com/v1_1/{cloud}/{type}/destroy
 *
 * Key format used by this adapter: `{resource_type}/{public_id}` so delete
 * can target the right delivery type without extra state.
 */

import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { RestStorageProvider, RestUploadResult } from './rest-storage.provider';

const CLOUD_TYPES = ['image', 'raw', 'video'] as const;

export class CloudinaryStorageProvider extends RestStorageProvider {
  readonly name = 'Cloudinary';

  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly folder: string;

  constructor(config: ConfigService) {
    super();
    this.cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME', '');
    this.apiKey = config.get<string>('CLOUDINARY_API_KEY', '');
    this.apiSecret = config.get<string>('CLOUDINARY_API_SECRET', '');
    this.folder = config.get<string>('CLOUDINARY_FOLDER', 'studyrpg');
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error(
        'STORAGE_PROVIDER=cloudinary requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
      );
    }
  }

  /** Cloudinary signing: sha1 over sorted `k=v` pairs joined by &, + secret. */
  private sign(params: Record<string, string>): string {
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return createHash('sha1')
      .update(toSign + this.apiSecret)
      .digest('hex');
  }

  async upload(file: Buffer, key: string, contentType?: string): Promise<RestUploadResult> {
    const publicId = `${this.folder}/${key}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params: Record<string, string> = { public_id: publicId, timestamp };
    const signature = this.sign(params);

    const form = new FormData();
    form.append(
      'file',
      `data:${contentType || 'application/octet-stream'};base64,${file.toString('base64')}`,
    );
    form.append('public_id', publicId);
    form.append('timestamp', timestamp);
    form.append('api_key', this.apiKey);
    form.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(
        `Cloudinary upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
      );
    }
    const data = (await res.json()) as {
      public_id?: string;
      resource_type?: string;
      secure_url?: string;
    };
    if (!data.public_id || !data.secure_url) {
      throw new Error('Cloudinary upload returned an unexpected payload.');
    }
    return { key: `${data.resource_type || 'raw'}/${data.public_id}`, url: data.secure_url };
  }

  async download(key: string): Promise<Buffer> {
    const [type, publicId] = this.splitKey(key);
    // Authenticated/raw delivery needs signed URLs; for public assets the
    // plain delivery URL works. We fetch through our stored public form.
    const url = `https://res.cloudinary.com/${this.cloudName}/${type}/upload/${publicId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      throw new Error(`Cloudinary download failed (${res.status}) for key ${key}`);
    }
    return this.readBuffer(res);
  }

  /**
   * Destroy tries each delivery type (the upload endpoint picks one itself
   * and Cloudinary has no lookup-by-id API); first success wins.
   */
  async delete(key: string): Promise<void> {
    let lastStatus = 400;
    for (const type of CLOUD_TYPES) {
      const [, publicId] = this.splitKey(`${type}/${key}`);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = this.sign({ public_id: publicId, timestamp });
      const res = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/${type}/destroy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_id: publicId,
          timestamp,
          api_key: this.apiKey,
          signature,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { result?: string };
        if (data.result === 'ok' || data.result === 'not found') return;
        lastStatus = res.status;
      } else {
        lastStatus = res.status;
      }
    }
    throw new Error(`Cloudinary delete failed (last status ${lastStatus}) for key ${key}`);
  }

  publicUrl(key: string): string {
    const [type, publicId] = this.splitKey(key);
    return `https://res.cloudinary.com/${this.cloudName}/${type}/upload/${publicId}`;
  }

  private splitKey(key: string): [string, string] {
    const slash = key.indexOf('/');
    if (slash <= 0) {
      throw new Error(`Invalid Cloudinary key "${key}" — expected "<resource_type>/<public_id>".`);
    }
    return [key.slice(0, slash), key.slice(slash + 1)];
  }
}
