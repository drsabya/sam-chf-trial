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
		const patientStatusRaw = (formData.get('patient_status') ?? '').toString().trim(); // 'willing' | 'unwilling' | ''
		const clearStatusRaw = (formData.get('clear_status') ?? '').toString().trim(); // '1' if clear pressed

		const commentRaw = (formData.get('comment') ?? '').toString().trim();
		const unfitRaw = formData.get('unfit');
		const unfit =
			unfitRaw === 'on' || unfitRaw === 'true' || unfitRaw === '1' || unfitRaw === 'checked';

		// Normalized boolean for "was called"
		const was_called = wasCalledRaw === 'on' || wasCalledRaw === 'true' || wasCalledRaw === '1';

		// Phone is mandatory
		if (!phoneRaw) {
			return fail(400, {
				message: 'Phone number is required.',
				values: {
					phone: phoneRaw,
					scheduled_on: scheduledOnRaw,
					was_called,
					patient_status: patientStatusRaw || null,
					comment: commentRaw,
					unfit
				}
			});
		}

		// Fetch existing lead so that changing was_called alone does NOT wipe patient_willing
		const {
			data: existingLead,
			error: existingErr
		} = await supabase
			.from('leads')
			.select('patient_willing, scheduled_on')
			.eq('id', id)
			.single();

		if (existingErr || !existingLead) {
			console.error('Error fetching existing lead in update:', {
				id,
				message: existingErr?.message,
				details: (existingErr as any)?.details,
				hint: (existingErr as any)?.hint,
				code: (existingErr as any)?.code
			});

			return fail(500, {
				message: 'Could not update lead.',
				values: {
					phone: phoneRaw,
					scheduled_on: scheduledOnRaw,
					was_called,
					patient_status: patientStatusRaw || null,
					comment: commentRaw,
					unfit
				}
			});
		}

		// Start from existing patient_willing
		let patient_willing: boolean | null = existingLead.patient_willing;

		const clearStatus =
			clearStatusRaw === '1' || clearStatusRaw === 'true' || clearStatusRaw === 'on';

		// If "Clear selection" used, force null
		if (clearStatus) {
			patient_willing = null;
		} else if (patientStatusRaw === 'willing') {
			patient_willing = true;
		} else if (patientStatusRaw === 'unwilling') {
			patient_willing = false;
		}
		// If patientStatusRaw === '' and clearStatus is false, we keep existing patient_willing

		// Scheduling logic
		let scheduled_on: string | null = existingLead.scheduled_on;

		const isWilling = patient_willing === true;

		// If not willing OR marked as unfit, do not keep any schedule
		if (!isWilling || unfit) {
			scheduled_on = null;
		} else {
			if (scheduledOnRaw) {
				const d = new Date(scheduledOnRaw);
				if (!Number.isNaN(d.getTime())) {
					scheduled_on = d.toISOString();
				}
			} else {
				// Clearing the date input should clear scheduling if willing but blank date
				scheduled_on = null;
			}
		}

		const { data, error: err } = await supabase
			.from('leads')
			.update({
				phone: phoneRaw,
				was_called,
				patient_willing,
				scheduled_on,
				comment: commentRaw === '' ? null : commentRaw,
				unfit
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
					scheduled_on,
					comment: commentRaw,
					unfit
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
					patient_status: patientStatusRaw || null,
					comment: commentRaw,
					unfit
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
				patient_status: patientStatusRaw || null,
				comment: commentRaw,
				unfit
			}
		};
	}
};
