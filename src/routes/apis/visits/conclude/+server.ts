// src/routes/apis/visits/conclude/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

/* ---------------------------------------------
   Helper: conclude visit & maybe create next
--------------------------------------------- */
async function concludeVisitAndMaybeCreateNext(options: {
	visitId: string;
	visitDateIso: string;
	nextVisitNumber?: number | null;
	fetch: typeof fetch;
}) {
	const { visitId, visitDateIso, nextVisitNumber, fetch } = options;

	// 1) Fetch visit for participant_id
	const { data: visit, error: visitError } = await supabase
		.from('visits')
		.select('id, participant_id')
		.eq('id', visitId)
		.single();

	if (visitError || !visit) {
		console.error('concludeVisit: visit load error', visitError);
		throw new Error('Could not load visit to conclude');
	}

	// 2) Update visit_date
	const { error: updateError } = await supabase
		.from('visits')
		.update({ visit_date: visitDateIso })
		.eq('id', visitId);

	if (updateError) {
		console.error('concludeVisit: update error', updateError);
		throw new Error('Could not mark visit as completed');
	}

	let nextVisitCreated = false;

	// 3) Optionally create next visit via /apis/visits/create
	if (nextVisitNumber != null) {
		try {
			const res = await fetch('/apis/visits/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					participantId: visit.participant_id,
					visitNumber: nextVisitNumber
				})
			});

			if (res.ok) {
				const body = await res.json().catch(() => null);
				if (body?.visit?.id) {
					nextVisitCreated = true;
				} else {
					console.warn('concludeVisit: create-next response missing visit.id', body);
				}
			} else {
				let errBody: any = null;
				try {
					errBody = await res.json();
				} catch {
					// ignore
				}
				console.error('concludeVisit: create-next failed', res.status, errBody);
			}
		} catch (err) {
			console.error('concludeVisit: network error while creating next visit', err);
		}
	}

	return { nextVisitCreated };
}

/* ---------------------------------------------
   Helper: parse optional YYYY-MM-DD override
--------------------------------------------- */
function parseOverride(raw: unknown): string | null {
	if (!raw || typeof raw !== 'string' || !raw.trim()) return null;

	const [y, m, d] = raw.split('-').map(Number);
	if (!y || !m || !d) return null;

	const dt = new Date(Date.UTC(y, m - 1, d));
	if (Number.isNaN(dt.getTime())) return null;

	return dt.toISOString();
}

/* ---------------------------------------------
   POST /apis/visits/conclude
--------------------------------------------- */
export const POST: RequestHandler = async ({ request, fetch }) => {
	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	const visitId = body?.visitId as string | undefined;
	const override = body?.overrideVisitDate as string | undefined;
	const nextVisitNumber = body?.createNextVisit as number | null | undefined;

	if (!visitId) {
		return json({ ok: false, error: 'visitId is required' }, { status: 400 });
	}

	// 1) Determine visit_date
	const parsed = parseOverride(override);
	const visitDateIso = parsed ?? new Date().toISOString();

	try {
		const result = await concludeVisitAndMaybeCreateNext({
			visitId,
			visitDateIso,
			nextVisitNumber,
			fetch
		});

		return json({
			ok: true,
			visitId,
			visitDate: visitDateIso,
			nextVisit: {
				created: result.nextVisitCreated,
				visitNumber: nextVisitNumber ?? null
			}
		});
	} catch (err: any) {
		console.error('Conclude visit API error:', err);
		return json(
			{ ok: false, error: err?.message ?? 'Server error while concluding visit' },
			{ status: 500 }
		);
	}
};
