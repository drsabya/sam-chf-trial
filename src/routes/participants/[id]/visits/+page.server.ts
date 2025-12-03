// src/routes/participants/[id]/visits/+page.server.ts
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

type UserRoleRow = {
	role: string;
};

export const load: PageServerLoad = async ({ params, locals }) => {
	const participantId = params.id;

	if (!participantId) {
		throw error(400, 'Participant ID is required');
	}

	/* ---------------------------------------------
	   Get current user & role from locals.session
	--------------------------------------------- */
	const userId = (locals as any)?.session?.user?.id as string | undefined;
	let role: string | null = null;
	let isAdmin = false;

	if (userId) {
		const {
			data: userRole,
			error: userRoleError
		} = await supabase
			.from('user_roles')
			.select('role')
			.eq('user_id', userId)
			.maybeSingle<UserRoleRow>();

		if (userRoleError) {
			console.error('Error fetching user role in load:', userRoleError);
		} else if (userRole?.role) {
			role = userRole.role;
			isAdmin = role === 'admin';
		}
	}

	/* ---------------------------------------------
	   Fetch participant
	--------------------------------------------- */
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

	/* ---------------------------------------------
	   Fetch visits for this participant
	--------------------------------------------- */
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
		visits: visits ?? [],
		role,
		isAdmin
	};
};

export const actions: Actions = {
	deleteVisit: async ({ request, params, locals }) => {
		const participantId = params.id;

		if (!participantId) {
			return fail(400, { message: 'Participant ID is required.' });
		}

		/* ---------------------------------------------
		   Auth + role check (server-side)
		--------------------------------------------- */
		const userId = (locals as any)?.session?.user?.id as string | undefined;
		if (!userId) {
			return fail(401, { message: 'You must be signed in to perform this action.' });
		}

		const {
			data: userRole,
			error: userRoleError
		} = await supabase
			.from('user_roles')
			.select('role')
			.eq('user_id', userId)
			.maybeSingle<UserRoleRow>();

		if (userRoleError) {
			console.error('Error fetching user role in action:', userRoleError);
			return fail(500, { message: 'Failed to verify role.' });
		}

		const role = userRole?.role ?? null;
		if (role !== 'admin') {
			return fail(403, { message: 'You are not authorized to delete visits.' });
		}

		/* ---------------------------------------------
		   Core delete logic
		--------------------------------------------- */
		const formData = await request.formData();
		const visitId = formData.get('visitId');

		if (typeof visitId !== 'string' || !visitId) {
			return fail(400, { message: 'Visit ID is required.' });
		}

		// 1) Fetch the visit to be deleted
		const {
			data: visit,
			error: visitError
		} = await supabase
			.from('visits')
			.select('id, participant_id, visit_number')
			.eq('id', visitId)
			.single<{ id: string; participant_id: string; visit_number: number }>();

		if (visitError || !visit) {
			console.error('Error fetching visit to delete:', visitError);
			return fail(404, { message: 'Visit not found.' });
		}

		// Safety: visit must belong to this participant
		if (visit.participant_id !== participantId) {
			return fail(400, { message: 'Visit does not belong to this participant.' });
		}

		// Safety: do not allow deleting Visit 1
		if (visit.visit_number === 1) {
			return fail(400, { message: 'Visit 1 cannot be deleted.' });
		}

		const previousVisitNumber = visit.visit_number - 1;

		// 2) Set visit_date of the previous visit to null
		const { error: prevUpdateError } = await supabase
			.from('visits')
			.update({ visit_date: null })
			.eq('participant_id', participantId)
			.eq('visit_number', previousVisitNumber);

		if (prevUpdateError) {
			console.error('Error resetting previous visit_date:', prevUpdateError);
			return fail(500, { message: 'Failed to update previous visit.' });
		}

		// 3) Delete the current visit
		const { error: deleteError } = await supabase.from('visits').delete().eq('id', visitId);

		if (deleteError) {
			console.error('Error deleting visit:', deleteError);
			return fail(500, { message: 'Failed to delete visit.' });
		}

		return { success: true };
	},

	updateDueDate: async ({ request, params, locals }) => {
		const participantId = params.id;

		if (!participantId) {
			return fail(400, { message: 'Participant ID is required.' });
		}

		/* ---------------------------------------------
		   Auth + role check (server-side)
		--------------------------------------------- */
		const userId = (locals as any)?.session?.user?.id as string | undefined;
		if (!userId) {
			return fail(401, { message: 'You must be signed in to perform this action.' });
		}

		const {
			data: userRole,
			error: userRoleError
		} = await supabase
			.from('user_roles')
			.select('role')
			.eq('user_id', userId)
			.maybeSingle<UserRoleRow>();

		if (userRoleError) {
			console.error('Error fetching user role in updateDueDate:', userRoleError);
			return fail(500, { message: 'Failed to verify role.' });
		}

		const role = userRole?.role ?? null;
		if (role !== 'admin') {
			return fail(403, { message: 'You are not authorized to update due dates.' });
		}

		/* ---------------------------------------------
		   Core update logic
		--------------------------------------------- */
		const formData = await request.formData();
		const visitId = formData.get('visitId');
		const due_date_raw = formData.get('due_date');

		if (typeof visitId !== 'string' || !visitId) {
			return fail(400, { message: 'Visit ID is required.' });
		}
		if (typeof due_date_raw !== 'string' || !due_date_raw) {
			return fail(400, { message: 'Due date is required.' });
		}

		// Basic date validation
		const parsed = new Date(due_date_raw);
		if (Number.isNaN(parsed.getTime())) {
			return fail(400, { message: 'Invalid due date.' });
		}

		// Fetch the visit to ensure it's incomplete and belongs to this participant
		const {
			data: visit,
			error: visitError
		} = await supabase
			.from('visits')
			.select('id, participant_id, visit_date')
			.eq('id', visitId)
			.single<{ id: string; participant_id: string; visit_date: string | null }>();

		if (visitError || !visit) {
			console.error('Error fetching visit for due_date update:', visitError);
			return fail(404, { message: 'Visit not found.' });
		}

		if (visit.participant_id !== participantId) {
			return fail(400, { message: 'Visit does not belong to this participant.' });
		}

		// Only allow due date modification if visit is not completed
		if (visit.visit_date !== null) {
			return fail(400, {
				message: 'Cannot modify due date of a completed visit.'
			});
		}

		const { error: updateError } = await supabase
			.from('visits')
			.update({ due_date: due_date_raw })
			.eq('id', visitId);

		if (updateError) {
			console.error('Error updating due_date:', updateError);
			return fail(500, { message: 'Failed to update due date.' });
		}

		return { success: true };
	}
};
