// src/routes/login/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	// If already logged in, don't show login page
	if (locals.session) {
		throw redirect(303, '/');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!email || !password) {
			return fail(400, {
				error: 'Email and password are required',
				email
			});
		}

		// Use the SSR Supabase client from hooks
		const { error } = await locals.supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) {
			console.error('Login error:', error.message);
			return fail(400, {
				error: 'Invalid email or password',
				email
			});
		}

		// On success, redirect to your main app page
		throw redirect(303, '/');
	}
};
