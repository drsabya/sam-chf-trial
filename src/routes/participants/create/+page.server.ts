// src/routes/participants/create/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect, error } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const supabase = locals.supabase;

		if (!supabase) {
			throw error(500, 'Supabase client not available');
		}

		const formData = await request.formData();

		const first_name = String(formData.get('first_name') ?? '').trim();
		const middle_name = String(formData.get('middle_name') ?? '').trim();
		const last_name = String(formData.get('last_name') ?? '').trim();

		// Raw values from the form (can be lower/upper/mixed)
		const raw_screening_id = String(formData.get('screening_id') ?? '').trim();
		const raw_randomization_id = String(formData.get('randomization_id') ?? '').trim();

		// Normalize to uppercase for saving
		const screening_id = raw_screening_id.toUpperCase();
		const randomization_id = raw_randomization_id ? raw_randomization_id.toUpperCase() : '';

		// Basic presence validation
		if (!first_name || !last_name || !screening_id) {
			return fail(400, {
				error: 'First name, last name and screening ID are required.',
				values: {
					first_name,
					middle_name,
					last_name,
					screening_id,
					randomization_id
				}
			});
		}

		// Format validation: S + number
		const screeningPattern = /^S\d+$/;
		if (!screeningPattern.test(screening_id)) {
			return fail(400, {
				error: 'Screening ID must be "S" followed by a number (e.g. S1, S23, S87).',
				values: {
					first_name,
					middle_name,
					last_name,
					screening_id,
					randomization_id
				}
			});
		}

		// Format validation: R + number (if provided)
		const randomizationPattern = /^R\d+$/;
		if (randomization_id && !randomizationPattern.test(randomization_id)) {
			return fail(400, {
				error: 'Randomization ID must be "R" followed by a number (e.g. R1, R10).',
				values: {
					first_name,
					middle_name,
					last_name,
					screening_id,
					randomization_id
				}
			});
		}

		const insertPayload = {
			first_name,
			middle_name: middle_name || null,
			last_name,
			screening_id,
			randomization_id: randomization_id || null
		};

		const { data, error: dbError } = await supabase
			.from('participants')
			.insert(insertPayload)
			.select('id')
			.single();

		if (dbError || !data) {
			console.error('Error creating participant:', {
				payload: insertPayload,
				message: dbError?.message,
				details: (dbError as any)?.details,
				hint: (dbError as any)?.hint,
				code: (dbError as any)?.code
			});

			let msg = 'Could not create participant. Please try again.';

			// Optional: nicer message for uniqueness violations
			if ((dbError as any)?.code === '23505') {
				msg = 'A participant with this Screening ID or Randomization ID already exists.';
			}

			return fail(500, {
				error: msg,
				values: {
					first_name,
					middle_name,
					last_name,
					screening_id,
					randomization_id
				}
			});
		}

		throw redirect(303, `/participants/${data.id}`);
	}
};
