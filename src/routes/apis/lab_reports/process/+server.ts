// src/routes/apis/lab_reports/process/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2, R2_BUCKET } from '$lib/server/r2';
import { supabase } from '$lib/supabaseClient';

// ---------- GEMINI SETUP ----------
const GEMINI_API_KEY = env.GEMINI_API_KEY;

console.log('Gemini key present?', !!GEMINI_API_KEY);

if (!GEMINI_API_KEY) {
	throw new Error('GEMINI_API_KEY is not set in environment');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ---------- HELPERS ----------
function guessMimeType(key: string): string {
	const lower = key.toLowerCase();
	if (lower.endsWith('.png')) return 'image/png';
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	if (lower.endsWith('.webp')) return 'image/webp';
	if (lower.endsWith('.pdf')) return 'application/pdf';
	return 'application/octet-stream';
}

async function streamToBuffer(stream: any): Promise<Buffer> {
	const chunks: Uint8Array[] = [];
	for await (const chunk of stream) {
		chunks.push(chunk);
	}
	// @ts-ignore Node Buffer
	return Buffer.concat(chunks);
}

// ---------- POST /apis/lab_reports/process ----------
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => null);
		const id = body?.id as string | undefined;

		if (!id) {
			return json({ ok: false, error: 'Missing lab_reports.id in request body' }, { status: 400 });
		}

		// 1) Fetch the lab_reports row from Supabase
		const { data: report, error: fetchError } = await supabase
			.from('lab_reports')
			.select('*')
			.eq('id', id)
			.single();

		if (fetchError || !report) {
			console.error('Failed to fetch lab_report:', fetchError);
			return json({ ok: false, error: 'lab_report not found' }, { status: 404 });
		}

		const objectKey: string = report.src;
		const mimeType = guessMimeType(objectKey);

		// 2) Download the file from R2
		const getCmd = new GetObjectCommand({
			Bucket: R2_BUCKET,
			Key: objectKey
		});

		const r2Res = await r2.send(getCmd);

		if (!r2Res.Body) {
			console.error('R2 object Body is empty/null for key:', objectKey);
			return json({ ok: false, error: 'R2 object has no body' }, { status: 500 });
		}

		const buffer = await streamToBuffer(r2Res.Body as any);
		const base64Data = buffer.toString('base64');

		// 3) Call Gemini using the SAME pattern as your working project
		const prompt = `
You are a lab report extraction bot.

From this single lab report (image or PDF), find the NUMERIC values for:
- TSH
- Homocysteine
- BNP or NT-proBNP

Important:
- If a value is not present, use null.
- Respond ONLY with pure JSON like:
{"tsh": 2.5, "homocysteine": 14.2, "bnp": 560}
Do not add any extra text.
		`.trim();

		const result = await model.generateContent([
			{
				inlineData: {
					data: base64Data,
					mimeType
				}
			},
			{ text: prompt }
		]);

		const response = result.response;
		const text = response.text().trim();
		console.log('Gemini raw text:', text);

		let parsed: any = {};
		try {
			parsed = JSON.parse(text);
		} catch {
			// Try to salvage JSON substring if Gemini wrapped it in text
			const match = text.match(/\{[\s\S]*\}/);
			if (match) {
				parsed = JSON.parse(match[0]);
			} else {
				throw new Error('Could not parse AI response as JSON');
			}
		}

		const tsh = parsed.tsh ?? null;
		const homocysteine = parsed.homocysteine ?? null;
		const bnp = parsed.bnp ?? null;

		// 4) Update the lab_reports row with extracted values
		const { error: updateError } = await supabase
			.from('lab_reports')
			.update({
				homocysteine,
				tsh,
				bnp,
				updated_at: new Date().toISOString()
			})
			.eq('id', id);

		if (updateError) {
			console.error('Failed to update lab_report:', updateError);
			return json({ ok: false, error: 'Database update failed' }, { status: 500 });
		}

		return json({ ok: true, homocysteine, tsh, bnp });
	} catch (err) {
		console.error('Gemini processing error', err);
		return json({ ok: false, error: 'Processing failed' }, { status: 500 });
	}
};
