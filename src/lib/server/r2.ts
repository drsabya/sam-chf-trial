// src/lib/server/r2.ts
import { S3Client } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

// Read env vars at runtime
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET: R2_BUCKET_NAME } = env;

// Validate required envs
if (!R2_ACCOUNT_ID) throw new Error('Missing env: R2_ACCOUNT_ID');
if (!R2_ACCESS_KEY_ID) throw new Error('Missing env: R2_ACCESS_KEY_ID');
if (!R2_SECRET_ACCESS_KEY) throw new Error('Missing env: R2_SECRET_ACCESS_KEY');
if (!R2_BUCKET_NAME) throw new Error('Missing env: R2_BUCKET');

// Build endpoint
const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const r2 = new S3Client({
	region: 'auto',
	endpoint,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY
	}
});

// Export final bucket name
export const R2_BUCKET = R2_BUCKET_NAME;
