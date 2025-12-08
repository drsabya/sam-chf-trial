// src/routes/visits/visit7/[id]/+page.server.ts
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

	// 1) Visit 7
	const { data: visit, error: visitError } = await supabase
		.from('visits')
		.select(
			'id, participant_id, visit_number, created_at, scheduled_on, due_date, visit_date, voucher_given'
		)
		.eq('id', id)
		.single<VisitRow>();

	if (visitError || !visit) {
		console.error('Error fetching visit 7:', visitError);
		throw error(500, 'Could not load visit 7');
	}

	if (visit.visit_number !== 7) {
		console.warn('Visit 7 page loaded for a visit_number != 7', {
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
		console.error('Error fetching participant for visit 7:', participantError);
		throw error(500, 'Could not load participant for visit 7');
	}

	// 3) OPD options for Visit 7 based on due_date and 14-day grace period
	let opdOptions: string[] = [];

	if (visit.due_date) {
		const dueDate = toUtcStartOfDay(visit.due_date);
		const startDate = addUtcDays(dueDate, -14); // 14 days before due_date
		const endDate = dueDate; // up to actual due_date
		opdOptions = generateOpdOptions(startDate, endDate);
	} else {
		// Fallback: if due_date is missing, keep a sane window so UI doesn't break
		const fallbackStart = toUtcStartOfDay(
			visit.scheduled_on || visit.created_at || new Date().toISOString()
		);
		const fallbackEnd = addUtcDays(fallbackStart, 7);
		opdOptions = generateOpdOptions(fallbackStart, fallbackEnd);
		console.warn('Visit 7 has no due_date – using fallback window for OPD options', {
			visitId: visit.id
		});
	}

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
			.single<Pick<VisitRow, 'id' | 'created_at' | 'scheduled_on' | 'due_date'>>();

		if (visitError || !visit) {
			console.error('Error validating Visit 7 window:', visitError);
			return fail(500, { message: 'Could not validate Visit 7 window.' });
		}

		let startDate: Date;
		let endDate: Date;

		if (visit.due_date) {
			// Main rule: 14 days before due_date up to due_date
			const dueDate = toUtcStartOfDay(visit.due_date);
			startDate = addUtcDays(dueDate, -14);
			endDate = dueDate;
		} else {
			// Fallback if due_date somehow missing
			const fallbackStart = toUtcStartOfDay(visit.scheduled_on || visit.created_at || new Date());
			startDate = fallbackStart;
			endDate = addUtcDays(fallbackStart, 7);
			console.warn('Visit 7 has no due_date during update – using fallback window', {
				visitId: visit.id
			});
		}

		const selectedScheduledDate = toUtcStartOfDay(scheduled_on);

		if (selectedScheduledDate < startDate || selectedScheduledDate > endDate) {
			return fail(400, {
				message:
					'Selected OPD date is outside the allowed Visit 7 window (14 days before due date up to the due date).'
			});
		}

		// Tue (2), Wed (3), Fri (5)
		if (![2, 3, 5].includes(selectedScheduledDate.getUTCDay())) {
			return fail(400, { message: 'Only Tue, Wed, Fri are allowed for Visit 7 OPD.' });
		}

		const { error: updateError } = await supabase
			.from('visits')
			.update({ scheduled_on })
			.eq('id', id);

		if (updateError) {
			console.error('Error updating Visit 7 scheduled_on:', updateError);
			return fail(500, { message: 'Failed to save Visit 7 OPD date.' });
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
			console.error('Error updating voucher_given in Visit 7:', updateErr);
			return fail(500, { ok: false, message: 'Failed to update voucher' });
		}

		return { ok: true };
	},

	// Conclude Visit 7 → set visit_date (voucher already stored) and auto-create Visit 8
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
			console.error('Error fetching Visit 7 in conclude:', vErr);
			throw error(500, 'Could not conclude Visit 7');
		}

		// Require voucher to be decided before concluding
		if (visit.voucher_given === null) {
			return fail(400, {
				message: 'Please select voucher status before marking Visit 7 as completed.'
			});
		}

		const nowIso = new Date().toISOString();

		// Update visit_date for Visit 7 (voucher_given already saved via updateVoucher)
		const { error: updateErr } = await supabase
			.from('visits')
			.update({ visit_date: nowIso })
			.eq('id', id);

		if (updateErr) {
			console.error('Error updating Visit 7 on conclude:', updateErr);
			throw error(500, 'Could not mark Visit 7 as completed');
		}

		// Auto-create Visit 8 (relative logic handled in /apis/visits/create)
		try {
			const res = await fetch('/apis/visits/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					participantId: visit.participant_id,
					visitNumber: 8
				})
			});

			if (!res.ok) {
				let errBody: any = null;
				try {
					errBody = await res.json();
				} catch {
					// ignore JSON parse errors
				}
				console.error('Error auto-creating Visit 8:', res.status, errBody);
				// Don't throw → Visit 7 completion should still succeed
			}
		} catch (e) {
			console.error('Network error while auto-creating Visit 8:', e);
			// Don't throw
		}

		return { success: true, visit_date: nowIso, voucher_given: visit.voucher_given };
	}
};
