// src/routes/apis/visits/visit1/vision/echo/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { runVisionJsonExtraction, updateVisitLabs } from '$lib/server/visitsVision';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const visitId = formData.get('visitId');
		const field = formData.get('field');
		const file = formData.get('file');

		if (!visitId || typeof visitId !== 'string') {
			return json({ ok: false, error: 'visitId is required' }, { status: 400 });
		}

		if (field !== 'echo') {
			return json({ ok: false, error: 'Invalid field for this endpoint' }, { status: 400 });
		}

		if (!(file instanceof File)) {
			return json({ ok: false, error: 'file is required' }, { status: 400 });
		}

		const mimeType = file.type || 'application/pdf';
		const buffer = await file.arrayBuffer();

		// Prompt specifically for LVEF
		const prompt = `
You are reading an echocardiography report (2D Echo) for a heart failure patient.

TASK:
1. Identify the Left Ventricular Ejection Fraction (LVEF) value.
2. Return ONLY a JSON object in this exact schema:
   { "echo_lvef": 45.0 }

RULES:
- echo_lvef must be a number (float), representing percent (%), WITHOUT the % sign.
- If multiple LVEF values exist, choose the one that appears to be the FINAL or most recent value.
- If you cannot find any LVEF value, return:
   { "echo_lvef": null }
- Do not include any other keys or text.
		`.trim();

		const raw = await runVisionJsonExtraction({ buffer, mimeType, prompt });

		let echo_lvef: number | null = null;

		if (raw && typeof raw.echo_lvef !== 'undefined') {
			const n = Number(raw.echo_lvef);
			// Basic sanity check: LVEF usually between ~5 and 90
			if (Number.isFinite(n) && n >= 5 && n <= 90) {
				echo_lvef = n;
			} else {
				echo_lvef = null;
			}
		}

		const patch = { echo_lvef };

		if (echo_lvef !== null) {
			await updateVisitLabs(visitId, patch);
		}

		return json({
			ok: true,
			updated: patch
		});
	} catch (err: any) {
		console.error('Echo vision endpoint error:', err);
		return json(
			{
				ok: false,
				error: err?.message ?? 'Unexpected error in echo vision endpoint'
			},
			{ status: 500 }
		);
	}
};
