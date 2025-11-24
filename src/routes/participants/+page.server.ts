// src/routes/participants/+page.server.ts
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

type ParticipantRow = {
	id: string;
	first_name: string | null;
	middle_name: string | null;
	last_name: string | null;
	screening_id: string;
	randomization_id: string | null;
	created_at: string;
};

export const load: PageServerLoad = async () => {
	// Fetches all participants without any search filter
	let query = supabase
		.from('participants')
		.select('id, first_name, middle_name, last_name, screening_id, randomization_id, created_at');

	// Basic order from DB (we'll re-sort by numeric screening id in JS)
	query = query.order('created_at', { ascending: false });

	const { data, error: err } = await query;

	if (err || !data) {
		console.error('Error fetching participants:', {
			message: err?.message,
			details: (err as any)?.details,
			hint: (err as any)?.hint,
			code: (err as any)?.code
		});
		throw error(500, 'Could not load participants');
	}

	// Still sort by numeric screening id, which is often easier for users to scan
	const participants = (data as ParticipantRow[]).sort((a, b) => {
		const num = (x: string | null | undefined) => {
			if (!x) return 0;
			const m = x.match(/\d+/);
			return m ? parseInt(m[0], 10) : 0;
		};

		return num(b.screening_id) - num(a.screening_id);
	});

	return {
		participants
		// No need to return 'search' anymore as the server doesn't handle it
	};
};
