// src/routes/apis/participants/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

function extractScreeningNumber(screeningId: string | null | undefined): number {
	if (!screeningId) return 0;
	const trimmed = screeningId.trim();
	const match = /^S(\d+)$/i.exec(trimmed);
	if (!match) return 0;
	const n = Number.parseInt(match[1], 10);
	return Number.isNaN(n) ? 0 : n;
}

export const POST: RequestHandler = async () => {
	// 1. Fetch all screening IDs (n will be small for this trial)
	const { data, error } = await supabase.from('participants').select('screening_id');

	if (error) {
		console.error('Error fetching screening IDs:', error);
		return json({ error: 'Could not fetch existing participants' }, { status: 500 });
	}

	let max = 0;
	for (const row of data ?? []) {
		const n = extractScreeningNumber((row as any).screening_id);
		if (n > max) max = n;
	}

	const nextNumber = max + 1;
	const screening_id = `S${nextNumber}`;

	// 2. Insert minimal participant row (you can extend this later)
	const { data: inserted, error: insertError } = await supabase
		.from('participants')
		.insert({ screening_id })
		.select('id, screening_id')
		.single();

	if (insertError || !inserted) {
		console.error('Error inserting participant:', insertError);
		return json({ error: 'Could not create participant' }, { status: 500 });
	}

	return json({ participant: inserted });
};
