// src/routes/participants/[id]/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const supabase = locals.supabase;
	const id = params.id;

	if (!id) {
		throw error(400, 'Participant ID is required');
	}

	// 1️⃣ Fetch participant
	const { data: participant, error: pErr } = await supabase
		.from('participants')
		.select('*')
		.eq('id', id)
		.single();

	if (pErr || !participant) {
		console.error('Error fetching participant:', {
			id,
			message: pErr?.message,
			details: (pErr as any)?.details,
			hint: (pErr as any)?.hint,
			code: (pErr as any)?.code
		});

		// PGRST116 / PGRST204 → not found
		if ((pErr as any)?.code === 'PGRST116' || (pErr as any)?.code === 'PGRST204') {
			throw error(404, 'Participant not found');
		}

		throw error(500, 'Could not load participant');
	}

	// 2️⃣ Fetch visits for the Visits tab (non-fatal if it fails)
	let visits: any[] = [];
	const { data: visitsData, error: vErr } = await supabase
		.from('visits')
		.select('*')
		.eq('participant_id', id)
		.order('visit_number', { ascending: true });

	if (vErr) {
		console.error('Error fetching visits for participant:', {
			id,
			message: vErr?.message,
			details: (vErr as any)?.details,
			hint: (vErr as any)?.hint,
			code: (vErr as any)?.code
		});
	} else if (visitsData) {
		visits = visitsData;
	}

	return {
		participant,
		visits
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const supabase = locals.supabase;
		const id = params.id;

		if (!id) {
			return fail(400, { message: 'Participant ID is required.' });
		}

		const formData = await request.formData();

		const first_name = (formData.get('first_name') ?? '').toString().trim();
		const middle_name = (formData.get('middle_name') ?? '').toString().trim();
		const last_name = (formData.get('last_name') ?? '').toString().trim();
		const phone = (formData.get('phone') ?? '').toString().trim();
		const alternate_phone = (formData.get('alternate_phone') ?? '').toString().trim();
		const sex = (formData.get('sex') ?? '').toString().trim();
		const address = (formData.get('address') ?? '').toString().trim();
		const education = (formData.get('education') ?? '').toString().trim();
		const occupation = (formData.get('occupation') ?? '').toString().trim();
		const ageRaw = (formData.get('age') ?? '').toString().trim();
		const incomeRaw = (formData.get('income') ?? '').toString().trim();

		// Checkboxes → booleans
		const ltfu = formData.get('ltfu') !== null;
		const consent_withdrawn = formData.get('consent_withdrawn') !== null;

		const values = {
			first_name,
			middle_name,
			last_name,
			phone,
			alternate_phone,
			sex,
			address,
			education,
			occupation,
			age: ageRaw,
			income: incomeRaw,
			ltfu,
			consent_withdrawn
		};

		// Basic validation: phone mandatory
		if (!phone) {
			return fail(400, {
				message: 'Phone number is required.',
				values
			});
		}

		let age: number | null = null;
		if (ageRaw) {
			const parsed = Number(ageRaw);
			if (Number.isNaN(parsed) || parsed < 0) {
				return fail(400, {
					message: 'Age must be a non-negative number.',
					values
				});
			}
			age = parsed;
		}

		let income: number | null = null;
		if (incomeRaw) {
			const parsed = Number(incomeRaw);
			if (Number.isNaN(parsed) || parsed < 0) {
				return fail(400, {
					message: 'Income must be a non-negative number.',
					values
				});
			}
			income = parsed;
		}

		// Derive initials if possible
		const initials =
			(first_name ? first_name[0]?.toUpperCase() : '') +
			(middle_name ? middle_name[0]?.toUpperCase() : '') +
			(last_name ? last_name[0]?.toUpperCase() : '');

		const payload: Record<string, any> = {
			first_name,
			middle_name: middle_name || null,
			last_name,
			phone,
			alternate_phone: alternate_phone || null,
			sex: sex || null,
			address: address || null,
			education: education || null,
			occupation: occupation || null,
			age,
			income,
			ltfu,
			consent_withdrawn
		};

		if (initials) {
			payload.initials = initials;
		}

		const { data, error: err } = await supabase
			.from('participants')
			.update(payload)
			.eq('id', id)
			.select()
			.single();

		if (err || !data) {
			console.error('Error updating participant:', {
				id,
				payload,
				message: err?.message,
				details: (err as any)?.details,
				hint: (err as any)?.hint,
				code: (err as any)?.code
			});

			return fail(500, {
				message: 'Could not update participant.',
				values
			});
		}

		return {
			success: true,
			message: 'Participant updated.',
			participant: data
		};
	}
};
