// src/routes/logout/+server.ts
import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	// Call Supabase logout on the server (clears session cookie)
	await locals.supabase.auth.signOut();

	// Redirect back to login
	throw redirect(303, '/login');
};
