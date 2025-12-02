// src/routes/+page.server.ts
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/supabaseClient';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	// 1) Get all visits that have a due_date and are not yet performed
	const { data: visitsRaw, error: visitsError } = await supabase
		.from('visits')
		.select(
			'id, participant_id, visit_number, scheduled_on, due_date, visit_date, withdrawn, death'
		)
		.not('due_date', 'is', null as any)
		.is('visit_date', null)
		.order('due_date', { ascending: true });

	if (visitsError) {
		console.error('Error loading visits:', visitsError);
		throw error(500, 'Failed to load visits');
	}

	// 2) JS filter — now ONLY remove visits that are withdrawn or dead
	const activeVisits =
		(visitsRaw ?? []).filter((v) => v.withdrawn !== true && v.death !== true) ?? [];

	// 3) Fetch participant details (including status flags)
	const participantIds = Array.from(new Set(activeVisits.map((v) => v.participant_id)));
	let participantsById: Record<string, any> = {};

	if (participantIds.length > 0) {
		const { data: participants, error: participantsError } = await supabase
			.from('participants')
			.select(
				'id, first_name, middle_name, last_name, screening_id, randomization_id, ltfu, consent_withdrawn'
			)
			.in('id', participantIds);

		if (participantsError) {
			console.error('Error loading participants:', participantsError);
			throw error(500, 'Failed to load participants');
		}

		participantsById = Object.fromEntries((participants ?? []).map((p) => [p.id, p]));
	}

	// 4) Filter OUT participants who are LTFU or have withdrawn consent
	const filteredVisits = activeVisits.filter((v) => {
		const p = participantsById[v.participant_id];
		// If somehow participant missing, we keep it visible rather than silently drop
		if (!p) return true;
		return p.ltfu !== true && p.consent_withdrawn !== true;
	});

	// 5) Attach participant info
	const visits = filteredVisits.map((v) => ({
		...v,
		participant: participantsById[v.participant_id] ?? null
	}));

	return { visits };
};
