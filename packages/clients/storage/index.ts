import AWS from 'aws-sdk';
import { Readable } from 'stream';

export function getS3() {
	const { S3_ENDPOINT, S3_REGION = 'us-east-1', S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env as any;
	const disabled = String(process.env.S3_DISABLED || process.env.SKIP_S3_UPLOAD || '').toLowerCase() === 'true';
	if (disabled || !S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
		// Minimal mock for local tests or when explicitly disabled
		return {
			putObject: () => ({ promise: async () => ({ ETag: 'stub' }) }),
			getObject: (_params: any) => ({ createReadStream: () => Readable.from('') }),
			sign: () => 'http://localhost/s3/stub',
			getSignedUrl: (_op: string, _params: any) => 'http://localhost/s3/stub',
		} as unknown as AWS.S3;
	}
	const timeout = Number(process.env.S3_TIMEOUT_MS || 5000);
	const connectTimeout = Number(process.env.S3_CONNECT_TIMEOUT_MS || 1000);
	const s3 = new (AWS as any).S3({
		endpoint: S3_ENDPOINT,
		region: S3_REGION,
		accessKeyId: S3_ACCESS_KEY_ID,
		secretAccessKey: S3_SECRET_ACCESS_KEY,
		s3ForcePathStyle: true,
		signatureVersion: 'v4',
		httpOptions: { timeout, connectTimeout },
	});
	return s3 as AWS.S3;
}

export async function uploadToS3(params: { Bucket: string; Key: string; Body: Buffer | string; ContentType?: string; }): Promise<{ ETag: string }> {
	const s3 = getS3();
	const res = await (s3 as any).putObject(params).promise();
	return { ETag: res?.ETag || 'stub' };
}

export function getSignedUrl(params: { Bucket: string; Key: string; Expires?: number }): string {
	const s3 = getS3();
	if ((s3 as any).getSignedUrl) return (s3 as any).getSignedUrl('getObject', params);
	if ((s3 as any).sign) return (s3 as any).sign();
	return 'http://localhost/s3/stub';
}

export async function getFileStream(keyOrPath?: string) {
	if (!keyOrPath) throw new Error('storage key/path required');
	const Bucket = process.env.S3_BUCKET || 'contracts';
	const Key = keyOrPath;
	const s3 = getS3();
	const obj = (s3 as any).getObject({ Bucket, Key });
	if (obj && typeof obj.createReadStream === 'function') return obj.createReadStream();
	// fallback: empty stream
	return Readable.from('');
}

export async function getObjectBuffer(keyOrPath: string): Promise<Buffer> {
	const Bucket = process.env.S3_BUCKET || 'contracts';
	const Key = keyOrPath;
	const s3 = getS3() as any;
	if (s3 && typeof s3.getObject === 'function') {
		const res = await s3.getObject({ Bucket, Key }).promise();
		const body = (res && res.Body) as Buffer | Uint8Array | string | undefined;
		if (!body) return Buffer.alloc(0);
		return Buffer.isBuffer(body) ? body : Buffer.from(body as any);
	}
	// Fallback: try stream and collect
	const stream = await getFileStream(keyOrPath);
	const chunks: Buffer[] = [];
	return await new Promise<Buffer>((resolve, reject) => {
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('error', reject);
		stream.on('end', () => resolve(Buffer.concat(chunks)));
	});
}
