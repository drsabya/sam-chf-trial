// src/routes/leads/[id]/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const supabase = locals.supabase;
	const id = params.id;

	if (!id) {
		throw error(400, 'Lead ID is required');
	}

	const { data, error: err } = await supabase.from('leads').select('*').eq('id', id).single();

	if (err || !data) {
		console.error('Error fetching lead by id:', {
			id,
			message: err?.message,
			details: (err as any)?.details,
			hint: (err as any)?.hint,
			code: (err as any)?.code
		});

		// Distinguish "not found" from real server error if you want
		if ((err as any)?.code === 'PGRST116' || (err as any)?.code === 'PGRST204') {
			throw error(404, 'Lead not found');
		}

		throw error(500, 'Could not load lead');
	}

	return {
		lead: data
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const supabase = locals.supabase;
		const id = params.id;

		if (!id) {
			return fail(400, { message: 'Lead ID is required.' });
		}

		const formData = await request.formData();

		const phoneRaw = (formData.get('phone') ?? '').toString().trim();
		const scheduledOnRaw = (formData.get('scheduled_on') ?? '').toString().trim();
		const wasCalledRaw = formData.get('was_called');
		const patientWillingRaw = formData.get('patient_willing');

		// Normalized booleans
		const was_called = wasCalledRaw === 'on' || wasCalledRaw === 'true' || wasCalledRaw === '1';

		const patient_willing =
			patientWillingRaw === 'on' || patientWillingRaw === 'true' || patientWillingRaw === '1';

		// Phone is mandatory
		if (!phoneRaw) {
			return fail(400, {
				message: 'Phone number is required.',
				values: {
					phone: phoneRaw,
					scheduled_on: scheduledOnRaw,
					was_called,
					patient_willing
				}
			});
		}

		let scheduled_on: string | null = null;

		// Only allow scheduling if patient is willing
		if (patient_willing && scheduledOnRaw) {
			const d = new Date(scheduledOnRaw);
			if (!Number.isNaN(d.getTime())) {
				scheduled_on = d.toISOString();
			}
		} else {
			// If not willing, explicitly clear scheduled_on
			scheduled_on = null;
		}

		const { data, error: err } = await supabase
			.from('leads')
			.update({
				phone: phoneRaw,
				was_called,
				patient_willing,
				scheduled_on
				// updated_at handled by trigger
			})
			.eq('id', id)
			.select()
			.single();

		if (err || !data) {
			console.error('Error updating lead:', {
				id,
				payload: {
					phone: phoneRaw,
					was_called,
					patient_willing,
					scheduled_on
				},
				message: err?.message,
				details: (err as any)?.details,
				hint: (err as any)?.hint,
				code: (err as any)?.code
			});

			return fail(500, {
				message: 'Could not update lead.',
				values: {
					phone: phoneRaw,
					scheduled_on: scheduledOnRaw,
					was_called,
					patient_willing
				}
			});
		}

		return {
			success: true,
			message: 'Lead updated.',
			lead: data,
			values: {
				phone: phoneRaw,
				scheduled_on: scheduledOnRaw,
				was_called,
				patient_willing
			}
		};
	}
};
