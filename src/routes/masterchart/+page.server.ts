// src/routes/master-chart/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export type ParticipantRow = {
	id: string;
	first_name: string | null;
	middle_name: string | null;
	last_name: string | null;
	screening_id: string | null;
	randomization_id: string | null;
	randomization_code: string | null;
};

export type VisitRow = {
	participant_id: string;
	visit_number: number;

	// Core variables
	height_cm: number | null;
	weight_kg: number | null;
	bmi: number | null;
	history: string | null;
	temperature_c: number | null;
	pulse_rate: number | null;
	bp_systolic: number | null;
	bp_diastolic: number | null;
	respiratory_rate: number | null;
	cvs: string | null;
	cns: string | null;
	rs: string | null;
	pa: string | null;
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
	concomitant_medications: string | null;
	concomitant_illness: string | null;
	compliance_self_report_percent: number | null;
	compliance_self_report_notes: string | null;
	nt_pro_bnp: number | null;
	serum_tsh: number | null;
	serum_homocysteine: number | null;
	gsh: number | null;
	tnf_alpha: number | null;
	il6: number | null;
	same: number | null;
	sah: number | null;
	five_methylcytosine: number | null;
	ecg: string | null;
	echo_lvef: number | null;
	hfss_score: number | null;
	mlfhq_score: number | null;
	hospitalizations_cardiac: number | null;
	hospitalizations_noncardiac: number | null;
	worsening_hf_events: number | null;
};

export const load: PageServerLoad = async () => {
	// 1) Load all participants with screening_id
	// Includes randomization_id and randomization_code
	const { data: participantsData, error: participantsError } = await supabase
		.from('participants')
		.select(
			'id, first_name, middle_name, last_name, screening_id, randomization_id, randomization_code'
		)
		.not('screening_id', 'is', null as any)
		.order('screening_id', { ascending: true });

	if (participantsError) {
		console.error('Error loading participants for master chart:', {
			message: participantsError.message,
			details: (participantsError as any)?.details,
			hint: (participantsError as any)?.hint,
			code: (participantsError as any)?.code
		});
		throw error(500, 'Failed to load master chart');
	}

	const participants = (participantsData ?? []) as ParticipantRow[];

	// If no participants, skip loading visits
	if (participants.length === 0) {
		return {
			participants,
			visits: [] as VisitRow[]
		};
	}

	const participantIds = participants.map((p) => p.id);

	// 2) Load visits (1–8) for these participants with all core variables
	const { data: visitsData, error: visitsError } = await supabase
		.from('visits')
		.select(
			[
				'participant_id',
				'visit_number',
				'height_cm',
				'weight_kg',
				'bmi',
				'history',
				'temperature_c',
				'pulse_rate',
				'bp_systolic',
				'bp_diastolic',
				'respiratory_rate',
				'cvs',
				'cns',
				'rs',
				'pa',
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
				'triglycerides',
				'concomitant_medications',
				'concomitant_illness',
				'compliance_self_report_percent',
				'compliance_self_report_notes',
				'nt_pro_bnp',
				'serum_tsh',
				'serum_homocysteine',
				'gsh',
				'tnf_alpha',
				'il6',
				'same',
				'sah',
				'five_methylcytosine',
				'ecg',
				'echo_lvef',
				'hfss_score',
				'mlfhq_score',
				'hospitalizations_cardiac',
				'hospitalizations_noncardiac',
				'worsening_hf_events'
			].join(', ')
		)
		.in('participant_id', participantIds)
		.gte('visit_number', 1)
		.lte('visit_number', 8)
		.order('participant_id', { ascending: true })
		.order('visit_number', { ascending: true });

	if (visitsError) {
		console.error('Error loading visits for master chart:', {
			message: visitsError.message,
			details: (visitsError as any)?.details,
			hint: (visitsError as any)?.hint,
			code: (visitsError as any)?.code
		});
		throw error(500, 'Failed to load visits for master chart');
	}

	// Cast via unknown to avoid the GenericStringError[] complaint from TS
	const visits = (visitsData ?? []) as unknown as VisitRow[];

	return {
		participants,
		visits
	};
};

// 🔽 NEW: action to update randomization_code
export const actions: Actions = {
	updateRandomizationCode: async ({ request }) => {
		const formData = await request.formData();
		const participant_id = formData.get('participant_id');
		const randomization_code_raw = formData.get('randomization_code');

		if (typeof participant_id !== 'string' || !participant_id) {
			return fail(400, {
				error: 'Invalid participant id'
			});
		}

		let code: string | null = null;
		if (typeof randomization_code_raw === 'string') {
			const trimmed = randomization_code_raw.trim().toLowerCase();
			// allow empty (clear), or 'a' / 'b'
			if (trimmed === 'a' || trimmed === 'b') {
				code = trimmed;
			} else if (trimmed === '') {
				code = null;
			} else {
				return fail(400, {
					error: 'Randomization code must be "a" or "b"'
				});
			}
		}

		const { error: updateError } = await supabase
			.from('participants')
			.update({ randomization_code: code })
			.eq('id', participant_id);

		if (updateError) {
			console.error('Error updating randomization_code:', {
				message: updateError.message,
				details: (updateError as any)?.details,
				hint: (updateError as any)?.hint,
				code: (updateError as any)?.code
			});

			return fail(500, {
				error: 'Failed to update randomization code'
			});
		}

		return {
			success: true,
			participant_id,
			randomization_code: code
		};
	}
};
