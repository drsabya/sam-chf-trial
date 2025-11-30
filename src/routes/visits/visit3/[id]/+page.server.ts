// src/routes/visits/visit3/[id]/+page.server.ts
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
	serum_homocysteine: number | null;
};

/* ---------------------------------------------
   DATE HELPERS (same style as Visit 1 & 2)
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
			options.push(cursor.toISOString().slice(0, 10)); // YYYY-MM-DD
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

	// 1) Visit 3
	const { data: visit, error: visitError } = await supabase
		.from('visits')
		.select(
			[
				'id',
				'participant_id',
				'visit_number',
				'created_at',
				'scheduled_on',
				'due_date',
				'visit_date',
				'efficacy_src',
				'gsh',
				'tnf_alpha',
				'il6',
				'same',
				'sah',
				'five_methylcytosine',
				'serum_homocysteine'
			].join(', ')
		)
		.eq('id', id)
		.single<VisitRow>();

	if (visitError || !visit) {
		console.error('Error fetching visit 3:', visitError);
		throw error(500, 'Could not load visit 3');
	}

	if (visit.visit_number !== 3) {
		console.warn('Visit 3 page loaded for a visit_number != 3', {
			visitId: visit.id,
			visit_number: visit.visit_number
		});
	}

	// 2) Participant
	const { data: participant, error: participantError } = await supabase
		.from('participants')
		.select(
			'id, first_name, middle_name, last_name, phone, initials, screening_id, randomization_id'
		)
		.eq('id', visit.participant_id)
		.single<ParticipantRow>();

	if (participantError || !participant) {
		console.error('Error fetching participant for visit 3:', participantError);
		throw error(500, 'Could not load participant for visit 3');
	}

	// 3) OPD options for Visit 3:
	//    use the protocol window (scheduled_on .. due_date), restricted to Tue, Wed, Fri
	const startRaw = visit.scheduled_on || visit.created_at || new Date().toISOString();
	const startDate = toUtcStartOfDay(startRaw);

	const dueRaw = visit.due_date ? visit.due_date : addUtcDays(startDate, 7).toISOString();
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
	// Update OPD date (same pattern as Visit 2)
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
			console.error('Error validating Visit 3 window:', visitError);
			return fail(500, { message: 'Could not validate Visit 3 window.' });
		}

		const startDate = toUtcStartOfDay(visit.scheduled_on || visit.created_at || new Date());
		const endDate = visit.due_date ? toUtcStartOfDay(visit.due_date) : addUtcDays(startDate, 7);

		const selectedScheduledDate = toUtcStartOfDay(scheduled_on);

		if (selectedScheduledDate < startDate || selectedScheduledDate > endDate) {
			return fail(400, {
				message: 'Selected OPD date is outside the allowed Visit 3 window.'
			});
		}

		// Tue (2), Wed (3), Fri (5)
		if (![2, 3, 5].includes(selectedScheduledDate.getUTCDay())) {
			return fail(400, { message: 'Only Tue, Wed, Fri are allowed for Visit 3 OPD.' });
		}

		const { error: updateError } = await supabase
			.from('visits')
			.update({ scheduled_on })
			.eq('id', id);

		if (updateError) {
			console.error('Error updating Visit 3 scheduled_on:', updateError);
			return fail(500, { message: 'Failed to save Visit 3 OPD date.' });
		}

		return { success: true };
	},

	// Conclude Visit 3 → set visit_date = today & auto-create Visit 4
	conclude: async ({ params, fetch }) => {
		const id = params.id;
		if (!id) throw error(400, 'Visit ID is required');

		// Fetch visit to get participant_id
		const { data: visit, error: vErr } = await supabase
			.from('visits')
			.select('id, participant_id, visit_date, visit_number')
			.eq('id', id)
			.single<{
				id: string;
				participant_id: string;
				visit_date: string | null;
				visit_number: number;
			}>();

		if (vErr || !visit) {
			console.error('Error fetching visit 3 in conclude:', vErr);
			throw error(500, 'Could not conclude Visit 3');
		}

		const nowIso = new Date().toISOString();

		// Update visit_date for Visit 3
		const { error: updateErr } = await supabase
			.from('visits')
			.update({ visit_date: nowIso })
			.eq('id', id);

		if (updateErr) {
			console.error('Error updating visit_date for Visit 3:', updateErr);
			throw error(500, 'Could not mark Visit 3 as completed');
		}

		// Auto-create Visit 4 via API (relative scheduling based on Visit 3 visit_date)
		try {
			const res = await fetch('/apis/visits/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					participantId: visit.participant_id,
					visitNumber: 4
				})
			});

			if (!res.ok) {
				let errBody: any = null;
				try {
					errBody = await res.json();
				} catch {
					// ignore JSON parse errors
				}
				console.error('Error auto-creating Visit 4:', res.status, errBody);
				// do not throw → Visit 3 completion should still succeed
			}
		} catch (e) {
			console.error('Network error while auto-creating Visit 4:', e);
			// also do not throw
		}

		return { success: true, visit_date: nowIso };
	}
};
