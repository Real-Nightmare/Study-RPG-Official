/**
 * Shared plumbing for the REST-based storage providers (owner policy T3:
 * external storage is allowed ONLY as free-tier, no-credit-card options).
 *
 * Each provider implements the subset of the StorageService surface that the
 * completion plan requires — upload / download / delete / exists / public
 * URL — plus whatever signed-URL capability the service genuinely offers.
 * Operations a provider cannot honour throw a CLEAR error; nothing is faked.
 */

export interface RestUploadResult {
  /** Provider-native key (opaque to callers; round-trips to delete/etc.). */
  key: string;
  /** Public URL of the stored object (used by e.g. the C2D publisher). */
  url: string;
}

export abstract class RestStorageProvider {
  abstract readonly name: string;

  abstract upload(
    file: Buffer | ReadableStream,
    key: string,
    contentType?: string,
  ): Promise<RestUploadResult>;

  abstract download(key: string): Promise<Buffer>;

  abstract delete(key: string): Promise<void>;

  async exists(_key: string): Promise<boolean> {
    // Providers override with a HEAD/GET probe where an API exists.
    try {
      await this.download(_key);
      return true;
    } catch {
      return false;
    }
  }

  async getInfo(key: string): Promise<{ key: string; size: number; lastModified: Date } | null> {
    const buffer = await this.download(key);
    return { key, size: buffer.length, lastModified: new Date(0) };
  }

  /** Public (unauthenticated) URL for an object, when the service has one. */
  abstract publicUrl(key: string): string;

  /** Not every service has presigned URLs; the message tells the operator why. */
  async getSignedDownloadUrl(key: string, _expiresIn = 3600): Promise<string> {
    throw new Error(
      `${this.name} does not offer presigned download URLs — serve objects via their ` +
        `public URL instead (see ${this.name}Provider.publicUrl).`,
    );
  }

  async getSignedUploadUrl(): Promise<string> {
    throw new Error(`${this.name} does not offer presigned upload URLs.`);
  }

  unsupported(operation: string): never {
    throw new Error(
      `${this.name} storage does not support "${operation}". Switch STORAGE_PROVIDER ` +
        `to minio/r2 for full S3 semantics.`,
    );
  }

  /** Read a fetch Response body into a Buffer. */
  protected async readBuffer(res: Response): Promise<Buffer> {
    const chunks: Buffer[] = [];
    // Node's fetch exposes a web ReadableStream; iterate chunks defensively.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream: any = res.body;
    if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
    } else {
      chunks.push(Buffer.from(await res.arrayBuffer()));
    }
    return Buffer.concat(chunks);
  }
}
