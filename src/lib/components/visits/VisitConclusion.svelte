<script lang="ts">
    import { CircleCheck, Loader, CalendarDays } from '@lucide/svelte';

    interface Props {
        visit: any;
        labelVisit?: string;
        nextVisitNumber?: number | null;
        allowCustomDate?: boolean;
        description?: string;
    }

    let {
        visit = $bindable(),
        labelVisit = 'Visit',
        nextVisitNumber = null,
        allowCustomDate = true,
        description = 'Clicking the button will mark this visit as completed and automatically create the next visit as per protocol.'
    }: Props = $props();

    // Date override state (matching visit1 UI pattern)
    let useCustomDate = $state(false);
    let customDate = $state(new Date().toISOString().split('T')[0]);

    let concluding = $state(false);
    let error = $state<string | null>(null);

    function formatDatePretty(value: string | null | undefined) {
        if (!value) return 'Not set';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return 'Not set';
        return d.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    async function handleConclude() {
        if (concluding) return;
        concluding = true;
        error = null;

        try {
            const res = await fetch('/apis/visits/conclude', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitId: visit.id,
                    // If custom date mode is active, send the date, otherwise null (backend assumes Today)
                    overrideVisitDate: allowCustomDate && useCustomDate ? customDate : null,
                    createNextVisit: nextVisitNumber
                })
            });

            let out: any = null;
            try {
                out = await res.json();
            } catch {
                // ignore JSON parse error
            }

            if (!res.ok || !out?.ok) {
                error = out?.error ?? 'Failed to conclude visit.';
                return;
            }

            // Since 'visit' is $bindable(), this reassignment is allowed
            // and will update the UI immediately.
            visit = {
                ...visit,
                visit_date: out.visitDate
            };
        } catch (err) {
            console.error(err);
            error = 'Network error while concluding visit.';
        } finally {
            concluding = false;
        }
    }
</script>

{#if visit.visit_date}
    <div
        class="mt-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 p-4 flex items-center gap-3"
    >
        <div class="bg-emerald-100 text-emerald-700 p-2 rounded-full">
            <CircleCheck class="w-5 h-5" />
        </div>
        <div class="flex flex-col">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wide">
                {labelVisit} status
            </span>
            <span class="text-sm font-semibold text-emerald-800">
                Completed on {formatDatePretty(visit.visit_date)}
            </span>
        </div>
    </div>
{:else}
    <div class="mt-4 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-4">
        <div>
            <div class="flex items-center gap-2 mb-1">
                <CircleCheck class="w-4 h-4 text-slate-700" />
                <h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {labelVisit} conclusion
                </h3>
            </div>

            <p class="text-xs text-slate-500 mt-2 leading-relaxed">
                {description}
            </p>
        </div>

        {#if allowCustomDate}
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-500">
                            <CalendarDays class="w-4 h-4" />
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Completion Date</span>
                            <span class="text-sm font-medium text-slate-900">
                                {useCustomDate ? new Date(customDate).toLocaleDateString() : 'Today'}
                            </span>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onclick={() => useCustomDate = !useCustomDate}
                        class="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline px-2 py-1"
                    >
                        {useCustomDate ? 'Reset to Today' : 'Change Date'}
                    </button>
                </div>

                {#if useCustomDate}
                    <div class="mt-3 pt-3 border-t border-slate-200 animate-in slide-in-from-top-2 fade-in duration-200">
                        <label class="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Select Date</label>
                        <input 
                            type="date" 
                            bind:value={customDate}
                            class="w-full rounded-lg border-slate-200 bg-white text-sm font-medium text-slate-900 focus:border-emerald-500 focus:ring-emerald-500 shadow-sm p-2"
                        />
                    </div>
                {/if}
            </div>
        {/if}

        {#if error}
            <p class="text-[11px] text-rose-600 font-medium px-1">{error}</p>
        {/if}

        <button
            type="button"
            onclick={handleConclude}
            disabled={concluding}
            class="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-950 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
            {#if concluding}
                <Loader class="w-4 h-4 animate-spin" />
                <span>Concluding…</span>
            {:else}
                <CircleCheck class="w-4 h-4" />
                <span>Mark {labelVisit} completed</span>
            {/if}
        </button>
    </div>
{/if}