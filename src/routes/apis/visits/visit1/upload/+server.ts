// src/routes/apis/visits/visit1/upload/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

const FIELD_TO_COLUMN: Record<'ecg' | 'echo' | 'efficacy' | 'safety', string> = {
	ecg: 'ecg_src',
	echo: 'echo_src',
	efficacy: 'efficacy_src',
	safety: 'safety_src'
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { visitId, field, objectKey } = await request.json();

		if (!visitId || !field || !objectKey) {
			return json({ ok: false, error: 'Missing visitId, field or objectKey' }, { status: 400 });
		}

		if (!(field in FIELD_TO_COLUMN)) {
			return json({ ok: false, error: 'Invalid field' }, { status: 400 });
		}

		const column = FIELD_TO_COLUMN[field as keyof typeof FIELD_TO_COLUMN];

		const { error } = await supabase
			.from('visits')
			.update({ [column]: objectKey })
			.eq('id', visitId);

		if (error) {
			console.error('Supabase update error', error);
			return json({ ok: false, error: 'DB update failed' }, { status: 500 });
		}

		return json({ ok: true });
	} catch (err) {
		console.error('Upload save error', err);
		return json({ ok: false, error: 'Invalid JSON or server error' }, { status: 500 });
	}
};
