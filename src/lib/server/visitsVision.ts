// src/lib/server/visitsVision.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '$env/dynamic/private';
import { supabase } from '$lib/supabaseClient';

/**
 * Get a Gemini model dynamically.
 * This prevents Netlify from inlining secrets in the build output.
 */
function getModel() {
	const apiKey = env.GEMINI_API_KEY;

	if (!apiKey) {
		throw new Error('GEMINI_API_KEY is not set');
	}

	const genAI = new GoogleGenerativeAI(apiKey);

	// You can change the model later if needed
	return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

type VisitLabPatch = Record<string, number | null>;

/**
 * Shared helper to update lab / echo fields on a visit
 */
export async function updateVisitLabs(visitId: string, patch: VisitLabPatch) {
	const { data, error } = await supabase
		.from('visits')
		.update(patch)
		.eq('id', visitId)
		.select()
		.single();

	if (error) {
		console.error('Error updating visit labs', { visitId, patch, error });
		throw new Error('Failed to update visit labs');
	}

	return data;
}

/**
 * Shared helper to run a Gemini Vision prompt that MUST return JSON.
 * You will pass different prompts for echo/efficacy/safety.
 */
export async function runVisionJsonExtraction(options: {
	buffer: ArrayBuffer;
	mimeType: string;
	prompt: string;
}) {
	const { buffer, mimeType, prompt } = options;

	const base64Data = Buffer.from(buffer).toString('base64');

	// Get model dynamically (runtime, not at build)
	const model = getModel();

	const result = await model.generateContent({
		contents: [
			{
				role: 'user',
				parts: [
					{
						inlineData: {
							data: base64Data,
							mimeType
						}
					},
					{
						text: prompt
					}
				]
			}
		]
	});

	const text = result.response.text().trim();

	// Extract the JSON object from the response safely
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');

	if (start === -1 || end === -1 || end <= start) {
		console.error('Gemini did not return JSON:', text);
		throw new Error('Gemini did not return JSON');
	}

	const jsonText = text.slice(start, end + 1);

	try {
		const parsed = JSON.parse(jsonText);
		return parsed;
	} catch (err) {
		console.error('Failed to parse Gemini JSON:', { text: jsonText, err });
		throw new Error('Failed to parse JSON from Gemini');
	}
}
