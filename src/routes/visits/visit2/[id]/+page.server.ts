// src/routes/visits/visit2/[id]/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

type ParticipantRow = {
	id: string;
	first_name: string | null;
	middle_name: string | null;
	last_name: string | null;
	phone: string | null;
	initials: string | null;
	screening_id: string | null;
	randomization_id: string | null;
	randomization_code: string | null;
};

type VisitRow = {
	id: string;
	participant_id: string;
	visit_number: number;
	created_at: string | null;
	scheduled_on: string | null;
	due_date: string | null;
	visit_date: string | null;
	efficacy_src: string | null;

	gsh: number | null;
	tnf_alpha: number | null;
	il6: number | null;
	same: number | null;
	sah: number | null;
	five_methylcytosine: number | null;
};

/* ---------------------------------------------
   DATE HELPERS (same style as Visit 1)
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

function generateOpdOptions(start: Date, end: Date): string[] {
	const TARGET_DAYS = [2, 3, 5]; // Tue, Wed, Fri
	const options: string[] = [];

	let cursor = toUtcStartOfDay(start);
	const last = toUtcStartOfDay(end);

	if (cursor > last) return [];

	while (cursor.getTime() <= last.getTime()) {
		if (TARGET_DAYS.includes(cursor.getUTCDay())) {
			// store as bare date (YYYY-MM-DD)
			options.push(cursor.toISOString().slice(0, 10));
		}
		cursor = addUtcDays(cursor, 1);
	}

	return options;
}

/* ---------------------------------------------
   LOAD
--------------------------------------------- */

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id;
	if (!id) throw error(400, 'Visit ID is required');

	// 1) Visit
	const { data: visit, error: visitError } = await supabase
		.from('visits')
		.select(
			'id, participant_id, visit_number, created_at, scheduled_on, due_date, visit_date, efficacy_src, gsh, tnf_alpha, il6, same, sah, five_methylcytosine'
		)
		.eq('id', id)
		.single<VisitRow>();

	if (visitError || !visit) {
		console.error('Error fetching visit 2:', visitError);
		throw error(500, 'Could not load visit 2');
	}

	if (visit.visit_number !== 2) {
		console.warn('Visit 2 page loaded for a visit_number != 2', {
			visitId: visit.id,
			visit_number: visit.visit_number
		});
	}

	// 2) Participant
	const { data: participant, error: participantError } = await supabase
		.from('participants')
		.select(
			'id, first_name, middle_name, last_name, phone, initials, screening_id, randomization_id, randomization_code'
		)
		.eq('id', visit.participant_id)
		.single<ParticipantRow>();

	if (participantError || !participant) {
		console.error('Error fetching participant for visit 2:', participantError);
		throw error(500, 'Could not load participant for visit 2');
	}

	// 3) OPD options for Visit 2:
	//    - use the protocol window (scheduled_on .. due_date)
	//    - but restrict to Tue, Wed, Fri
	const startRaw = visit.scheduled_on || visit.created_at || new Date().toISOString();
	const startDate = toUtcStartOfDay(startRaw);

	const dueRaw = visit.due_date ? visit.due_date : addUtcDays(startDate, 7).toISOString(); // fallback 7d window
	const endDate = toUtcStartOfDay(dueRaw);

	const opdOptions = generateOpdOptions(startDate, endDate);

	return {
		visit,
		participant,
		opdOptions
	};
};

/* ---------------------------------------------
   ACTIONS
--------------------------------------------- */

export const actions: Actions = {
	update: async ({ request, params }) => {
		const id = params.id;
		if (!id) throw error(400, 'Visit ID is required');

		const formData = await request.formData();
		const scheduled_on = formData.get('scheduled_on');

		if (typeof scheduled_on !== 'string' || !scheduled_on) {
			return fail(400, { message: 'Please select an OPD date.' });
		}

		// Re-fetch visit to validate window
		const { data: visit, error: visitError } = await supabase
			.from('visits')
			.select('id, created_at, scheduled_on, due_date')
			.eq('id', id)
			.single();

		if (visitError || !visit) {
			console.error('Error validating visit 2 window:', visitError);
			return fail(500, { message: 'Could not validate Visit 2 window.' });
		}

		// For Visit 2, we use the protocol window (existing scheduled_on .. due_date)
		const startDate = toUtcStartOfDay(visit.scheduled_on || visit.created_at || new Date());
		const endDate = visit.due_date ? toUtcStartOfDay(visit.due_date) : addUtcDays(startDate, 7);

		const selectedScheduledDate = toUtcStartOfDay(scheduled_on);

		if (selectedScheduledDate < startDate || selectedScheduledDate > endDate) {
			return fail(400, {
				message: 'Selected OPD date is outside the allowed Visit 2 window.'
			});
		}

		// Tue (2), Wed (3), Fri (5)
		if (![2, 3, 5].includes(selectedScheduledDate.getUTCDay())) {
			return fail(400, { message: 'Only Tue, Wed, Fri are allowed for Visit 2 OPD.' });
		}

		const { error: updateError } = await supabase
			.from('visits')
			.update({ scheduled_on })
			.eq('id', id);

		if (updateError) {
			console.error('Error updating Visit 2 scheduled_on:', updateError);
			return fail(500, { message: 'Failed to save Visit 2 OPD date.' });
		}

		return { success: true };
	},

	// ---------------------------------------------
	// CONCLUDE VISIT 2 & AUTO-CREATE VISIT 3
	// ---------------------------------------------
	conclude: async ({ params, fetch }) => {
		const id = params.id;
		if (!id) throw error(400, 'Visit ID is required');

		// 1) Fetch visit to get participant_id
		const { data: visit, error: visitError } = await supabase
			.from('visits')
			.select('id, participant_id')
			.eq('id', id)
			.single<Pick<VisitRow, 'id' | 'participant_id'>>();

		if (visitError || !visit) {
			console.error('Error fetching visit 2 in conclude:', visitError);
			throw error(500, 'Could not conclude Visit 2');
		}

		const participantId = visit.participant_id;
		const nowIso = new Date().toISOString();

		// 2) Mark Visit 2 as completed (set visit_date = now)
		const { error: updateError } = await supabase
			.from('visits')
			.update({ visit_date: nowIso })
			.eq('id', id);

		if (updateError) {
			console.error('Error setting visit_date for Visit 2:', updateError);
			throw error(500, 'Could not mark Visit 2 as completed');
		}

		// 3) Auto-create Visit 3 via the existing API
		let visit3Created = false;
		try {
			const res = await fetch('/apis/visits/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					participantId,
					visitNumber: 3
				})
			});

			if (!res.ok) {
				let errBody: any = null;
				try {
					errBody = await res.json();
				} catch {
					// ignore JSON parse errors
				}
				console.error('Error auto-creating Visit 3:', res.status, errBody);
			} else {
				const body = await res.json().catch(() => null);
				if (body?.visit?.id) {
					visit3Created = true;
				}
			}
		} catch (e) {
			console.error('Network error while auto-creating Visit 3:', e);
			// Do not throw – Visit 2 completion should still succeed
		}

		return { success: true, visit3Created };
	}
};
