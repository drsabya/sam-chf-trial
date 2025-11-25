// src/routes/apis/visits/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

/**
 * Utility: add N calendar days to a Date (without mutating the original).
 */
function addDays(base: Date, days: number): Date {
	const d = new Date(base);
	d.setDate(d.getDate() + days);
	return d;
}

/**
 * Utility: safely parse a DB timestamp into a JS Date.
 */
function toDate(value: string | null): Date | null {
	if (!value) return null;
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

/**
 * Fetch the previous visit's visit_date for a given participant.
 * We require that:
 *  - the previous visit row exists
 *  - visit_date is not null (i.e. the visit has been completed)
 */
async function getPreviousVisitDate(
	participantId: string,
	prevVisitNumber: number
): Promise<Date | null> {
	const { data, error } = await supabase
		.from('visits')
		.select('visit_date')
		.eq('participant_id', participantId)
		.eq('visit_number', prevVisitNumber)
		.single();

	if (error || !data) {
		console.error('Previous visit not found:', { participantId, prevVisitNumber, error });
		return null;
	}

	const visitDate = toDate(data.visit_date);
	if (!visitDate) {
		console.error('Previous visit has no visit_date (not completed yet):', {
			participantId,
			prevVisitNumber
		});
		return null;
	}

	return visitDate;
}

export const POST: RequestHandler = async ({ request }) => {
	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const participantId = body?.participantId as string | undefined;
	const visitNumber = body?.visitNumber as number | undefined;

	if (!participantId) {
		return json({ error: 'participantId is required' }, { status: 400 });
	}

	if (
		typeof visitNumber !== 'number' ||
		!Number.isInteger(visitNumber) ||
		visitNumber < 1 ||
		visitNumber > 8
	) {
		return json({ error: 'visitNumber must be an integer between 1 and 8' }, { status: 400 });
	}

	// -----------------------------------------------------------------------
	// Compute scheduled_on and due_date according to protocol rules
	// -----------------------------------------------------------------------
	let scheduledOn: Date;
	let dueDate: Date;

	if (visitNumber === 1) {
		/**
		 * VISIT 1 (Screening; day -14 to day 0)
		 *
		 * - We create Visit 1 when starting screening.
		 * - scheduled_on = "today" (when visit is being scheduled/created).
		 * - due_date     = scheduled_on + 14 days.
		 *   → This gives a 14-day window to actually perform screening.
		 */
		scheduledOn = new Date();
		dueDate = addDays(scheduledOn, 14);
	} else if (visitNumber === 2) {
		/**
		 * VISIT 2 (Day 1 ± 7)
		 *
		 * - Must be based on Visit 1's visit_date (i.e. after Visit 1 is completed).
		 * - scheduled_on = visit_date(Visit 1) + 1 day.
		 * - due_date     = scheduled_on + 7 days.
		 */
		const prevDate = await getPreviousVisitDate(participantId, 1);
		if (!prevDate) {
			return json(
				{ error: 'Cannot schedule Visit 2 before Visit 1 is completed (visit_date missing).' },
				{ status: 400 }
			);
		}

		scheduledOn = addDays(prevDate, 1);
		dueDate = addDays(scheduledOn, 7);
	} else if (visitNumber >= 3 && visitNumber <= 5) {
		/**
		 * VISITS 3, 4, 5
		 *  - Each is scheduled relative to the *previous* visit's visit_date.
		 *  - scheduled_on = previous visit_date + 30 days.
		 *  - due_date     = scheduled_on + 7 days.
		 *
		 * Examples:
		 *  - Visit 3: 30 days after Visit 2 visit_date, due within 7 days.
		 *  - Visit 4: 30 days after Visit 3 visit_date, due within 7 days.
		 *  - Visit 5: 30 days after Visit 4 visit_date, due within 7 days.
		 */
		const prevVisitNumber = visitNumber - 1;
		const prevDate = await getPreviousVisitDate(participantId, prevVisitNumber);
		if (!prevDate) {
			return json(
				{
					error: `Cannot schedule Visit ${visitNumber} before Visit ${prevVisitNumber} is completed (visit_date missing).`
				},
				{ status: 400 }
			);
		}

		scheduledOn = addDays(prevDate, 30);
		dueDate = addDays(scheduledOn, 7);
	} else {
		/**
		 * VISITS 6, 7, 8
		 *  - Each is scheduled relative to the *previous* visit's visit_date.
		 *  - scheduled_on = previous visit_date + 90 days.
		 *  - due_date     = scheduled_on + 14 days.
		 *
		 * Examples:
		 *  - Visit 6: 90 days after Visit 5 visit_date, due within 14 days.
		 *  - Visit 7: 90 days after Visit 6 visit_date, due within 14 days.
		 *  - Visit 8: 90 days after Visit 7 visit_date, due within 14 days.
		 */
		const prevVisitNumber = visitNumber - 1;
		const prevDate = await getPreviousVisitDate(participantId, prevVisitNumber);
		if (!prevDate) {
			return json(
				{
					error: `Cannot schedule Visit ${visitNumber} before Visit ${prevVisitNumber} is completed (visit_date missing).`
				},
				{ status: 400 }
			);
		}

		scheduledOn = addDays(prevDate, 90);
		dueDate = addDays(scheduledOn, 14);
	}

	// -----------------------------------------------------------------------
	// Insert the visit row in Supabase
	// -----------------------------------------------------------------------
	const { data, error } = await supabase
		.from('visits')
		.insert({
			participant_id: participantId,
			visit_number: visitNumber,
			scheduled_on: scheduledOn.toISOString(),
			due_date: dueDate.toISOString()
		})
		.select('id, participant_id, visit_number, scheduled_on, due_date, visit_date')
		.single();

	if (error || !data) {
		console.error('Error creating visit:', error);
		return json({ error: 'Could not create visit' }, { status: 500 });
	}

	return json({ visit: data });
};
