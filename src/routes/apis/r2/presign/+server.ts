import { json, error } from '@sveltejs/kit';
import { r2, R2_BUCKET } from '$lib/server/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const POST = async ({ request }) => {
	try {
		const body = await request.json();

		const { visitId, field, filename } = body;

		if (!visitId || !field || !filename) {
			throw error(400, 'Missing required fields');
		}

		// File path inside R2
		const objectKey = `visits/${visitId}/${field}/${filename}`;

		// Create command
		const command = new PutObjectCommand({
			Bucket: R2_BUCKET,
			Key: objectKey
		});

		// Generate 15-minute presigned URL
		const url = await getSignedUrl(r2, command, { expiresIn: 900 });

		return json({
			ok: true,
			url,
			objectKey
		});
	} catch (err: any) {
		console.error('Presign failed:', err);
		throw error(500, 'Failed to generate upload URL');
	}
};
