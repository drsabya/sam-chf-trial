// src/routes/participants/[id]/visits/+page.server.ts
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
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
	screening_failure: boolean | null;
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

export const load: PageServerLoad = async ({ params }) => {
	const participantId = params.id;

	if (!participantId) {
		throw error(400, 'Participant ID is required');
	}

	// Fetch participant
	const {
		data: participant,
		error: participantError
	} = await supabase
		.from('participants')
		.select(
			`
      id,
      first_name,
      middle_name,
      last_name,
      phone,
      initials,
      screening_id,
      randomization_id,
      screening_failure
    `
		)
		.eq('id', participantId)
		.single<ParticipantRow>();

	if (participantError || !participant) {
		throw error(404, 'Participant not found');
	}

	// Fetch visits for this participant
	const {
		data: visits,
		error: visitsError
	} = await supabase
		.from('visits')
		.select(
			`
      id,
      participant_id,
      visit_number,
      created_at,
      scheduled_on,
      due_date,
      visit_date,
      voucher_given
    `
		)
		.eq('participant_id', participantId)
		.order('visit_number', { ascending: true })
		.returns<VisitRow[]>();

	if (visitsError) {
		throw error(500, 'Failed to load visits');
	}

	return {
		participant,
		visits: visits ?? []
	};
};
