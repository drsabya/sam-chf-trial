// src/routes/apis/visits/visit1/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

// Helper: add N days to a Date (without mutating the original)
function addDays(base: Date, days: number): Date {
	const d = new Date(base);
	d.setDate(d.getDate() + days);
	return d;
}

// Helper: find the immediate upcoming Tue/Wed/Fri from `from`
// Includes `from` itself if it falls on Tue/Wed/Fri.
function getNextTueWedFri(from: Date): Date {
	const TARGET_DAYS = [2, 3, 5]; // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
	const base = new Date(from);

	for (let offset = 0; offset < 7; offset++) {
		const candidate = addDays(base, offset);
		const day = candidate.getDay();
		if (TARGET_DAYS.includes(day)) {
			return candidate;
		}
	}

	// Fallback (should never actually hit)
	return addDays(base, 1);
}

export const POST: RequestHandler = async ({ request }) => {
	let body: any = null;

	try {
		body = await request.json();
	} catch {
		// no body provided
	}

	const participantId = body?.participantId as string | undefined;

	if (!participantId) {
		return json({ error: 'participantId is required' }, { status: 400 });
	}

	// Treat this as the "created_at" reference time
	const createdAt = new Date();

	const scheduledOn = getNextTueWedFri(createdAt);
	const dueDate = addDays(createdAt, 14);

	const { data, error } = await supabase
		.from('visits')
		.insert({
			participant_id: participantId,
			visit_number: 1,
			// If your columns are `date` or `timestamptz`, ISO strings are fine.
			scheduled_on: scheduledOn.toISOString(),
			due_date: dueDate.toISOString()
		})
		.select('id, participant_id, visit_number, scheduled_on, due_date')
		.single();

	if (error || !data) {
		console.error('Error creating Visit 1:', error);
		return json({ error: 'Could not create Visit 1' }, { status: 500 });
	}

	return json({ visit: data });
};
