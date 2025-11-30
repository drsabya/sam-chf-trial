// src/routes/apis/visits/visit8/efficacy/+server.ts
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

		const prompt = `
You are reading an efficacy laboratory report for a heart failure clinical trial VISIT 8.

This report contains biomarkers, including:
- NT-Pro BNP
- Serum TSH
- Serum homocysteine
- GSH (glutathione)
- TNF-α (TNF alpha)
- IL-6
- S-adenosylmethionine (SAME, SAM, SAMe)
- S-adenosylhomocysteine (SAH)
- 5-methylcytosine (5mC, 5-methyl cytosine)

TASK:
1. Locate the numeric values for all of the following markers:
   - nt_pro_bnp
   - serum_tsh
   - serum_homocysteine
   - gsh
   - tnf_alpha
   - il6
   - same
   - sah
   - five_methylcytosine

2. Return ONLY a JSON object in this exact schema:
   {
     "nt_pro_bnp": 0.0,
     "serum_tsh": 0.0,
     "serum_homocysteine": 0.0,
     "gsh": 0.0,
     "tnf_alpha": 0.0,
     "il6": 0.0,
     "same": 0.0,
     "sah": 0.0,
     "five_methylcytosine": 0.0
   }

RULES:
- All values must be numbers (float), WITHOUT units.
- If a marker is not reported or not clearly readable, set its value to null.
- If multiple results exist for the same marker, choose the value that corresponds to the CURRENT or LATEST visit in this report.
- If a test is explicitly marked as "not done", use null.
- Do NOT include any extra keys or text. Only the JSON object with these keys.
		`.trim();

		const raw = await runVisionJsonExtraction({ buffer, mimeType, prompt });

		const toNumOrNull = (value: unknown): number | null => {
			if (value === null || typeof value === 'undefined') return null;
			const n = Number(value);
			if (!Number.isFinite(n)) return null;
			return n;
		};

		const nt_pro_bnp = toNumOrNull(raw?.nt_pro_bnp);
		const serum_tsh = toNumOrNull(raw?.serum_tsh);
		const serum_homocysteine = toNumOrNull(raw?.serum_homocysteine);
		const gsh = toNumOrNull(raw?.gsh);
		const tnf_alpha = toNumOrNull(raw?.tnf_alpha);
		const il6 = toNumOrNull(raw?.il6);
		const same = toNumOrNull(raw?.same);
		const sah = toNumOrNull(raw?.sah);
		const five_methylcytosine = toNumOrNull(raw?.five_methylcytosine);

		const patch: Record<string, number | null> = {
			nt_pro_bnp,
			serum_tsh,
			serum_homocysteine,
			gsh,
			tnf_alpha,
			il6,
			same,
			sah,
			five_methylcytosine
		};

		if (
			nt_pro_bnp !== null ||
			serum_tsh !== null ||
			serum_homocysteine !== null ||
			gsh !== null ||
			tnf_alpha !== null ||
			il6 !== null ||
			same !== null ||
			sah !== null ||
			five_methylcytosine !== null
		) {
			await updateVisitLabs(visitId, patch);
		}

		return json({ ok: true, updated: patch });
	} catch (err: any) {
		console.error('Visit 8 efficacy endpoint error:', err);
		return json(
			{
				ok: false,
				error: err?.message ?? 'Unexpected error in Visit 8 efficacy endpoint'
			},
			{ status: 500 }
		);
	}
};
