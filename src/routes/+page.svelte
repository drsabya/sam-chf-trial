<script lang="ts">
    import type { PageData } from './$types';
    import { fade, fly } from 'svelte/transition';
    // Added Table to imports
    import { Calendar, Plus, BookUser, UsersRound, Search, Table, Phone } from '@lucide/svelte';

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
                    <Search class="w-6 h-6" />
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
                    <Table class="w-6 h-6" />
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
    class="group relative block bg-white rounded-xl p-5 border border-slate-100/80
           shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] 
           hover:shadow-[0_8px_25px_-4px_rgba(0,0,0,0.08)] 
           hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-300 ease-out"
>
    <div class="flex items-center justify-between">
        <div class="flex flex-col gap-1.5">
            <h3 class="text-[17px] text-slate-800">
                <span class="font-semibold tracking-tight group-hover:text-emerald-950 transition-colors">
                    {formatName(visit.participant)}
                </span>
                {#if visit.participant?.screening_id}
                    <span class="ml-2 text-slate-400 font-medium text-[15px]">
                        {visit.participant.screening_id}
                    </span>
                {/if}
            </h3>

            <div class="flex items-center gap-4 text-xs font-semibold">
                
                <div class="flex items-center gap-1.5 bg-amber-200 px-2 py-1 rounded-md">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
                    </svg>
                    <span>
                        Due {formatDatePretty(visit.due_date)}
                    </span>
                </div>

                {#if visit.scheduled_on}
                    <div class="flex items-center gap-1.5  bg-emerald-200 px-2 py-1 rounded-md">
                        <Phone size ={14} />
                        <span>
                            {formatDatePretty(visit.scheduled_on)}
                        </span>
                    </div>
                {/if}
            </div>
        </div>

        <div class="flex flex-col items-center justify-center pl-6 border-l border-slate-50">
            <span class="font-thin text-slate-500 leading-none uppercase">
                visit
            </span>
            <span class="text-3xl font-semibold text-slate-700 leading-none mt-0.5">
            {visit.visit_number}
            </span>
        </div>
    </div>
</a>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>