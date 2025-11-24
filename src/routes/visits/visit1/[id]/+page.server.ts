import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

// Updated Type to include screening_id
type ParticipantRow = {
	id: string;
	first_name: string | null;
	middle_name: string | null;
	last_name: string | null;
	phone: string | null;
	initials: string | null;
	screening_id: string | null; // Fixed: Added this field
};

type VisitRow = {
	id: string;
	participant_id: string;
	visit_number: number;
	created_at: string | null;
	due_date: string | null;
	scheduled_on: string | null;

	// Add these missing src fields
	ecg_src: string | null;
	echo_src: string | null;
	efficacy_src: string | null;
	safety_src: string | null;
};

/**
 * Normalizes a date to UTC Midnight.
 */
function toUtcStartOfDay(dateInput: Date | string): Date {
	const d = new Date(dateInput);
	if (isNaN(d.getTime())) return new Date();
	d.setUTCHours(0, 0, 0, 0);
	return d;
}

/**
 * Adds days in a UTC-safe way.
 */
function addUtcDays(base: Date, days: number): Date {
	const d = new Date(base);
	d.setUTCDate(d.getUTCDate() + days);
	return d;
}

/**
 * Generates YYYY-MM-DD strings for Tue (2), Wed (3), Fri (5).
 */
function generateOpdOptions(start: Date, end: Date): string[] {
	const TARGET_DAYS = [2, 3, 5];
	const options: string[] = [];

	let cursor = toUtcStartOfDay(start);
	const last = toUtcStartOfDay(end);

	if (cursor > last) return [];

	while (cursor.getTime() <= last.getTime()) {
		const day = cursor.getUTCDay();
		if (TARGET_DAYS.includes(day)) {
			options.push(cursor.toISOString().slice(0, 10));
		}
		cursor = addUtcDays(cursor, 1);
	}

	return options;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id;
	if (!id) throw error(400, 'Visit ID is required');

	// 1. Fetch visit
	const { data: visit, error: visitError } = await supabase
		.from('visits')
		.select('*')
		.eq('id', id)
		.single<VisitRow>();
	if (visitError || !visit) {
		console.error('Error fetching visit:', visitError);
		throw error(500, 'Could not load visit');
	}

	// 2. Fetch participant (Ensure screening_id is selected)
	const { data: participant, error: participantError } = await supabase
		.from('participants')
		.select('id, first_name, middle_name, last_name, phone, initials, screening_id')
		.eq('id', visit.participant_id)
		.single<ParticipantRow>();

	if (participantError || !participant) {
		console.error('Error fetching participant:', participantError);
		throw error(500, 'Could not load participant');
	}

	// 3. Logic
	const createdAtRaw = visit.created_at || new Date().toISOString();
	const startDate = toUtcStartOfDay(createdAtRaw);

	const dueDateRaw = visit.due_date ? visit.due_date : addUtcDays(startDate, 14).toISOString();

	const endDate = toUtcStartOfDay(dueDateRaw);

	const opdOptions = generateOpdOptions(startDate, endDate);

	return {
		visit,
		participant,
		opdOptions
	};
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const id = params.id;
		if (!id) throw error(400, 'Visit ID is required');

		const formData = await request.formData();
		const scheduled_on = formData.get('scheduled_on');

		if (typeof scheduled_on !== 'string' || !scheduled_on) {
			return fail(400, { message: 'Please select an OPD date.' });
		}

		const { data: visit, error: visitError } = await supabase
			.from('visits')
			.select('id, created_at, due_date')
			.eq('id', id)
			.single<Pick<VisitRow, 'id' | 'created_at' | 'due_date'>>();

		if (visitError || !visit) {
			return fail(500, { message: 'Could not validate visit constraints.' });
		}

		const startDate = toUtcStartOfDay(visit.created_at || new Date());
		const endDate = visit.due_date ? toUtcStartOfDay(visit.due_date) : addUtcDays(startDate, 14);

		const selectedDate = toUtcStartOfDay(scheduled_on);

		if (
			selectedDate.getTime() < startDate.getTime() ||
			selectedDate.getTime() > endDate.getTime()
		) {
			return fail(400, {
				message: 'Selected date is outside the allowed window.'
			});
		}

		const day = selectedDate.getUTCDay();
		if (![2, 3, 5].includes(day)) {
			return fail(400, {
				message: 'OPD visits are only allowed on Tue, Wed, or Fri.'
			});
		}

		const { error: updateError } = await supabase
			.from('visits')
			.update({ scheduled_on })
			.eq('id', id);

		if (updateError) {
			return fail(500, { message: 'Failed to save appointment date.' });
		}

		return { success: true, message: 'Appointment confirmed.' };
	}
};
