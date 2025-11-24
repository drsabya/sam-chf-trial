// src/routes/apis/leads/extract/+server.ts
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

import { r2, R2_BUCKET } from '$lib/server/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Buffer } from 'node:buffer';

// ---------- GEMINI SETUP (match lab_reports/process) ----------
const GEMINI_API_KEY = env.GEMINI_API_KEY;

console.log('Leads extractor – Gemini key present?', !!GEMINI_API_KEY);

if (!GEMINI_API_KEY) {
	throw new Error('GEMINI_API_KEY is not set in environment');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Use the same model that already works in your project
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ---------- HELPERS ----------
function guessMimeType(key: string): string {
	const lower = key.toLowerCase();
	if (lower.endsWith('.pdf')) return 'application/pdf';
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	if (lower.endsWith('.png')) return 'image/png';
	if (lower.endsWith('.webp')) return 'image/webp';
	return 'application/octet-stream';
}

async function getFileFromR2(objectKey: string): Promise<{ bytes: Buffer; mimeType: string }> {
	const command = new GetObjectCommand({
		Bucket: R2_BUCKET,
		Key: objectKey
	});

	const res = await r2.send(command);
	if (!res.Body) {
		throw new Error('Empty R2 object body');
	}

	const chunks: Uint8Array[] = [];
	for await (const chunk of res.Body as any as AsyncIterable<Uint8Array>) {
		chunks.push(chunk);
	}
	const bytes = Buffer.concat(chunks);
	const mimeType = (res.ContentType as string) || guessMimeType(objectKey);

	return { bytes, mimeType };
}

function cleanJsonText(text: string): string {
	// Strip Markdown fences if model wraps JSON in ```json ... ```
	return text
		.trim()
		.replace(/^```json/i, '')
		.replace(/^```/, '')
		.replace(/```$/, '')
		.trim();
}

// ---------- POST /apis/leads/extract ----------
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => null);
		const objectKey = body?.objectKey as string | undefined;

		if (!objectKey) {
			throw error(400, 'Missing objectKey');
		}

		// 1) Fetch file from R2
		const { bytes, mimeType } = await getFileFromR2(objectKey);

		// 2) Call Gemini
		const prompt = `
You are analyzing a clinical document or echocardiography report.

Extract exactly:
- firstName: patient's first name
- middleName: patient's middle name or null if no middle name
- lastName: patient's last name
- lvef: numeric LVEF percentage, e.g. 35 (no % symbol). Use null if you cannot find it.

Rules:
- If the name appears as "First Middle Last", split accordingly.
- If only two name parts appear, treat them as firstName and lastName; middleName = null.
- If there are multiple LVEF values, choose the final reported / most clinically relevant one.
- Return ONLY a single JSON object with the shape:
{
  "firstName": "John",
  "middleName": "A." or null,
  "lastName": "Doe",
  "lvef": 35 or null
}
No extra commentary or text.
		`.trim();

		const result = await model.generateContent([
			{
				inlineData: {
					data: bytes.toString('base64'),
					mimeType
				}
			},
			{ text: prompt }
		]);

		const response = await result.response;
		const rawText = response.text();
		const cleaned = cleanJsonText(rawText);

		let parsed: {
			firstName?: string;
			middleName?: string | null;
			lastName?: string;
			lvef?: number | string | null; // allow number or string, or null
		};

		try {
			parsed = JSON.parse(cleaned);
		} catch (e) {
			console.error('Failed to parse Gemini JSON for leads:', {
				rawText,
				cleaned,
				error: e
			});
			throw error(500, 'Gemini returned invalid JSON for lead extraction');
		}

		// ---- Normalize extracted values ----
		const firstName = parsed.firstName?.trim();
		const middleName = parsed.middleName?.trim?.() || null;
		const lastName = parsed.lastName?.trim();

		// LVEF parsing
		let lvef: number | null = null;

		if (typeof parsed.lvef === 'number') {
			lvef = parsed.lvef;
		} else if (typeof parsed.lvef === 'string') {
			const numeric = Number(parsed.lvef.replace('%', '').trim());
			if (!Number.isNaN(numeric)) {
				lvef = numeric;
			}
		} else {
			lvef = null;
		}

		if (!firstName || !lastName) {
			console.error('Name not detected from Gemini (leads):', parsed);
			return json(
				{
					ok: false,
					error: 'Could not confidently detect the patient name from the document.'
				},
				{ status: 200 }
			);
		}

		return json({
			ok: true,
			firstName,
			middleName,
			lastName,
			lvef
		});
	} catch (err: any) {
		// If this is a SvelteKit error() we rethrow it directly
		if (err?.status && err?.body) {
			throw err;
		}

		console.error('Leads extract endpoint failed:', err);
		throw error(500, 'Failed to extract lead data from document');
	}
};
