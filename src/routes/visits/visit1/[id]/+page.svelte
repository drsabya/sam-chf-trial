<!-- src/routes/visits/visit1/[id]/+page.svelte -->
<script lang="ts">
    import type { PageProps } from './$types';
    import { 
        CircleCheck, 
        Clock, 
        OctagonAlert, 
        CircleX,
        ArrowRight,
        CalendarDays
    } from '@lucide/svelte';
    import { fly } from 'svelte/transition';
    import VisitHeader from '$lib/components/visits/VisitHeader.svelte';
    import VisitVoucher from '$lib/components/visits/VisitVoucher.svelte';
    import VisitEcg from '$lib/components/visits/VisitEcg.svelte';
    import VisitEfficacyLabs from '$lib/components/visits/VisitEfficacyLabs.svelte';
    import VisitEcho from '$lib/components/visits/VisitEcho.svelte';
    import VisitSafetyLabs from '$lib/components/visits/VisitSafetyLabs.svelte';
    import VisitScheduling from '$lib/components/visits/VisitScheduling.svelte';
    import VisitBloodCollection from '$lib/components/visits/VisitBloodCollection.svelte';

    let { data }: PageProps = $props();
    let visit = $state(data.visit);
    let participant = $state(data.participant);
    let opdOptions = $state<string[]>(data.opdOptions ?? []);

    // --- State Helpers ---
    const isConcluded = $derived(visit.visit_date !== null);
    const isScreeningFailure = $derived(participant.screening_failure === true);

    // --- Visit conclusion state ---
    type VoucherStatus = '' | 'given' | 'not_given';
    type ScreeningOutcome = '' | 'failure' | 'success';

    let voucherStatus = $derived<VoucherStatus>(
        visit.voucher_given === true ? 'given' : visit.voucher_given === false ? 'not_given' : ''
    );

    let screeningOutcome = $state<ScreeningOutcome>('');
    
    // Date override state
    let useCustomDate = $state(false);
    let customDate = $state(new Date().toISOString().split('T')[0]);

    const concludeButtonColorClass = $derived(
        screeningOutcome === 'failure'
            ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
            : screeningOutcome === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                : 'bg-slate-800 hover:bg-slate-900 shadow-slate-200'
    );

    const hasRandomizationId = $derived(Boolean(participant.randomization_id));

    const concludeLabel = $derived(
        hasRandomizationId
            ? 'Save Changes'
            : screeningOutcome === 'failure'
                ? 'Confirm Screening Failure'
                : screeningOutcome === 'success'
                    ? 'Randomize Participant'
                    : 'Conclude Visit'
    );

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
</script>

<div class="min-h-screen bg-slate-50/50 font-sans text-slate-900 pb-32">
    <!-- Subtle Gradient Background -->
    <div
        class="fixed top-0 left-0 right-0 h-[30rem] bg-gradient-to-b from-white via-slate-50 to-transparent -z-10 pointer-events-none"
    ></div>

    <div class="max-w-2xl mx-auto pt-8 px-4 sm:px-6 flex flex-col gap-8" in:fly={{ y: 20, delay: 100, duration: 600 }}>
        <VisitHeader {participant} {visit} />

        <div class="flex flex-col gap-6">
            <VisitScheduling bind:visit />
            <section in:fly={{ y: 20, delay: 100, duration: 600 }}>
                <VisitBloodCollection {visit} />
            </section>

            <VisitEcg {participant} {visit} sectionTitle="ECG" />

            <VisitEcho bind:visit {participant} sectionTitle="Echocardiogram" sectionSubtitle="2D Echo" />

            <VisitEfficacyLabs
                bind:visit
                {participant}
                sectionTitle="Efficacy Markers"
                sectionSubtitle="NT-proBNP, TSH, Homocysteine"
            />

            <VisitSafetyLabs
                bind:visit
                {participant}
                sectionTitle="Safety Variables"
                sectionSubtitle="CBC, LFT, RFT, Lipid Profile"
            />
        </div>

        <div class="space-y-6 pt-4 border-t border-slate-200/60">
            <!-- Voucher Selection (Always Visible) -->
            <VisitVoucher
                {visit}
                {participant}
            />

            {#if isConcluded}
                <section in:fly={{ y: 20, delay: 300, duration: 600 }}>
                    <div class="flex items-center gap-2 mb-4 px-1">
                        <div class="p-1.5 rounded-full bg-slate-100 text-slate-500">
                            <CircleCheck class="w-4 h-4" />
                        </div>
                        <h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
                            Visit Status
                        </h3>
                    </div>

                    {#if isScreeningFailure}
                        <div class="bg-rose-50/80 rounded-2xl border border-rose-200 p-4 flex items-center gap-3">
                            <div class="bg-rose-100 text-rose-700 p-2 rounded-full">
                                <CircleX class="w-5 h-5" />
                            </div>
                            <div class="flex flex-col">
                                <span class="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    Screening Status
                                </span>
                                <span class="text-sm font-semibold text-rose-800">
                                    Screening Failure declared on {formatDatePretty(visit.visit_date)}
                                </span>
                            </div>
                        </div>
                    {:else}
                        <div class="bg-emerald-50/80 rounded-2xl border border-emerald-200 p-4 flex items-center gap-3">
                            <div class="bg-emerald-100 text-emerald-700 p-2 rounded-full">
                                <CircleCheck class="w-5 h-5" />
                            </div>
                            <div class="flex flex-col">
                                <span class="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    Visit 1 Status
                                </span>
                                <span class="text-sm font-semibold text-emerald-800">
                                    Completed on {formatDatePretty(visit.visit_date)}
                                </span>
                            </div>
                        </div>
                    {/if}
                </section>
            
            {:else}
                
                <section in:fly={{ y: 20, delay: 300, duration: 600 }}>
                    <div class="flex items-center gap-2 mb-4 px-1">
                        <div class="p-1.5 rounded-full bg-slate-100 text-slate-500">
                            <ArrowRight class="w-4 h-4" />
                        </div>
                        <h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
                            Finalize Visit
                        </h3>
                    </div>

                    <form
                        method="POST"
                        action="?/conclude"
                        class="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-xl shadow-slate-200/40 space-y-6"
                    >
                        <input type="hidden" name="voucher_status" value={voucherStatus} />

                        {#if !hasRandomizationId}
                        <div class="space-y-4">
                            <div class="flex items-baseline justify-between">
                                <span class="text-xs font-bold text-slate-500 uppercase tracking-wide">Screening Outcome</span>
                                <span class="text-xs text-slate-400 font-medium">* Required</span>
                            </div>
                            
                            <!-- Enhanced Selection Grid (Minimalistic) -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <!-- Failure Option -->
                                <label class="group relative cursor-pointer outline-none">
                                    <input 
                                        type="radio" 
                                        name="screening_outcome" 
                                        value="failure" 
                                        bind:group={screeningOutcome}
                                        class="peer sr-only"
                                    />
                                    <div class="
                                        h-full flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border transition-all duration-200 ease-out
                                        bg-white border-slate-200 text-slate-500
                                        hover:border-rose-300 hover:bg-rose-50/30
                                        peer-checked:bg-rose-50/50 peer-checked:border-rose-500 peer-checked:text-rose-700
                                        peer-focus-visible:ring-2 peer-focus-visible:ring-rose-500/20
                                    ">
                                        <div class="p-2.5 rounded-full bg-slate-50 border border-slate-100 peer-checked:bg-white peer-checked:border-rose-200">
                                            <OctagonAlert class="w-6 h-6" />
                                        </div>
                                        <div class="text-center">
                                            <span class="block text-sm font-bold">Screening Failure</span>
                                            <span class="text-xs opacity-70 mt-0.5 block">Terminate participation</span>
                                        </div>
                                    </div>
                                    <div class="absolute top-3 right-3 opacity-0 scale-90 peer-checked:opacity-100 peer-checked:scale-100 transition-all duration-200 text-rose-500">
                                        <CircleCheck class="w-4 h-4 fill-rose-500 text-white" />
                                    </div>
                                </label>

                                <!-- Success Option -->
                                <label class="group relative cursor-pointer outline-none">
                                    <input 
                                        type="radio" 
                                        name="screening_outcome" 
                                        value="success" 
                                        bind:group={screeningOutcome}
                                        class="peer sr-only"
                                    />
                                    <div class="
                                        h-full flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border transition-all duration-200 ease-out
                                        bg-white border-slate-200 text-slate-500
                                        hover:border-emerald-300 hover:bg-emerald-50/30
                                        peer-checked:bg-emerald-50/50 peer-checked:border-emerald-500 peer-checked:text-emerald-700
                                        peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/20
                                    ">
                                        <div class="p-2.5 rounded-full bg-slate-50 border border-slate-100 peer-checked:bg-white peer-checked:border-emerald-200">
                                            <CircleCheck class="w-6 h-6" />
                                        </div>
                                        <div class="text-center">
                                            <span class="block text-sm font-bold">Screening Success</span>
                                            <span class="text-xs opacity-70 mt-0.5 block">Proceed to randomization</span>
                                        </div>
                                    </div>
                                    <div class="absolute top-3 right-3 opacity-0 scale-90 peer-checked:opacity-100 peer-checked:scale-100 transition-all duration-200 text-emerald-500">
                                        <CircleCheck class="w-4 h-4 fill-emerald-500 text-white" />
                                    </div>
                                </label>
                            </div>
                        </div>
                        {/if}

                        <!-- Date Override Section -->
                         <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200/60">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-500">
                                        <CalendarDays class="w-4 h-4" />
                                    </div>
                                    <div class="flex flex-col">
                                        <span class="text-xs font-bold text-slate-500 uppercase tracking-wide">Completion Date</span>
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
                                <div class="mt-4 pt-4 border-t border-slate-200 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <label class="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Select Date</label>
                                    <input 
                                        type="date" 
                                        name="visit_date" 
                                        bind:value={customDate}
                                        class="w-full rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-900 focus:border-emerald-500 focus:ring-emerald-500 shadow-sm p-2.5"
                                    />
                                </div>
                            {/if}
                         </div>

                        <div class="pt-2">
                            <button
                                type="submit"
                                disabled={!voucherStatus || (!hasRandomizationId && !screeningOutcome)}
                                class={'w-full group relative inline-flex items-center justify-center gap-3 rounded-2xl px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none focus:outline-none focus:ring-4 focus:ring-offset-2 ' +
                                    concludeButtonColorClass}
                            >
                                <span class="relative flex items-center gap-2">
                                    {#if hasRandomizationId}
                                        <CircleCheck class="w-4 h-4" />
                                    {:else if screeningOutcome === 'failure'}
                                        <OctagonAlert class="w-4 h-4" />
                                    {:else if screeningOutcome === 'success'}
                                        <CircleCheck class="w-4 h-4" />
                                    {:else}
                                        <Clock class="w-4 h-4" />
                                    {/if}
                                    <span class="tracking-wide">{concludeLabel}</span>
                                </span>
                            </button>
                        </div>
                    </form>
                </section>
            {/if}
        </div>
    </div>
</div>
