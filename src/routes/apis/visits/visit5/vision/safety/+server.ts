// // src/routes/apis/visits/visit5/vision/safety/+server.ts
// import type { RequestHandler } from './$types';
// import { json } from '@sveltejs/kit';
// import { runVisionJsonExtraction, updateVisitLabs } from '$lib/server/visitsVision';

// export const POST: RequestHandler = async ({ request }) => {
// 	try {
// 		const formData = await request.formData();
// 		const visitId = formData.get('visitId');
// 		const field = formData.get('field');
// 		const file = formData.get('file');

// 		if (!visitId || typeof visitId !== 'string') {
// 			return json({ ok: false, error: 'visitId is required' }, { status: 400 });
// 		}

// 		if (field !== 'safety') {
// 			return json({ ok: false, error: 'Invalid field for this endpoint' }, { status: 400 });
// 		}

// 		if (!(file instanceof File)) {
// 			return json({ ok: false, error: 'file is required' }, { status: 400 });
// 		}

// 		const mimeType = file.type || 'application/pdf';
// 		const buffer = await file.arrayBuffer();

// 		// Prompt specifically for Visit 5 safety labs
// 		const prompt = `
// You are reading a laboratory report for a heart failure clinical trial VISIT 5.
// This report contains routine safety / monitoring laboratory tests, including:

// - Hemoglobin (Hb)
// - Red blood cell count (RBC, RBCs)
// - White blood cell count (WBC, WBCs, total leukocyte count)
// - Differential count: Polymorphs (neutrophils), Lymphocytes, Monocytes
// - Platelet count
// - Liver function tests:
//   - SGOT / AST
//   - SGPT / ALT
//   - Total bilirubin
//   - Direct bilirubin
//   - Indirect bilirubin
// - Renal function tests:
//   - Blood urea nitrogen (BUN, urea)
//   - Serum creatinine
// - Lipid profile:
//   - Total cholesterol
//   - HDL
//   - LDL
//   - Triglycerides

// TASK:
// 1. Locate the numeric values for all of the following markers:
//    - hb
//    - rbcs
//    - wbcs
//    - polymorphs
//    - lymphocytes
//    - monocytes
//    - platelets
//    - sgot_ast
//    - sgpt_alt
//    - bilirubin_total
//    - bilirubin_direct
//    - bilirubin_indirect
//    - bun
//    - serum_creatinine
//    - total_cholesterol
//    - hdl
//    - ldl
//    - triglycerides

// 2. Return ONLY a JSON object in this exact schema:
//    {
//      "hb": 0.0,
//      "rbcs": 0.0,
//      "wbcs": 0.0,
//      "polymorphs": 0.0,
//      "lymphocytes": 0.0,
//      "monocytes": 0.0,
//      "platelets": 0.0,
//      "sgot_ast": 0.0,
//      "sgpt_alt": 0.0,
//      "bilirubin_total": 0.0,
//      "bilirubin_direct": 0.0,
//      "bilirubin_indirect": 0.0,
//      "bun": 0.0,
//      "serum_creatinine": 0.0,
//      "total_cholesterol": 0.0,
//      "hdl": 0.0,
//      "ldl": 0.0,
//      "triglycerides": 0.0
//    }

// RULES:
// - All values must be numbers (float), WITHOUT units.
// - If a marker is not reported or not clearly readable, set its value to null.
// - If multiple results exist for the same marker, choose the value that corresponds to the CURRENT or LATEST visit in this report.
// - If a test is explicitly marked as "not done", use null.
// - Do NOT include any extra keys or text. Only the JSON object with these keys.
// 		`.trim();

// 		const raw = await runVisionJsonExtraction({ buffer, mimeType, prompt });

// 		const toNumOrNull = (value: unknown): number | null => {
// 			if (value === null || typeof value === 'undefined') return null;
// 			const n = Number(value);
// 			if (!Number.isFinite(n)) return null;
// 			if (n < 0) return null; // safety labs shouldn't be negative
// 			return n;
// 		};

// 		const hb = toNumOrNull(raw?.hb);
// 		const rbcs = toNumOrNull(raw?.rbcs);
// 		const wbcs = toNumOrNull(raw?.wbcs);
// 		const polymorphs = toNumOrNull(raw?.polymorphs);
// 		const lymphocytes = toNumOrNull(raw?.lymphocytes);
// 		const monocytes = toNumOrNull(raw?.monocytes);
// 		const platelets = toNumOrNull(raw?.platelets);
// 		const sgot_ast = toNumOrNull(raw?.sgot_ast);
// 		const sgpt_alt = toNumOrNull(raw?.sgpt_alt);
// 		const bilirubin_total = toNumOrNull(raw?.bilirubin_total);
// 		const bilirubin_direct = toNumOrNull(raw?.bilirubin_direct);
// 		const bilirubin_indirect = toNumOrNull(raw?.bilirubin_indirect);
// 		const bun = toNumOrNull(raw?.bun);
// 		const serum_creatinine = toNumOrNull(raw?.serum_creatinine);
// 		const total_cholesterol = toNumOrNull(raw?.total_cholesterol);
// 		const hdl = toNumOrNull(raw?.hdl);
// 		const ldl = toNumOrNull(raw?.ldl);
// 		const triglycerides = toNumOrNull(raw?.triglycerides);

// 		const patch: Record<string, number | null> = {
// 			hb,
// 			rbcs,
// 			wbcs,
// 			polymorphs,
// 			lymphocytes,
// 			monocytes,
// 			platelets,
// 			sgot_ast,
// 			sgpt_alt,
// 			bilirubin_total,
// 			bilirubin_direct,
// 			bilirubin_indirect,
// 			bun,
// 			serum_creatinine,
// 			total_cholesterol,
// 			hdl,
// 			ldl,
// 			triglycerides
// 		};

// 		// Only hit DB if at least one value is non-null
// 		if (
// 			hb !== null ||
// 			rbcs !== null ||
// 			wbcs !== null ||
// 			polymorphs !== null ||
// 			lymphocytes !== null ||
// 			monocytes !== null ||
// 			platelets !== null ||
// 			sgot_ast !== null ||
// 			sgpt_alt !== null ||
// 			bilirubin_total !== null ||
// 			bilirubin_direct !== null ||
// 			bilirubin_indirect !== null ||
// 			bun !== null ||
// 			serum_creatinine !== null ||
// 			total_cholesterol !== null ||
// 			hdl !== null ||
// 			ldl !== null ||
// 			triglycerides !== null
// 		) {
// 			await updateVisitLabs(visitId, patch);
// 		}

// 		return json({
// 			ok: true,
// 			updated: patch
// 		});
// 	} catch (err: any) {
// 		console.error('Visit 5 safety vision endpoint error:', err);
// 		return json(
// 			{
// 				ok: false,
// 				error: err?.message ?? 'Unexpected error in Visit 5 safety vision endpoint'
// 			},
// 			{ status: 500 }
// 		);
// 	}
// };
