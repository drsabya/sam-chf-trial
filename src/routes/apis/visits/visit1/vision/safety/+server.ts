// src/routes/apis/visits/visit1/vision/safety/+server.ts
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

		if (field !== 'safety') {
			return json({ ok: false, error: 'Invalid field for this endpoint' }, { status: 400 });
		}

		if (!(file instanceof File)) {
			return json({ ok: false, error: 'file is required' }, { status: 400 });
		}

		const mimeType = file.type || 'application/pdf';
		const buffer = await file.arrayBuffer();

		// Prompt specifically for Safety labs
		const prompt = `
You are reading laboratory reports (SAFETY: routine blood investigations) for a heart failure patient.

TASK:
Identify the numeric values (current/most recent for this visit) for the following tests:

- hb (Hemoglobin, g/dL)
- rbcs (Red blood cells, million/µL or similar)
- wbcs (White blood cells, /mm³ or /µL)
- polymorphs (%)
- lymphocytes (%)
- monocytes (%)
- platelets (platelet count, /mm³ or /µL)
- sgot_ast (AST/SGOT, U/L)
- sgpt_alt (ALT/SGPT, U/L)
- bilirubin_total (mg/dL)
- bilirubin_direct (mg/dL)
- bilirubin_indirect (mg/dL)
- bun (Blood urea nitrogen, mg/dL)
- serum_creatinine (mg/dL)
- total_cholesterol (mg/dL)
- hdl (mg/dL)
- ldl (mg/dL)
- triglycerides (mg/dL)

RETURN FORMAT:
Return ONLY a JSON object in this exact schema:

{
  "hb": 13.5,
  "rbcs": 4.5,
  "wbcs": 7800,
  "polymorphs": 60,
  "lymphocytes": 32,
  "monocytes": 4,
  "platelets": 250000,
  "sgot_ast": 24,
  "sgpt_alt": 22,
  "bilirubin_total": 0.8,
  "bilirubin_direct": 0.2,
  "bilirubin_indirect": 0.6,
  "bun": 18,
  "serum_creatinine": 1.0,
  "total_cholesterol": 180,
  "hdl": 45,
  "ldl": 100,
  "triglycerides": 140
}

RULES:
- All values must be numbers (float or integer), WITHOUT units.
- If a value is not reported or not clearly readable, set it to null.
- If multiple results exist, choose the value that corresponds to the CURRENT or LATEST visit on this report.
- If a test is explicitly marked as "not done", use null.
- Do not include any other keys or text.
		`.trim();

		const raw = await runVisionJsonExtraction({ buffer, mimeType, prompt });

		const toNumOrNull = (value: unknown): number | null => {
			if (value === null || typeof value === 'undefined') return null;
			const n = Number(value);
			if (!Number.isFinite(n)) return null;
			return n;
		};

		const patch: Record<string, number | null> = {
			hb: toNumOrNull(raw?.hb),
			rbcs: toNumOrNull(raw?.rbcs),
			wbcs: toNumOrNull(raw?.wbcs),
			polymorphs: toNumOrNull(raw?.polymorphs),
			lymphocytes: toNumOrNull(raw?.lymphocytes),
			monocytes: toNumOrNull(raw?.monocytes),
			platelets: toNumOrNull(raw?.platelets),
			sgot_ast: toNumOrNull(raw?.sgot_ast),
			sgpt_alt: toNumOrNull(raw?.sgpt_alt),
			bilirubin_total: toNumOrNull(raw?.bilirubin_total),
			bilirubin_direct: toNumOrNull(raw?.bilirubin_direct),
			bilirubin_indirect: toNumOrNull(raw?.bilirubin_indirect),
			bun: toNumOrNull(raw?.bun),
			serum_creatinine: toNumOrNull(raw?.serum_creatinine),
			total_cholesterol: toNumOrNull(raw?.total_cholesterol),
			hdl: toNumOrNull(raw?.hdl),
			ldl: toNumOrNull(raw?.ldl),
			triglycerides: toNumOrNull(raw?.triglycerides)
		};

		// Check if at least one value is non-null before updating DB
		const hasAnyValue = Object.values(patch).some((v) => v !== null);

		if (hasAnyValue) {
			await updateVisitLabs(visitId, patch);
		}

		return json({
			ok: true,
			updated: patch
		});
	} catch (err: any) {
		console.error('Safety vision endpoint error:', err);
		return json(
			{
				ok: false,
				error: err?.message ?? 'Unexpected error in safety vision endpoint'
			},
			{ status: 500 }
		);
	}
};
