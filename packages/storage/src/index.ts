import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageConfiguration {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export interface StoredObjectMetadata {
  contentLength: number;
  contentType: string | undefined;
  sha256: string | undefined;
  eTag: string | undefined;
}

export class ObjectStorage {
  readonly bucket: string;
  private readonly client: S3Client;

  constructor(configuration: StorageConfiguration) {
    this.bucket = configuration.bucket;
    this.client = new S3Client({
      endpoint: configuration.endpoint,
      region: configuration.region,
      forcePathStyle: configuration.forcePathStyle,
      credentials: {
        accessKeyId: configuration.accessKeyId,
        secretAccessKey: configuration.secretAccessKey,
      },
    });
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async createUploadUrl(
    key: string,
    contentType: string,
    sha256: string,
    expiresIn: number,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        Metadata: { sha256 },
      }),
      { expiresIn },
    );
  }

  async createReadUrl(key: string, expiresIn: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn,
    });
  }

  async head(key: string): Promise<StoredObjectMetadata> {
    const response = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (response.ContentLength === undefined)
      throw new Error("Storage metadata omitted content length");
    return {
      contentLength: response.ContentLength,
      contentType: response.ContentType,
      sha256: response.Metadata?.sha256,
      eTag: response.ETag,
    };
  }

  async readPrefix(key: string, bytes: number): Promise<Uint8Array> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: `bytes=0-${Math.max(0, bytes - 1)}`,
      }),
    );
    if (!response.Body) throw new Error("Storage object body was empty");
    return response.Body.transformToByteArray();
  }

  async openReadStream(key: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!(response.Body instanceof Readable))
      throw new Error("Storage provider did not return a Node readable stream");
    return response.Body;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  destroy(): void {
    this.client.destroy();
  }
}
