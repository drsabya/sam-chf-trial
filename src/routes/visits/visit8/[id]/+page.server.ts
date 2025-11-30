// src/routes/visits/visit8/[id]/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

/* ---------------------------------------------
   TYPES
--------------------------------------------- */

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

	echo_src: string | null;
	ecg_src: string | null;
	efficacy_src: string | null;
	safety_src: string | null;

	echo_lvef: number | null;

	// efficacy Visit 8
	nt_pro_bnp: number | null;
	serum_tsh: number | null;
	serum_homocysteine: number | null;
	gsh: number | null;
	tnf_alpha: number | null;
	il6: number | null;
	same: number | null;
	sah: number | null;
	five_methylcytosine: number | null;

	// safety
	hb: number | null;
	rbcs: number | null;
	wbcs: number | null;
	polymorphs: number | null;
	lymphocytes: number | null;
	monocytes: number | null;
	platelets: number | null;
	sgot_ast: number | null;
	sgpt_alt: number | null;
	bilirubin_total: number | null;
	bilirubin_direct: number | null;
	bilirubin_indirect: number | null;
	bun: number | null;
	serum_creatinine: number | null;
	total_cholesterol: number | null;
	hdl: number | null;
	ldl: number | null;
	triglycerides: number | null;
};

/* ---------------------------------------------
   DATE HELPERS — same as Visit 6
--------------------------------------------- */

function toUtcStartOfDay(dateInput: Date | string): Date {
	const d = new Date(dateInput);
	if (Number.isNaN(d.getTime())) return new Date();
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
	const opts: string[] = [];

	let cur = toUtcStartOfDay(start);
	const last = toUtcStartOfDay(end);

	if (cur > last) return [];

	while (cur.getTime() <= last.getTime()) {
		if (TARGET_DAYS.includes(cur.getUTCDay())) {
			opts.push(cur.toISOString().slice(0, 10));
		}
		cur = addUtcDays(cur, 1);
	}
	return opts;
}

/* ---------------------------------------------
   LOAD VISIT 8
--------------------------------------------- */

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id;
	if (!id) throw error(400, 'Visit ID is required');

	const { data: visit, error: visitErr } = await supabase
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
				'echo_src',
				'ecg_src',
				'efficacy_src',
				'safety_src',
				'echo_lvef',

				// Visit 8 efficacy
				'nt_pro_bnp',
				'serum_tsh',
				'serum_homocysteine',
				'gsh',
				'tnf_alpha',
				'il6',
				'same',
				'sah',
				'five_methylcytosine',

				// safety
				'hb',
				'rbcs',
				'wbcs',
				'polymorphs',
				'lymphocytes',
				'monocytes',
				'platelets',
				'sgot_ast',
				'sgpt_alt',
				'bilirubin_total',
				'bilirubin_direct',
				'bilirubin_indirect',
				'bun',
				'serum_creatinine',
				'total_cholesterol',
				'hdl',
				'ldl',
				'triglycerides'
			].join(', ')
		)
		.eq('id', id)
		.single<VisitRow>();

	if (visitErr || !visit) {
		console.error('Error loading Visit 8:', visitErr);
		throw error(500, 'Could not load Visit 8');
	}

	if (visit.visit_number !== 8) {
		console.warn('Visit 8 page opened for non-visit-8 row:', {
			visitId: visit.id,
			visit_number: visit.visit_number
		});
	}

	// Participant
	const { data: participant, error: pErr } = await supabase
		.from('participants')
		.select(
			'id, first_name, middle_name, last_name, phone, initials, screening_id, randomization_id'
		)
		.eq('id', visit.participant_id)
		.single<ParticipantRow>();

	if (pErr || !participant) {
		console.error('Participant fetch failed for Visit 8:', pErr);
		throw error(500, 'Could not load participant for Visit 8');
	}

	// OPD window — same logic as Visit 6
	const startRaw = visit.scheduled_on || visit.created_at || new Date().toISOString();
	const start = toUtcStartOfDay(startRaw);
	const end = visit.due_date ? toUtcStartOfDay(visit.due_date) : addUtcDays(start, 7);

	const opdOptions = generateOpdOptions(start, end);

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
		if (!id) throw error(400, 'Visit ID required');

		const fd = await request.formData();
		const scheduled_on = fd.get('scheduled_on');

		if (!scheduled_on || typeof scheduled_on !== 'string') {
			return fail(400, { message: 'Select a valid OPD date.' });
		}

		// validate window
		const { data: visit, error: vErr } = await supabase
			.from('visits')
			.select('scheduled_on, created_at, due_date')
			.eq('id', id)
			.single<{
				scheduled_on: string | null;
				created_at: string | null;
				due_date: string | null;
			}>();

		if (vErr || !visit) {
			console.error('Visit 8 window validation fetch error:', vErr);
			return fail(500, { message: 'Could not validate Visit 8 window.' });
		}

		const start = toUtcStartOfDay(visit.scheduled_on || visit.created_at || new Date());
		const end = visit.due_date ? toUtcStartOfDay(visit.due_date) : addUtcDays(start, 7);
		const sel = toUtcStartOfDay(scheduled_on);

		if (sel < start || sel > end) {
			return fail(400, { message: 'Selected date is outside allowed Visit 8 window.' });
		}

		if (![2, 3, 5].includes(sel.getUTCDay())) {
			return fail(400, { message: 'Only Tue, Wed, Fri are allowed for Visit 8 OPD.' });
		}

		const { error: updErr } = await supabase.from('visits').update({ scheduled_on }).eq('id', id);

		if (updErr) {
			console.error('Visit 8 OPD update error:', updErr);
			return fail(500, { message: 'Could not save OPD date.' });
		}

		return { success: true };
	},

	conclude: async ({ params }) => {
		const id = params.id;
		if (!id) throw error(400, 'Visit ID required');

		const nowIso = new Date().toISOString();

		const { error: updErr } = await supabase
			.from('visits')
			.update({ visit_date: nowIso })
			.eq('id', id);

		if (updErr) {
			console.error('Visit 8 conclude error:', updErr);
			throw error(500, 'Could not mark Visit 8 as completed');
		}

		// No Visit 9 auto-creation here
		return { success: true, visit_date: nowIso };
	}
};
