// src/routes/apis/visits/visit3/vision/efficacy/+server.ts
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

		// Visit 3 markers = Visit 2 markers + serum homocysteine
		const prompt = `
You are reading a laboratory report for a heart failure clinical trial VISIT 3.
The report contains these biochemical / inflammatory markers:

- Reduced Glutathione (GSH)
- Tumor Necrosis Factor alpha (TNF-α, TNF alpha)
- Interleukin-6 (IL-6, IL6)
- S-adenosylmethionine (SAM, SAME, S-adenosyl methionine)
- S-adenosylhomocysteine (SAH, S-adenosyl homocysteine)
- 5-methylcytosine (5-mC, 5-methyl cytosine, 5mC)
- Serum homocysteine (Homocysteine, Plasma homocysteine)

TASK:
1. Locate the numeric values for:
   - GSH
   - TNF-α
   - IL-6
   - SAME
   - SAH
   - 5-methylcytosine
   - Serum homocysteine

2. Return ONLY a JSON object in this exact schema:
   {
     "gsh": 1.23,
     "tnf_alpha": 12.3,
     "il6": 4.5,
     "same": 123.0,
     "sah": 45.6,
     "five_methylcytosine": 1.2,
     "serum_homocysteine": 14.7
   }

RULES:
- All values must be numbers (float), WITHOUT units.
- If a marker is not reported or not clearly readable, set its value to null.
- If multiple results exist for the same marker, choose the value that corresponds to the CURRENT or LATEST visit in this report.
- If a test is explicitly marked as "not done", use null.
- Do NOT include any extra keys or text. Only the JSON object with these seven keys.
		`.trim();

		const raw = await runVisionJsonExtraction({ buffer, mimeType, prompt });

		const toNumOrNull = (value: unknown): number | null => {
			if (value === null || typeof value === 'undefined') return null;
			const n = Number(value);
			if (!Number.isFinite(n)) return null;
			if (n < 0) return null; // these lab values shouldn't be negative
			return n;
		};

		const gsh = toNumOrNull(raw?.gsh);
		const tnf_alpha = toNumOrNull(raw?.tnf_alpha);
		const il6 = toNumOrNull(raw?.il6);
		const same = toNumOrNull(raw?.same);
		const sah = toNumOrNull(raw?.sah);
		const five_methylcytosine = toNumOrNull(raw?.five_methylcytosine);
		const serum_homocysteine = toNumOrNull(raw?.serum_homocysteine);

		const patch: Record<string, number | null> = {
			gsh,
			tnf_alpha,
			il6,
			same,
			sah,
			five_methylcytosine,
			serum_homocysteine
		};

		// Only hit DB if at least one value is non-null
		if (
			gsh !== null ||
			tnf_alpha !== null ||
			il6 !== null ||
			same !== null ||
			sah !== null ||
			five_methylcytosine !== null ||
			serum_homocysteine !== null
		) {
			await updateVisitLabs(visitId, patch);
		}

		return json({
			ok: true,
			updated: patch
		});
	} catch (err: any) {
		console.error('Visit 3 efficacy vision endpoint error:', err);
		return json(
			{
				ok: false,
				error: err?.message ?? 'Unexpected error in Visit 3 efficacy vision endpoint'
			},
			{ status: 500 }
		);
	}
};
