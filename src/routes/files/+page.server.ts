// src/routes/files/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { r2, R2_BUCKET } from '$lib/server/r2';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

type VisitRow = {
	id: string;
	participant_id: string | null;
	visit_number: number | null;
	created_at?: string | null;
	[key: string]: any;
};

export type FileItem = {
	visitId: string;
	visitNumber: number | null;
	participantId: string | null;
	field: string;
	url: string;
};

/**
 * Helper to derive R2 object key from stored src.
 * - If src is a full URL, we strip leading slash and bucket prefix.
 * - If it’s already a key, we just return it.
 */
function extractR2KeyFromSrc(src: string): string {
	let key = src;

	try {
		const u = new URL(src);
		let path = u.pathname.replace(/^\/+/, ''); // remove leading slashes

		// If path starts with "<bucket>/" strip that
		if (path.startsWith(`${R2_BUCKET}/`)) {
			path = path.slice(R2_BUCKET.length + 1);
		}

		key = path || src;
	} catch {
		// Not a URL, assume src is already the key
	}

	return key;
}

export const load: PageServerLoad = async () => {
	const { data: visits, error: dbError } = await supabase
		.from('visits')
		.select('*')
		.order('created_at', { ascending: false });

	if (dbError) {
		console.error('Error loading visits for files page:', dbError);
		throw error(500, 'Failed to load visit files');
	}

	const files: FileItem[] = [];

	for (const visit of (visits ?? []) as VisitRow[]) {
		for (const [field, value] of Object.entries(visit)) {
			if (!value || typeof value !== 'string') continue;
			if (!field.endsWith('_src')) continue; // treat any *_src as a file field

			files.push({
				visitId: visit.id,
				visitNumber: visit.visit_number ?? null,
				participantId: visit.participant_id ?? null,
				field,
				url: value
			});
		}
	}

	return {
		files
	};
};

export const actions: Actions = {
	delete: async ({ request }) => {
		const formData = await request.formData();
		const src = formData.get('src');
		const visitId = formData.get('visitId');
		const field = formData.get('field');

		if (!src || !visitId || !field) {
			return fail(400, {
				ok: false,
				message: 'Missing required fields for deletion.'
			});
		}

		const srcStr = String(src);
		const visitIdStr = String(visitId);
		const fieldStr = String(field);

		// 1. Delete from R2
		const key = extractR2KeyFromSrc(srcStr);

		try {
			await r2.send(
				new DeleteObjectCommand({
					Bucket: R2_BUCKET,
					Key: key
				})
			);
		} catch (err) {
			console.error('Failed to delete R2 object:', { key, err });
			return fail(500, {
				ok: false,
				message: 'Failed to delete file from storage.'
			});
		}

		// 2. Clear the corresponding src field in DB
		try {
			const { error: updateError } = await supabase
				.from('visits')
				.update({ [fieldStr]: null })
				.eq('id', visitIdStr);

			if (updateError) {
				console.error('Failed to clear src field after deletion:', updateError);
				return fail(500, {
					ok: false,
					message:
						'File deleted from storage, but failed to update database. Please check manually.'
				});
			}
		} catch (err) {
			console.error('Unexpected error while updating visit record:', err);
			return fail(500, {
				ok: false,
				message:
					'File deleted from storage, but failed to update database. Please check manually.'
			});
		}

		return {
			ok: true,
			message: 'File deleted successfully.'
		};
	}
};
