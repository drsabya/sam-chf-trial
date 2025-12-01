// src/routes/apis/visits/scheduling/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

/* ---------------------------------------------
   DATE HELPERS (server-side validation)
--------------------------------------------- */

function toUtcStartOfDay(dateInput: Date | string): Date {
	const d = new Date(dateInput);
	if (isNaN(d.getTime())) return new Date();
	d.setUTCHours(0, 0, 0, 0);
	return d;
}

function addUtcDays(base: Date, days: number): Date {
	const d = new Date(base);
	d.setUTCDate(d.getUTCDate() + days);
	return d;
}

type VisitRow = {
	id: string;
	created_at: string | null;
	due_date: string | null;
	visit_number: number;
};

function getWindowBounds(visit: VisitRow): { start: Date; end: Date } {
	const createdAt = visit.created_at
		? toUtcStartOfDay(visit.created_at)
		: toUtcStartOfDay(new Date());

	if (!visit.due_date) {
		// Fallback: 14 days from created_at
		const endFallback = addUtcDays(createdAt, 14);
		return { start: createdAt, end: endFallback };
	}

	const end = toUtcStartOfDay(visit.due_date);
	let start = createdAt;

	// 1–2: all Tue/Wed/Fri till the due date (from created_at)
	// 3–5: last 7 days before due_date
	// 6–8: last 14 days before due_date
	if (visit.visit_number >= 3 && visit.visit_number <= 5) {
		const candidate = addUtcDays(end, -7);
		start = candidate > createdAt ? candidate : createdAt;
	} else if (visit.visit_number >= 6 && visit.visit_number <= 8) {
		const candidate = addUtcDays(end, -14);
		start = candidate > createdAt ? candidate : createdAt;
	} else {
		// visit 1–2 (or anything else) → from created_at
		start = createdAt;
	}

	return { start, end };
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => null)) as {
			visitId?: string;
			scheduled_on?: string;
		} | null;

		const visitId = body?.visitId;
		const scheduled_on = body?.scheduled_on;

		if (!visitId || typeof visitId !== 'string') {
			return json({ ok: false, message: 'visitId is required' }, { status: 400 });
		}

		if (!scheduled_on || typeof scheduled_on !== 'string') {
			return json({ ok: false, message: 'scheduled_on is required' }, { status: 400 });
		}

		// Fetch visit to get created_at, due_date, visit_number
		const { data: visit, error: visitError } = await supabase
			.from('visits')
			.select('id, created_at, due_date, visit_number')
			.eq('id', visitId)
			.single<VisitRow>();

		if (visitError || !visit) {
			console.error('Error fetching visit for scheduling:', visitError);
			return json({ ok: false, message: 'Could not validate visit constraints.' }, { status: 500 });
		}

		const { start, end } = getWindowBounds(visit);
		const selectedScheduledDate = toUtcStartOfDay(scheduled_on);

		// If the computed window is invalid (start > end), bail out
		if (start > end) {
			return json(
				{ ok: false, message: 'No valid OPD dates available for this visit.' },
				{ status: 400 }
			);
		}

		// Check window
		if (selectedScheduledDate < start || selectedScheduledDate > end) {
			return json(
				{ ok: false, message: 'Selected OPD date is outside allowed window.' },
				{ status: 400 }
			);
		}

		// Only Tue, Wed, Fri (2,3,5)
		if (![2, 3, 5].includes(selectedScheduledDate.getUTCDay())) {
			return json({ ok: false, message: 'Only Tue, Wed, Fri allowed.' }, { status: 400 });
		}

		// Update visit
		const { error: updateError } = await supabase
			.from('visits')
			.update({ scheduled_on })
			.eq('id', visitId);

		if (updateError) {
			console.error('Error updating visit scheduled_on:', updateError);
			return json({ ok: false, message: 'Failed saving appointment.' }, { status: 500 });
		}

		return json({ ok: true, scheduled_on });
	} catch (err) {
		console.error('Unexpected error in scheduling endpoint:', err);
		return json({ ok: false, message: 'Unexpected server error.' }, { status: 500 });
	}
};
