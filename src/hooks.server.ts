// src/hooks.server.ts
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

export const handle: Handle = async ({ event, resolve }) => {
	// 1️⃣ Create Supabase client per request
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	// 2️⃣ Get session
	const {
		data: { session }
	} = await event.locals.supabase.auth.getSession();

	// 3️⃣ Fetch role from user_roles (if logged in)
	let role: string | null = null;

	if (session?.user) {
		const { data, error } = await event.locals.supabase
			.from('user_roles')
			.select('role')
			.eq('user_id', session.user.id)
			.maybeSingle();

		if (!error) {
			role = data?.role ?? null;
		}
	}

	event.locals.session = session;
	event.locals.user = session?.user ?? null;
	event.locals.role = role;

	// 4️⃣ Global auth guard
	const path = event.url.pathname;

	// routes that do NOT require auth
	const isPublicRoute =
		path === '/login' ||
		path === '/forbidden' ||
		path.startsWith('/__svelte') || // Svelte internals in dev
		path.startsWith('/favicon') ||
		path.startsWith('/icons') ||
		path.startsWith('/assets');

	// If not logged in → send to /login
	if (!event.locals.user && !isPublicRoute) {
		throw redirect(303, '/login');
	}

	// (optional) example: protect /admin for admins only
	// if (path.startsWith('/admin') && role !== 'admin') {
	//   throw redirect(303, '/forbidden');
	// }

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
