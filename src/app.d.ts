// src/app.d.ts
/// <reference types="@sveltejs/kit" />

import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			session: Session | null;
			user: User | null;
			role: string | null;
		}
	}
}

export {};
