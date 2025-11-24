// src/routes/leads/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;

	if (!supabase) {
		console.error('Supabase client missing on locals in /leads load');
		throw redirect(303, '/login');
	}

	// Get session from cookies
	const {
		data: { session },
		error: sessionError
	} = await supabase.auth.getSession();

	console.log('[/leads] session:', session?.user?.id, 'sessionError:', sessionError?.message);

	if (!session) {
		throw redirect(303, '/login');
	}

	// Optional debug: see what the DB thinks about our auth context
	const { data: debugCtx, error: debugErr } = await supabase.rpc('debug_auth_context');
	console.log('[/leads] debug_auth_context:', debugCtx, debugErr?.message);

	const { data, error } = await supabase
		.from('leads')
		.select('*')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error loading leads:', {
			message: error.message,
			details: (error as any).details,
			hint: (error as any).hint,
			code: (error as any).code
		});
		return { leads: [] };
	}

	return { leads: data ?? [] };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const supabase = locals.supabase;

		const {
			data: { session },
			error: sessionError
		} = await supabase.auth.getSession();

		console.log(
			'[/leads create] session:',
			session?.user?.id,
			'sessionError:',
			sessionError?.message
		);

		if (!session) {
			return fail(401, { message: 'Not authenticated.' });
		}

		const formData = await request.formData();

		const nameRaw = (formData.get('name') ?? '').toString().trim();
		const phoneRaw = (formData.get('phone') ?? '').toString().trim();

		// Validation: name required
		if (!nameRaw) {
			return fail(400, {
				message: 'Name is required.',
				success: false,
				values: {
					name: nameRaw,
					phone: phoneRaw
				}
			});
		}

		const name = nameRaw;
		const phone = phoneRaw || null;

		const { data, error } = await supabase
			.from('leads')
			.insert({
				name,
				phone,
				was_called: false,
				patient_willing: null,
				scheduled_on: null
			})
			.select()
			.single();

		if (error) {
			console.error('Error creating lead:', {
				message: error.message,
				details: (error as any).details,
				hint: (error as any).hint,
				code: (error as any).code
			});

			return fail(500, {
				message: 'Could not create lead.',
				success: false,
				values: { name, phone }
			});
		}

		return {
			success: true,
			message: 'Lead created successfully.',
			lead: data,
			values: { name, phone }
		};
	}
};
