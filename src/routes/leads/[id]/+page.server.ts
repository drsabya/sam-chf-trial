// src/routes/leads/[id]/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { supabase } from '$lib/supabaseClient';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id;

	const { data, error: err } = await supabase.from('leads').select('*').eq('id', id).single();

	if (err || !data) {
		console.error('Error fetching lead by id:', err);
		throw error(404, 'Lead not found');
	}

	return {
		lead: data
	};
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const id = params.id;
		const formData = await request.formData();

		const phoneRaw = (formData.get('phone') ?? '').toString().trim();
		const scheduledOnRaw = (formData.get('scheduled_on') ?? '').toString().trim();
		const wasCalledRaw = formData.get('was_called');
		const patientWillingRaw = formData.get('patient_willing');

		// Phone is mandatory
		if (!phoneRaw) {
			return fail(400, {
				message: 'Phone number is required.',
				values: {
					phone: phoneRaw,
					scheduled_on: scheduledOnRaw,
					was_called: wasCalledRaw === 'on',
					patient_willing: patientWillingRaw === 'on'
				}
			});
		}

		const was_called = wasCalledRaw === 'on' || wasCalledRaw === 'true' || wasCalledRaw === '1';

		const patient_willing =
			patientWillingRaw === 'on' || patientWillingRaw === 'true' || patientWillingRaw === '1';

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
			})
			.eq('id', id)
			.select()
			.single();

		if (err || !data) {
			console.error('Error updating lead:', err);
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
