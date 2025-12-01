<script lang="ts">
    import type { PageData } from './$types';
    import { fade, fly } from 'svelte/transition';
    // Added SquareKanban to imports
    import { Calendar, Plus, BookUser, UsersRound, UserRoundSearch, SquareKanban } from '@lucide/svelte';

    let { data }: { data: PageData } = $props();
    let visits = $state(data.visits ?? []);

    function formatDatePretty(value: string | null | undefined) {
        if (!value) return 'TBD';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return 'TBD';
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short'
        });
    }

    function formatName(participant: any | null) {
        if (!participant) return 'Unknown participant';
        const parts = [participant.first_name, participant.middle_name, participant.last_name]
            .map((x) => x?.trim())
            .filter(Boolean);
        return parts.join(' ') || 'Unknown participant';
    }
</script>

<div class="min-h-screen bg-[#FAFAFA] py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
    <div class="max-w-lg mx-auto space-y-10">
        <div class="px-1 pt-2">
            <h1 class="text-3xl font-light tracking-tight text-slate-900">SAM-CHF</h1>
            <p class="text-sm font-medium text-slate-400 mt-1 uppercase tracking-wider">
                Trial Dashboard
            </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
            <a
                href="/leads"
                class="group flex flex-col items-center justify-center py-5 px-2 rounded-2xl bg-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white hover:border-emerald-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300"
            >
                <div class="text-slate-400 group-hover:text-emerald-600 transition-colors duration-300">
                    <BookUser class="w-6 h-6" />
                </div>
                <span
                    class="text-[11px] mt-3 font-semibold text-slate-500 group-hover:text-emerald-900 tracking-wide"
                    >Leads</span
                >
            </a>

            <a
                href="/participants"
                class="group flex flex-col items-center justify-center py-5 px-2 rounded-2xl bg-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white hover:border-emerald-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300"
            >
                <div class="text-slate-400 group-hover:text-emerald-600 transition-colors duration-300">
                    <UserRoundSearch class="w-6 h-6" />
                </div>
                <span
                    class="text-[11px] mt-3 font-semibold text-slate-500 group-hover:text-emerald-900 tracking-wide"
                    >Participants</span
                >
            </a>

            <a
                href="/masterchart"
                class="group flex flex-col items-center justify-center py-5 px-2 rounded-2xl bg-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white hover:border-emerald-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300"
            >
                <div class="text-slate-400 group-hover:text-emerald-600 transition-colors duration-300">
                    <SquareKanban class="w-6 h-6" />
                </div>
                <span
                    class="text-[11px] mt-3 font-semibold text-slate-500 group-hover:text-emerald-900 tracking-wide"
                    >Masterchart</span
                >
            </a>

            <a
                href="/screening"
                class="group flex flex-col items-center justify-center py-5 px-2 rounded-2xl bg-emerald-600 text-white shadow-[0_8px_20px_rgb(5,150,105,0.25)] hover:bg-emerald-700 hover:shadow-[0_12px_25px_rgb(5,150,105,0.35)] hover:-translate-y-1 transition-all duration-300"
            >
                <Plus class="w-6 h-6 text-emerald-50" />
                <span class="text-[11px] mt-3 font-semibold tracking-wide text-white">Screening</span>
            </a>
        </div>

        <div class="space-y-5">
            <div class="flex items-center justify-between px-1">
                <h2 class="text-sm font-semibold text-slate-900">Upcoming Visits</h2>
                <span class="text-xs font-medium text-slate-400">{visits.length} scheduled</span>
            </div>

            {#if visits.length === 0}
                <div
                    in:fly={{ y: 5 }}
                    class="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200"
                >
                    <p class="text-sm text-slate-400">No upcoming visits found.</p>
                </div>
            {:else}
                <div class="space-y-4">
                    {#each visits as visit (visit.id)}
                        <a
                            href={`/visits/visit${visit.visit_number}/${visit.id}`}
                            class="group relative block bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-50
               hover:shadow-[0_12px_30px_rgb(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300"
                        >
                            <div class="flex items-start justify-between">
                                <div>
                                    <h3
                                        class="text-[16px] font-semibold text-slate-800 group-hover:text-emerald-900 transition-colors"
                                    >
                                        {formatName(visit.participant)}
                                    </h3>

                                    <div class="flex items-center gap-3 mt-1.5">
                                        <span class="text-xs font-medium text-slate-500">
                                            Visit {visit.visit_number}
                                        </span>
                                        {#if visit.participant?.screening_id}
                                            <span class="text-slate-300 text-[10px]">•</span>
                                            <span class="font-mono text-xs text-slate-400 tracking-tight">
                                                {visit.participant.screening_id}
                                            </span>
                                        {/if}
                                    </div>
                                </div>

                                <div class="flex flex-col items-end">
                                    <div
                                        class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 text-rose-600 transition-colors group-hover:bg-rose-100/80"
                                    >
                                        <div class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                                        <span class="text-xs font-bold tracking-wide"
                                            >{formatDatePretty(visit.due_date)}</span
                                        >
                                    </div>
                                    <span
                                        class="text-[10px] font-medium text-slate-300 mt-1 uppercase tracking-wider mr-1"
                                        >Due Date</span
                                    >
                                </div>
                            </div>
                        </a>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>