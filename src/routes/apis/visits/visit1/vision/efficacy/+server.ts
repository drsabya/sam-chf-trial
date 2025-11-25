// src/routes/apis/visits/visit1/vision/efficacy/+server.ts
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

		if (field !== 'efficacy') {
			return json({ ok: false, error: 'Invalid field for this endpoint' }, { status: 400 });
		}

		if (!(file instanceof File)) {
			return json({ ok: false, error: 'file is required' }, { status: 400 });
		}

		const mimeType = file.type || 'application/pdf';
		const buffer = await file.arrayBuffer();

		// Prompt specifically for NT-proBNP, TSH, Homocysteine
		const prompt = `
You are reading laboratory reports (EFFICACY: NT-proBNP / TSH / Homocysteine) for a heart failure patient.

TASK:
1. Identify the numeric values for:
   - NT-proBNP (pg/mL or ng/L)
   - Serum TSH (mIU/L or µIU/mL)
   - Serum Homocysteine (µmol/L)

2. Return ONLY a JSON object in this exact schema:
   {
     "nt_pro_bnp": 1234.0,
     "serum_tsh": 2.5,
     "serum_homocysteine": 15.0
   }

RULES:
- All values must be numbers (float), WITHOUT units.
- If a value is not reported or not clearly readable, set it to null.
- If multiple results exist, choose the value that corresponds to the CURRENT or LATEST visit on this report.
- If the test is explicitly marked as "not done", use null.
- Do not include any other keys or text.
		`.trim();

		const raw = await runVisionJsonExtraction({ buffer, mimeType, prompt });

		const toNumOrNull = (value: unknown): number | null => {
			if (value === null || typeof value === 'undefined') return null;
			const n = Number(value);
			if (!Number.isFinite(n)) return null;
			if (n < 0) return null; // lab values can't be negative
			return n;
		};

		const nt_pro_bnp = toNumOrNull(raw?.nt_pro_bnp);
		const serum_tsh = toNumOrNull(raw?.serum_tsh);
		const serum_homocysteine = toNumOrNull(raw?.serum_homocysteine);

		const patch: Record<string, number | null> = {
			nt_pro_bnp,
			serum_tsh,
			serum_homocysteine
		};

		// Only hit DB if at least one value is non-null
		if (nt_pro_bnp !== null || serum_tsh !== null || serum_homocysteine !== null) {
			await updateVisitLabs(visitId, patch);
		}

		return json({
			ok: true,
			updated: patch
		});
	} catch (err: any) {
		console.error('Efficacy vision endpoint error:', err);
		return json(
			{
				ok: false,
				error: err?.message ?? 'Unexpected error in efficacy vision endpoint'
			},
			{ status: 500 }
		);
	}
};
