// src/routes/participants/[id]/create-visit/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const supabase = locals.supabase;
	const participantId = params.id;

	if (!participantId) {
		throw error(400, 'Participant ID is required');
	}

	// Fetch participant
	const { data: participant, error: pErr } = await supabase
		.from('participants')
		.select('*')
		.eq('id', participantId)
		.single();

	if (pErr || !participant) {
		console.error('Error loading participant:', pErr);
		throw error(404, 'Participant not found');
	}

	// Fetch visits
	const { data: visits, error: vErr } = await supabase
		.from('visits')
		.select('*')
		.eq('participant_id', participantId)
		.order('visit_number', { ascending: true });

	if (vErr) {
		console.error('Error loading visits:', vErr);
		throw error(500, 'Could not load visits');
	}

	return {
		participant,
		visits: visits ?? []
	};
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		const supabase = locals.supabase;
		const participantId = params.id;

		if (!participantId) {
			throw error(400, 'Participant ID is required');
		}

		const formData = await request.formData();

		const visit_number_raw = formData.get('visit_number');
		const visit_date_raw = formData.get('visit_date');

		const visit_number = Number(visit_number_raw);
		const visit_date = visit_date_raw ? String(visit_date_raw) : null;

		// Validation
		if (!visit_number || Number.isNaN(visit_number)) {
			return fail(400, {
				error: 'Visit number must be a valid integer.',
				values: { visit_number: visit_number_raw, visit_date }
			});
		}

		// Insert visit
		const { error: dbError } = await supabase.from('visits').insert({
			participant_id: participantId,
			visit_number,
			visit_date: visit_date || null
		});

		if (dbError) {
			console.error('Error creating visit:', dbError);

			let msg = 'Could not create visit.';
			if ((dbError as any)?.code === '23505') {
				msg = `Visit number ${visit_number} already exists for this participant.`;
			}

			return fail(500, {
				error: msg,
				values: { visit_number, visit_date }
			});
		}

		// ✅ Stay on the same page; show success message & clear form
		return {
			success: true,
			message: `Visit ${visit_number} created successfully.`,
			values: {
				visit_number: '',
				visit_date: ''
			}
		};
	}
};
