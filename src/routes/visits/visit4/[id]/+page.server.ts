// src/routes/visits/visit4/[id]/+page.server.ts
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
	voucher_given: boolean | null;
};

/* ---------------------------------------------
   DATE HELPERS
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

	// 1) Visit 4
	const { data: visit, error: visitError } = await supabase
		.from('visits')
		.select(
			'id, participant_id, visit_number, created_at, scheduled_on, due_date, visit_date, voucher_given'
		)
		.eq('id', id)
		.single<VisitRow>();

	if (visitError || !visit) {
		console.error('Error fetching visit 4:', visitError);
		throw error(500, 'Could not load visit 4');
	}

	if (visit.visit_number !== 4) {
		console.warn('Visit 4 page loaded for a visit_number != 4', {
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
		console.error('Error fetching participant for visit 4:', participantError);
		throw error(500, 'Could not load participant for visit 4');
	}

	// 3) OPD options for Visit 4
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
	// OPD scheduling update
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
			console.error('Error validating Visit 4 window:', visitError);
			return fail(500, { message: 'Could not validate Visit 4 window.' });
		}

		const startDate = toUtcStartOfDay(visit.scheduled_on || visit.created_at || new Date());
		const endDate = visit.due_date ? toUtcStartOfDay(visit.due_date) : addUtcDays(startDate, 7);

		const selectedScheduledDate = toUtcStartOfDay(scheduled_on);

		if (selectedScheduledDate < startDate || selectedScheduledDate > endDate) {
			return fail(400, {
				message: 'Selected OPD date is outside the allowed Visit 4 window.'
			});
		}

		// Tue (2), Wed (3), Fri (5)
		if (![2, 3, 5].includes(selectedScheduledDate.getUTCDay())) {
			return fail(400, { message: 'Only Tue, Wed, Fri are allowed for Visit 4 OPD.' });
		}

		const { error: updateError } = await supabase
			.from('visits')
			.update({ scheduled_on })
			.eq('id', id);

		if (updateError) {
			console.error('Error updating Visit 4 scheduled_on:', updateError);
			return fail(500, { message: 'Failed to save Visit 4 OPD date.' });
		}

		return { success: true };
	},

	// Auto-save voucher_given when radio is changed
	updateVoucher: async ({ request, params }) => {
		const id = params.id;
		if (!id) throw error(400, 'Visit ID is required');

		const formData = await request.formData();
		const voucher_status = formData.get('voucher_status') as string | null;

		if (!voucher_status) {
			return fail(400, { ok: false, message: 'voucher_status is required' });
		}

		const voucher_given =
			voucher_status === 'given' ? true : voucher_status === 'not_given' ? false : null;

		const { error: updateErr } = await supabase
			.from('visits')
			.update({ voucher_given })
			.eq('id', id);

		if (updateErr) {
			console.error('Error updating voucher_given in Visit 4:', updateErr);
			return fail(500, { ok: false, message: 'Failed to update voucher' });
		}

		return { ok: true };
	},

	// Conclude Visit 4 → set visit_date (voucher already stored) and auto-create Visit 5
	conclude: async ({ params, fetch }) => {
		const id = params.id;
		if (!id) throw error(400, 'Visit ID is required');

		// Fetch visit to get participant_id and voucher_given
		const { data: visit, error: vErr } = await supabase
			.from('visits')
			.select('id, participant_id, voucher_given')
			.eq('id', id)
			.single<{ id: string; participant_id: string; voucher_given: boolean | null }>();

		if (vErr || !visit) {
			console.error('Error fetching Visit 4 in conclude:', vErr);
			throw error(500, 'Could not conclude Visit 4');
		}

		// Require voucher to be decided before concluding
		if (visit.voucher_given === null) {
			return fail(400, {
				message: 'Please select voucher status before marking Visit 4 as completed.'
			});
		}

		const nowIso = new Date().toISOString();

		// Update visit_date for Visit 4 (voucher_given already saved via updateVoucher)
		const { error: updateErr } = await supabase
			.from('visits')
			.update({ visit_date: nowIso })
			.eq('id', id);

		if (updateErr) {
			console.error('Error updating Visit 4 on conclude:', updateErr);
			throw error(500, 'Could not mark Visit 4 as completed');
		}

		// Auto-create Visit 5 (relative logic handled in /apis/visits/create)
		try {
			const res = await fetch('/apis/visits/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					participantId: visit.participant_id,
					visitNumber: 5
				})
			});

			if (!res.ok) {
				let errBody: any = null;
				try {
					errBody = await res.json();
				} catch {
					// ignore JSON parse errors
				}
				console.error('Error auto-creating Visit 5:', res.status, errBody);
				// Don't throw → Visit 4 completion should still succeed
			}
		} catch (e) {
			console.error('Network error while auto-creating Visit 5:', e);
			// Don't throw
		}

		return { success: true, visit_date: nowIso, voucher_given: visit.voucher_given };
	}
};
