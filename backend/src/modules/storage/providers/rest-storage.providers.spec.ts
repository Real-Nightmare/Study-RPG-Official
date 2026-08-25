/**
 * Contract tests for the REST storage providers (owner policy T3). The HTTP
 * layer is mocked — assertions check that our requests match the providers'
 * documented APIs and that results round-trip.
 */

import { ConfigService } from '@nestjs/config';
import { SupabaseStorageProvider } from './supabase-storage.provider';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider';
import { AppwriteStorageProvider } from './appwrite-storage.provider';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeSupabase() {
  return new SupabaseStorageProvider({
    get: (key: string) =>
      ({
        SUPABASE_URL: 'https://proj.supabase.co',
        SUPABASE_SERVICE_KEY: 'service-key',
        SUPABASE_BUCKET: 'studyrpg-uploads',
      })[key],
  } as unknown as ConfigService);
}

describe('SupabaseStorageProvider', () => {
  it('uploads to the documented object endpoint and returns the public URL', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      seen.push({ url: String(url), init });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const provider = makeSupabase();
    const result = await provider.upload(Buffer.from('hello'), 'docs/a.json', 'application/json');

    expect(result).toEqual({
      key: 'docs/a.json',
      url: 'https://proj.supabase.co/storage/v1/object/public/studyrpg-uploads/docs/a.json',
    });
    expect(seen[0].url).toBe(
      'https://proj.supabase.co/storage/v1/object/studyrpg-uploads/docs/a.json',
    );
    expect(seen[0].init?.method).toBe('POST');
    const headers = seen[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer service-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('downloads binary content through the object endpoint', async () => {
    global.fetch = jest.fn(
      async () => new Response(Buffer.from('bytes')),
    ) as unknown as typeof fetch;
    const buffer = await makeSupabase().download('docs/a.json');
    expect(buffer.toString()).toBe('bytes');
  });

  it('creates time-limited signed URLs via the sign endpoint', async () => {
    let body: string | undefined;
    global.fetch = jest.fn(async (_url: string | URL, init?: RequestInit) => {
      body = String(init?.body);
      return jsonResponse({ signedURL: '/object/sign/studyrpg-uploads/docs/a.json?token=t' });
    }) as unknown as typeof fetch;

    const url = await makeSupabase().getSignedDownloadUrl('docs/a.json', 120);
    expect(url).toBe(
      'https://proj.supabase.co/storage/v1/object/sign/studyrpg-uploads/docs/a.json?token=t',
    );
    expect(JSON.parse(body!)).toEqual({ expiresIn: 120 });
  });

  it('treats 404 on delete as success', async () => {
    global.fetch = jest.fn(
      async () => new Response('', { status: 404 }),
    ) as unknown as typeof fetch;
    await expect(makeSupabase().delete('gone.txt')).resolves.toBeUndefined();
  });
});

function makeCloudinary() {
  return new CloudinaryStorageProvider({
    get: (key: string) =>
      ({
        CLOUDINARY_CLOUD_NAME: 'studyrpg',
        CLOUDINARY_API_KEY: 'key123',
        CLOUDINARY_API_SECRET: 'secret456',
      })[key],
  } as unknown as ConfigService);
}

describe('CloudinaryStorageProvider', () => {
  it('uploads via auto/upload with a signed payload and records resource type', async () => {
    const seen: Array<{ url: string }> = [];
    global.fetch = jest.fn(async (url: string | URL) => {
      seen.push({ url: String(url) });
      return jsonResponse({
        public_id: 'studyrpg/images/abc',
        resource_type: 'image',
        secure_url: 'https://res.cloudinary.com/studyrpg/image/upload/v1/studyrpg/images/abc',
      });
    }) as unknown as typeof fetch;

    const result = await makeCloudinary().upload(Buffer.from('img'), 'images/abc', 'image/png');
    expect(seen[0].url).toBe('https://api.cloudinary.com/v1_1/studyrpg/auto/upload');
    // Key carries the delivery type so delete can target it later.
    expect(result.key).toBe('image/studyrpg/images/abc');
    expect(result.url).toContain('/image/upload/');
  });

  it('builds delivery URLs from the typed key', () => {
    expect(makeCloudinary().publicUrl('raw/docs/data.json')).toBe(
      'https://res.cloudinary.com/studyrpg/raw/upload/docs/data.json',
    );
  });

  it('stops destroying as soon as one delivery type reports ok', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: string | URL) => {
      urls.push(String(url));
      return jsonResponse({ result: 'ok' });
    }) as unknown as typeof fetch;

    await makeCloudinary().delete('image/studyrpg/images/abc');
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/image/destroy');
  });

  it('rejects malformed keys', async () => {
    await expect(makeCloudinary().download('no-slash-key')).rejects.toThrow(
      /Invalid Cloudinary key/,
    );
  });
});

function makeAppwrite() {
  return new AppwriteStorageProvider({
    get: (key: string) =>
      ({
        APPWRITE_ENDPOINT: 'https://cloud.appwrite.io/v1',
        APPWRITE_PROJECT_ID: 'proj',
        APPWRITE_API_KEY: 'apikey',
        APPWRITE_BUCKET_ID: 'studyrpg-uploads',
      })[key],
  } as unknown as ConfigService);
}

describe('AppwriteStorageProvider', () => {
  it('POSTs multipart file creations to the bucket files endpoint', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      seen.push({ url: String(url), init });
      return jsonResponse({ $id: 'docs/a.json' });
    }) as unknown as typeof fetch;

    const result = await makeAppwrite().upload(Buffer.from('x'), 'docs/a.json');
    expect(result.key).toBe('docs/a.json');
    expect(seen[0].url).toBe('https://cloud.appwrite.io/v1/storage/buckets/studyrpg-uploads/files');
    expect(seen[0].init?.method).toBe('POST');
    const headers = seen[0].init?.headers as Record<string, string>;
    expect(headers['X-Appwrite-Project']).toBe('proj');
    expect(headers['X-Appwrite-Key']).toBe('apikey');
    expect(String(seen[0].url)).not.toContain('unique()');
  });

  it('downloads through the /download route', async () => {
    const seen: string[] = [];
    global.fetch = jest.fn(async (url: string | URL) => {
      seen.push(String(url));
      return new Response(Buffer.from('payload'));
    }) as unknown as typeof fetch;

    const buffer = await makeAppwrite().download('docs/a.json');
    expect(buffer.toString()).toBe('payload');
    expect(seen[0]).toBe(
      'https://cloud.appwrite.io/v1/storage/buckets/studyrpg-uploads/files/docs/a.json/download',
    );
  });

  it('exposes view URLs for public buckets', () => {
    expect(makeAppwrite().publicUrl('docs/a.json')).toBe(
      'https://cloud.appwrite.io/v1/storage/buckets/studyrpg-uploads/files/docs/a.json/view?project=proj',
    );
  });
});
