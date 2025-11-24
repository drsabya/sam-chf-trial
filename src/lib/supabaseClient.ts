// src/lib/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

// Read from static public env
const supabaseUrl = PUBLIC_SUPABASE_URL;
const supabaseKey = PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
	throw new Error('Missing PUBLIC_SUPABASE_URL');
}

if (!supabaseKey) {
	throw new Error('Missing PUBLIC_SUPABASE_PUBLISHABLE_KEY');
}

// Debug (optional – remove later)
if (typeof window !== 'undefined') {
	console.log('Supabase URL:', supabaseUrl);
	console.log('Supabase key prefix:', supabaseKey.slice(0, 20) + '…');
	console.log('Supabase key length:', supabaseKey.length);
}

// 👇 This is the browser-side Supabase client, for use in Svelte components
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);
