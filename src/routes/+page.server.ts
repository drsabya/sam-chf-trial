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
		console.error('Error loading visits:', {
			message: visitsError.message,
			details: (visitsError as any)?.details,
			hint: (visitsError as any)?.hint,
			code: (visitsError as any)?.code
		});
		throw error(500, 'Failed to load upcoming visits');
	}

	// 2) Filter to "upcoming" in JS: due_date >= today (date-only),
	// and exclude withdrawn / death == true
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const activeUpcomingVisits =
		(visitsRaw ?? []).filter((v) => {
			if (!v.due_date) return false;

			const d = new Date(v.due_date);
			if (Number.isNaN(d.getTime())) return false;

			d.setHours(0, 0, 0, 0);

			const isUpcoming = d.getTime() >= today.getTime();
			const isActive = v.withdrawn !== true && v.death !== true;

			return isUpcoming && isActive;
		}) ?? [];

	// 3) Fetch participant details for these visits
	const participantIds = Array.from(new Set(activeUpcomingVisits.map((v) => v.participant_id)));

	let participantsById: Record<string, any> = {};

	if (participantIds.length > 0) {
		const { data: participants, error: participantsError } = await supabase
			.from('participants')
			.select('id, first_name, middle_name, last_name, screening_id, randomization_id')
			.in('id', participantIds);

		if (participantsError) {
			console.error('Error loading participants for upcoming visits:', {
				message: participantsError.message,
				details: (participantsError as any)?.details,
				hint: (participantsError as any)?.hint,
				code: (participantsError as any)?.code
			});
			throw error(500, 'Failed to load upcoming visits');
		}

		participantsById = Object.fromEntries((participants ?? []).map((p) => [p.id, p]));
	}

	// 4) Attach participant info
	const visits = activeUpcomingVisits.map((v) => ({
		...v,
		participant: participantsById[v.participant_id] ?? null
	}));

	return {
		visits
	};
};
