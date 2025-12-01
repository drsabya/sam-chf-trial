// src/routes/visits/visit1/[id]/+page.server.ts

import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

// Types
type ParticipantRow = {
    id: string;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    phone: string | null;
    initials: string | null;
    screening_id: string | null;
    randomization_id: string | null;
    screening_failure: boolean | null;
};

type VisitRow = {
    id: string;
    participant_id: string;
    visit_number: number;
    created_at: string | null;
    due_date: string | null;
    scheduled_on: string | null;
    visit_date: string | null;
    voucher_given: boolean | null;

    ecg_src: string | null;
    echo_src: string | null;
    efficacy_src: string | null;
    safety_src: string | null;
};

/* ---------------------------------------------
   DATE HELPERS
--------------------------------------------- */

function toUtcStartOfDay(dateInput: Date | string): Date {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function addUtcDays(base: Date, days: number): Date {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

function generateOpdOptions(start: Date, end: Date): string[] {
    const TARGET_DAYS = [2, 3, 5]; // Tue, Wed, Fri
    const options: string[] = [];

    let cursor = toUtcStartOfDay(start);
    const last = toUtcStartOfDay(end);

    if (cursor > last) return [];

    while (cursor.getTime() <= last.getTime()) {
        if (TARGET_DAYS.includes(cursor.getUTCDay())) {
            options.push(cursor.toISOString().slice(0, 10));
        }
        cursor = addUtcDays(cursor, 1);
    }

    return options;
}

/* ---------------------------------------------
   LOAD
--------------------------------------------- */

export const load: PageServerLoad = async ({ params }) => {
    const id = params.id;
    if (!id) throw error(400, 'Visit ID is required');

    // 1. Visit
    const { data: visit, error: visitError } = await supabase
        .from('visits')
        .select('*')
        .eq('id', id)
        .single<VisitRow>();

    if (visitError || !visit) {
        console.error('Error fetching visit:', visitError);
        throw error(500, 'Could not load visit');
    }

    // 2. Participant
    const { data: participant, error: participantError } = await supabase
        .from('participants')
        .select(
            'id, first_name, middle_name, last_name, phone, initials, screening_id, randomization_id, screening_failure'
        )
        .eq('id', visit.participant_id)
        .single<ParticipantRow>();

    if (participantError || !participant) {
        console.error('Error fetching participant:', participantError);
        throw error(500, 'Could not load participant');
    }

    // 3. OPD options
    const createdAtRaw = visit.created_at || new Date().toISOString();
    const startDate = toUtcStartOfDay(createdAtRaw);

    const dueDateRaw = visit.due_date ? visit.due_date : addUtcDays(startDate, 14).toISOString();
    const endDate = toUtcStartOfDay(dueDateRaw);
    const opdOptions = generateOpdOptions(startDate, endDate);

    return {
        visit,
        participant,
        opdOptions
    };
};

/* ---------------------------------------------
   ACTIONS
--------------------------------------------- */

export const actions: Actions = {
    /* ---------------------------------------------
       UPDATE OPD DATE
    --------------------------------------------- */
    update: async ({ request, params }) => {
        const id = params.id;
        if (!id) throw error(400, 'Visit ID is required');

        const formData = await request.formData();
        const scheduled_on = formData.get('scheduled_on');
        const visit_date_raw = formData.get('visit_date');

        if (typeof scheduled_on !== 'string' || !scheduled_on) {
            return fail(400, { message: 'Please select an OPD date.' });
        }

        const { data: visit, error: visitError } = await supabase
            .from('visits')
            .select('id, created_at, due_date')
            .eq('id', id)
            .single();

        if (visitError || !visit) {
            return fail(500, { message: 'Could not validate visit constraints.' });
        }

        const startDate = toUtcStartOfDay(visit.created_at || new Date());
        const endDate = visit.due_date ? toUtcStartOfDay(visit.due_date) : addUtcDays(startDate, 14);

        const selectedScheduledDate = toUtcStartOfDay(scheduled_on);

        if (selectedScheduledDate < startDate || selectedScheduledDate > endDate) {
            return fail(400, {
                message: 'Selected OPD date is outside allowed window.'
            });
        }

        if (![2, 3, 5].includes(selectedScheduledDate.getUTCDay())) {
            return fail(400, { message: 'Only Tue, Wed, Fri allowed.' });
        }

        let visit_date: string | null = null;

        if (typeof visit_date_raw === 'string' && visit_date_raw) {
            const d = toUtcStartOfDay(visit_date_raw);
            if (d < startDate || d > endDate) {
                return fail(400, { message: 'Visit date outside allowed window.' });
            }
            visit_date = visit_date_raw;
        } else if (typeof visit_date_raw === 'string') {
            visit_date = null;
        }

        const payload: any = { scheduled_on };
        if (typeof visit_date_raw === 'string') payload.visit_date = visit_date;

        const { error: updateError } = await supabase.from('visits').update(payload).eq('id', id);

        if (updateError) {
            console.error('Error updating visit:', updateError);
            return fail(500, { message: 'Failed saving appointment' });
        }

        return { success: true };
    },

    /* ---------------------------------------------
       CONCLUDE VISIT 1
       - Handles voucher + screening outcome + randomization
       - Delegates visit_date + next visit creation to /apis/visits/conclude
    --------------------------------------------- */
    conclude: async ({ request, params, fetch }) => {
        const id = params.id;
        if (!id) throw error(400, 'Visit ID is required');

        const formData = await request.formData();
        const voucher_status = formData.get('voucher_status') as string | null;
        const screening_outcome = formData.get('screening_outcome') as string | null;
        // Capture optional visit_date override from form
        const visit_date_override = formData.get('visit_date') as string | null;

        // Voucher is always required
        if (!voucher_status) {
            return fail(400, {
                message: 'Voucher status is required.'
            });
        }

        const voucherGiven =
            voucher_status === 'given' ? true : voucher_status === 'not_given' ? false : null;

        // 1️⃣ Fetch visit to get participant_id
        const { data: visit, error: vErr } = await supabase
            .from('visits')
            .select('id, participant_id')
            .eq('id', id)
            .single();

        if (vErr || !visit) {
            console.error('Error fetching visit in conclude:', vErr);
            throw error(500, 'Could not conclude visit');
        }

        const participantId = visit.participant_id;

        // 2️⃣ Fetch participant to check randomization_id
        const { data: participant, error: pErr } = await supabase
            .from('participants')
            .select('id, randomization_id')
            .eq('id', participantId)
            .single<Pick<ParticipantRow, 'id' | 'randomization_id'>>();

        if (pErr || !participant) {
            console.error('Error fetching participant in conclude:', pErr);
            throw error(500, 'Could not conclude visit');
        }

        /* ------------------------------------------------
           CASE A: Already randomized → button = "Save"
           → Only update voucher_given for this visit
           → Do NOT call conclude API again
        ------------------------------------------------- */
        if (participant.randomization_id) {
            if (voucherGiven !== null) {
                const { error: vUpdateErr } = await supabase
                    .from('visits')
                    .update({ voucher_given: voucherGiven })
                    .eq('id', id);

                if (vUpdateErr) {
                    console.error('Error updating voucher_given:', vUpdateErr);
                    throw error(500, 'Could not save voucher status');
                }
            }

            return { success: true };
        }

        /* ------------------------------------------------
           CASE B: Not randomized yet → true screening conclusion
           → Need screening_outcome
           → visit_date + next visit handled by /apis/visits/conclude
        ------------------------------------------------- */
        if (!screening_outcome) {
            return fail(400, {
                message: 'Screening outcome is required to conclude screening.'
            });
        }

        // Always update voucher_given (if provided) alongside screening outcome
        if (voucherGiven !== null) {
            const { error: vUpdateErr } = await supabase
                .from('visits')
                .update({ voucher_given: voucherGiven })
                .eq('id', id);

            if (vUpdateErr) {
                console.error('Error updating voucher on conclude:', vUpdateErr);
                throw error(500, 'Could not update visit voucher status');
            }
        }

        // --- B1: Screening FAILURE ---
        if (screening_outcome === 'failure') {
            // Mark screening failure on participant
            const { error: failErr } = await supabase
                .from('participants')
                .update({ screening_failure: true })
                .eq('id', participantId);

            if (failErr) {
                console.error('Error updating screening_failure:', failErr);
                throw error(500, 'Could not update screening status');
            }

            // Use generic conclude API to set visit_date (today or override), no next visit
            try {
                const res = await fetch('/apis/visits/conclude', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        visitId: id,
                        overrideVisitDate: visit_date_override // Pass the override date
                    })
                });

                let body: any = null;
                try {
                    body = await res.json();
                } catch {
                    // ignore JSON parse errors
                }

                if (!res.ok || !body?.ok) {
                    console.error('Conclude API failed for screening failure:', res.status, body);
                    throw error(500, 'Could not finalize screening failure');
                }
            } catch (e) {
                console.error('Network error calling conclude API (failure):', e);
                throw error(500, 'Could not finalize screening failure');
            }

            return { success: true };
        }

        // --- B2: Screening SUCCESS → Randomize & conclude via API ---
        if (screening_outcome === 'success') {
            // Compute next randomization ID (R1, R2, ...)
            const { data: rows, error: rErr } = await supabase
                .from('participants')
                .select('randomization_id')
                .not('randomization_id', 'is', null);

            if (rErr) {
                console.error('Error fetching randomization list:', rErr);
                throw error(500, 'Could not calculate randomization number');
            }

            let max = 0;

            for (const row of rows ?? []) {
                const rid = row.randomization_id as string | null;
                if (!rid) continue;
                const match = rid.match(/^R(\d+)$/i);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!Number.isNaN(num) && num > max) max = num;
                }
            }

            const nextId = `R${max + 1}`;

            // Assign randomization ID
            const { error: assignErr } = await supabase
                .from('participants')
                .update({ randomization_id: nextId })
                .eq('id', participantId);

            if (assignErr) {
                console.error('Error assigning randomization ID:', assignErr);
                throw error(500, 'Randomization failed');
            }

            // Use generic conclude API to:
            // - set visit_date = today (or override)
            // - auto-create Visit 2
            try {
                const res = await fetch('/apis/visits/conclude', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        visitId: id,
                        createNextVisit: 2,
                        overrideVisitDate: visit_date_override // Pass the override date
                    })
                });

                let body: any = null;
                try {
                    body = await res.json();
                } catch {
                    // ignore JSON parse errors
                }

                if (!res.ok || !body?.ok) {
                    console.error('Conclude API failed for screening success:', res.status, body);
                    // randomization is already done; we still treat as success but report error
                    throw error(500, 'Randomization done; could not finalize visit');
                }
            } catch (e) {
                console.error('Network error calling conclude API (success):', e);
                throw error(500, 'Randomization done; could not finalize visit');
            }

            return { success: true, randomization_id: nextId };
        }

        // Fallback (should not hit)
        return { success: true };
    }
};