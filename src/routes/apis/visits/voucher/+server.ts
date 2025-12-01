// src/routes/apis/visits/voucher/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const visitId = formData.get('visitId');
		const voucher_status = formData.get('voucher_status');

		if (!visitId || typeof visitId !== 'string') {
			return json({ ok: false, message: 'visitId is required' }, { status: 400 });
		}

		if (!voucher_status || typeof voucher_status !== 'string') {
			return json({ ok: false, message: 'voucher_status is required' }, { status: 400 });
		}

		const voucher_given =
			voucher_status === 'given' ? true : voucher_status === 'not_given' ? false : null;

		const { error } = await supabase.from('visits').update({ voucher_given }).eq('id', visitId);

		if (error) {
			console.error('Error updating voucher_given:', error);
			return json({ ok: false, message: 'Failed to update voucher' }, { status: 500 });
		}

		return json({ ok: true, voucher_given });
	} catch (e) {
		console.error('Unexpected error in /apis/visits/voucher:', e);
		return json({ ok: false, message: 'Unexpected server error' }, { status: 500 });
	}
};
