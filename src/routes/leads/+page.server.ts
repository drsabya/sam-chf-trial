// src/routes/leads/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { supabase } from '$lib/supabaseClient';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	// Fetch all leads (newest first)
	const { data, error } = await supabase
		.from('leads')
		.select('*')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error loading leads:', error);
		return { leads: [] };
	}

	return { leads: data ?? [] };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();

		const nameRaw = (formData.get('name') ?? '').toString().trim();
		const phoneRaw = (formData.get('phone') ?? '').toString().trim();

		// Validation: name required
		if (!nameRaw) {
			return fail(400, {
				message: 'Name is required.',
				values: {
					name: nameRaw,
					phone: phoneRaw
				}
			});
		}

		const name = nameRaw;
		const phone = phoneRaw || null;

		// Insert new lead — phone optional, patient_willing is null by default
		const { data, error } = await supabase
			.from('leads')
			.insert({
				name,
				phone,
				was_called: false,
				patient_willing: null, // important
				scheduled_on: null // important
			})
			.select()
			.single();

		if (error) {
			console.error('Error creating lead:', error);
			return fail(500, {
				message: 'Could not create lead.',
				values: { name, phone }
			});
		}

		return {
			success: true,
			message: 'Lead created successfully.',
			lead: data
		};
	}
};
