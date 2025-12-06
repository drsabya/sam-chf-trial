<!-- src/routes/+page.svelte -->
<script lang="ts">
    import type { PageData } from './$types';
    import { fade, fly, slide } from 'svelte/transition';
    import {
        Calendar as CalendarIcon,
        Plus,
        BookUser,
        Table,
        Phone,
        Search,
        List,
        ChevronLeft,
        ChevronRight,
        ChevronDown,
        Clock,
        User,
        Wallet,
        FingerprintPattern,
        Printer
    } from '@lucide/svelte';

    let { data }: { data: PageData } = $props();

    // State
    let visits = $state(data.visits ?? []);
    let viewMode = $state<'list' | 'calendar'>('calendar'); // default is now calendar
    let showSuggestionDetails = $state(false); // Toggle for suggestion list

    // Calendar State
    let today = new Date();
    let currentMonth = $state(today.getMonth());
    let currentYear = $state(today.getFullYear());
    let selectedDate = $state<string | null>(null);

    // --- OPD Logic ---
    const OPD_WEEKDAYS = [2, 3, 5]; // Tue, Wed, Fri

    function getVisitWindowPadding(visitNumber: number | null | undefined) {
        const n = Number(visitNumber ?? 0);
        if (n === 1) return { minus: 14, plus: 0 };
        if (n >= 2 && n <= 5) return { minus: 7, plus: 7 };
        if (n >= 6 && n <= 8) return { minus: 14, plus: 14 };
        return { minus: 0, plus: 0 };
    }

    type VisitWithParticipant = typeof visits[number];

    type OpdSlot = {
        date: Date;
        dateKey: string;
        visits: VisitWithParticipant[];
    };

    function startOfDay(d: Date) {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
    }

    function buildOpdScheduleSuggestions(
        allVisits: VisitWithParticipant[],
        now: Date = new Date()
    ): OpdSlot[] {
        const today = startOfDay(now);
        const slotsByKey: Record<string, OpdSlot> = {};

        for (const v of allVisits) {
            if (!v.due_date) continue;

            const due = startOfDay(new Date(v.due_date));
            if (Number.isNaN(due.getTime())) continue;

            const { minus, plus } = getVisitWindowPadding(v.visit_number);

            // Earliest allowed day
            const windowStart = startOfDay(new Date(due));
            windowStart.setDate(windowStart.getDate() - minus);

            // Latest allowed by protocol, before applying due-date cap
            const protocolEnd = startOfDay(new Date(due));
            protocolEnd.setDate(protocolEnd.getDate() + plus);

            // Hard rule: NEVER suggest a date after due_date
            const windowEnd = protocolEnd.getTime() > due.getTime() ? due : protocolEnd;

            // If the (capped) window is entirely in the past, skip this visit
            if (windowEnd.getTime() < today.getTime()) continue;

            // Do not suggest any dates before "today"
            const start =
                windowStart.getTime() < today.getTime() ? today : windowStart;

            // Walk the window and keep only OPD days (Tue/Wed/Fri)
            for (
                let d = new Date(start);
                d.getTime() <= windowEnd.getTime();
                d.setDate(d.getDate() + 1)
            ) {
                const weekday = d.getDay(); // 0–6 (Sun–Sat)
                if (!OPD_WEEKDAYS.includes(weekday)) continue;

                const dateKey = d.toISOString().slice(0, 10); // 'YYYY-MM-DD'

                if (!slotsByKey[dateKey]) {
                    slotsByKey[dateKey] = {
                        date: new Date(d),
                        dateKey,
                        visits: []
                    };
                }

                slotsByKey[dateKey].visits.push(v);
            }
        }

        // Sort:
        // 1) More patients first
        // 2) Earlier dates when counts tie
        return Object.values(slotsByKey).sort((a, b) => {
            if (b.visits.length !== a.visits.length) {
                return b.visits.length - a.visits.length;
            }
            return a.date.getTime() - b.date.getTime();
        });
    }

    const opdSuggestions = $derived(buildOpdScheduleSuggestions(visits));
    const bestOpdSlot = $derived(opdSuggestions[0] ?? null);

    // --- Helpers ---
    function isOverdue(due: string | null | undefined) {
        if (!due) return false;
        const d = new Date(due);
        d.setHours(0, 0, 0, 0);
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return d.getTime() < t.getTime();
    }

    function formatDatePretty(value: string | null | undefined) {
        if (!value) return 'TBD';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return 'TBD';
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }

    function formatName(participant: any | null) {
        if (!participant) return 'Unknown participant';
        const parts = [participant.first_name, participant.middle_name, participant.last_name]
            .map((x) => x?.trim())
            .filter(Boolean);
        return parts.join(' ') || 'Unknown participant';
    }

    // --- Calendar Logic ---
    let visitsByDate = $derived.by(() => {
        const map: Record<string, typeof visits> = {};
        for (const v of visits) {
            if (!v.scheduled_on) continue;
            const d = new Date(v.scheduled_on);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                d.getDate()
            ).padStart(2, '0')}`;
            if (!map[key]) map[key] = [];
            map[key].push(v);
        }
        return map;
    });

    let calendarGrid = $derived.by(() => {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();

        let days: (number | null)[] = [];
        for (let i = 0; i < startDayOfWeek; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        return days;
    });

    let monthLabel = $derived(
        new Date(currentYear, currentMonth).toLocaleString('default', {
            month: 'long',
            year: 'numeric'
        })
    );

    function prevMonth() {
        if (currentMonth === 0) {
            currentMonth = 11;
            currentYear--;
        } else {
            currentMonth--;
        }
        selectedDate = null;
    }

    function nextMonth() {
        if (currentMonth === 11) {
            currentMonth = 0;
            currentYear++;
        } else {
            currentMonth++;
        }
        selectedDate = null;
    }

    function selectDay(day: number) {
        const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
            day
        ).padStart(2, '0')}`;
        selectedDate = selectedDate === key ? null : key;
    }

    let displayedVisits = $derived.by(() => {
        if (viewMode === 'list') return visits;
        if (viewMode === 'calendar' && selectedDate) {
            return visitsByDate[selectedDate] ?? [];
        }
        return [];
    });
</script>

<div class="min-h-screen bg-[#FAFAFA] py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
    <div class="max-w-lg mx-auto space-y-8">
        <div class="px-1 pt-2">
            <!-- Username instead of static SAM-CHF -->
            <h1 class="text-3xl font-light tracking-tight text-slate-900">
                Hi {(data.username ?? 'SAM-CHF').charAt(0).toUpperCase() +
                    (data.username ?? 'SAM-CHF').slice(1)}!
            </h1>

            <p class="text-sm font-medium text-slate-400 mt-1 uppercase tracking-wider">
                SAM-CHF Trial Dashboard
            </p>
        </div>

        <nav class="flex flex-wrap gap-2">
            <a
                href="/screening"
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-medium shadow-xl/5 shadow-emerald-200 hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
                <Plus class="w-4 h-4" />
                <span>Screening</span>
            </a>

            <a
                href="/leads"
                class="group inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 shadow-xl/3 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
            >
                <BookUser
                    class="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors"
                />
                <span>Leads</span>
            </a>

            <a
                href="/participants"
                class="group inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 shadow-xl/3 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
            >
                <Search
                    class="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors"
                />
                <span>Search</span>
            </a>

            <a
                href="/masterchart"
                class="group inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 shadow-xl/3 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
            >
                <Table
                    class="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors"
                />
                <span>Masterchart</span>
            </a>

            <a
                href="/finances"
                class="group inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 shadow-xl/3 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
            >
                <Wallet
                    class="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors"
                />
                <span>Finances</span>
            </a>
            <a
                href="https://drive.google.com/file/d/1blyO-OZpgwAI3nDUl0s7XKxu_Y_L1PAg/view?usp=sharing"
                class="group inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 shadow-xl/3 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
            >
                <FingerprintPattern
                    class="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors"
                />
                <span>Protocol</span>
            </a>
            <a
                href="https://drive.google.com/file/d/1V00gOty-ESiI_FnGsj9jzQMOddm7ANC4/view?usp=sharing"
                class="group inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 shadow-xl/3 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
            >
                <Printer
                    class="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors"
                />
                <span>CRF</span>
            </a>
            <a
                href="https://drive.google.com/file/d/1PwGfpIoNFeAQREKiPKzN9MfN9fkcZFdv/view?usp=sharing"
                class="group inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 shadow-xl/3 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
            >
                <Printer
                    class="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors"
                />
                <span>Voucher</span>
            </a>
            <a
                href="https://drive.google.com/file/d/1RFKLXqfOwTYuNJ4eyk1tjRiRus9IBvMZ/view?usp=sharing"
                class="group inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 shadow-xl/3 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
            >
                <Printer
                    class="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors"
                />
                <span>MLWHFQ-HFSS</span>
            </a>
            <a
                href="https://drive.google.com/file/d/19u7COQLA8bNVpsbkaZEvia2rEEjP0uZ2/view?usp=sharing"
                class="group inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 shadow-xl/3 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
            >
                <Printer
                    class="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors"
                />
                <span>ICD-Hindi</span>
            </a>
            <a
                href="https://drive.google.com/file/d/19e0w_32knyl9vT357GSt8yl_mRHicJBm/view?usp=sharing"
                class="group inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 shadow-xl/3 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
            >
                <Printer
                    class="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors"
                />
                <span>ICD-Marathi</span>
            </a>
        </nav>

        <div class="space-y-5">
            <div class="flex items-center justify-between px-1">
                <h2 class="text-sm font-semibold text-slate-900">
                    {viewMode === 'list' ? 'Upcoming Visits' : 'Schedule Calendar'}
                </h2>

                <div class="bg-white p-1 rounded-lg border border-slate-200 flex items-center shadow-sm">
                    <button
                        onclick={() => (viewMode = 'list')}
                        class={`p-1.5 rounded-md transition-all ${
                            viewMode === 'list'
                                ? 'bg-slate-100 text-slate-900 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <List size={16} />
                    </button>
                    <button
                        onclick={() => (viewMode = 'calendar')}
                        class={`p-1.5 rounded-md transition-all ${
                            viewMode === 'calendar'
                                ? 'bg-slate-100 text-slate-900 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <CalendarIcon size={16} />
                    </button>
                </div>
            </div>

            {#if bestOpdSlot}
                <div class="px-1 mb-2">
                    <div
                        class="bg-emerald-50 border border-emerald-400 rounded-xl overflow-hidden transition-all duration-300"
                    >
                        <button
                            onclick={() => (showSuggestionDetails = !showSuggestionDetails)}
                            class="w-full flex items-center justify-between px-4 py-3 text-left focus:outline-none"
                        >
                            <div>
                                <div
                                    class="font-semibold text-emerald-900 text-sm flex items-center gap-2"
                                >
                                    <div
                                        class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                                    ></div>
                                    Optimal clustering:
                                    {bestOpdSlot.date.toLocaleDateString('en-IN', {
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: 'short'
                                    })}
                                </div>
                                <div class="text-xs text-emerald-700 mt-1 pl-4">
                                    {bestOpdSlot.visits.length} eligible patients can be scheduled.
                                </div>
                            </div>
                            <div
                                class={`text-emerald-700 transition-transform duration-200 ${
                                    showSuggestionDetails ? 'rotate-180' : ''
                                }`}
                            >
                                <ChevronDown size={18} />
                            </div>
                        </button>

                        {#if showSuggestionDetails}
                            <div
                                transition:slide
                                class="border-t border-emerald-100/50 bg-emerald-50/50"
                            >
                                <div class="px-4 py-2 space-y-1">
                                    {#each bestOpdSlot.visits as v}
                                        <a
                                            href={`/visits/visit${v.visit_number}/${v.id}`}
                                            class="block group/item"
                                        >
                                            <div
                                                class="flex items-center justify-between py-2 border-b border-emerald-100/60 last:border-0"
                                            >
                                                <div class="flex items-center gap-2">
                                                    <div
                                                        class="bg-emerald-200/50 p-1 rounded-full text-emerald-700"
                                                    >
                                                        <User size={12} />
                                                    </div>
                                                    <div>
                                                        <div
                                                            class="text-xs font-semibold text-emerald-900 group-hover/item:underline"
                                                        >
                                                            {formatName(v.participant)}
                                                        </div>
                                                        <div class="text-[10px] text-emerald-700">
                                                            Visit {v.visit_number} • Due:
                                                            {formatDatePretty(v.due_date)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div
                                                    class="text-[10px] font-medium text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-100"
                                                >
                                                    Review
                                                </div>
                                            </div>
                                        </a>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            {#if viewMode === 'calendar'}
                <div
                    in:fade={{ duration: 200 }}
                    class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                    <div
                        class="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50"
                    >
                        <button
                            onclick={prevMonth}
                            class="p-1 hover:bg-white hover:shadow-sm rounded-md transition text-slate-500"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span class="text-sm font-semibold text-slate-700">{monthLabel}</span>
                        <button
                            onclick={nextMonth}
                            class="p-1 hover:bg-white hover:shadow-sm rounded-md transition text-slate-500"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div class="p-4">
                        <div class="grid grid-cols-7 mb-2 text-center">
                            {#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as day}
                                <span
                                    class="text-[10px] font-bold text-slate-400 uppercase"
                                >
                                    {day}
                                </span>
                            {/each}
                        </div>
                        <div class="grid grid-cols-7 gap-1">
                            {#each calendarGrid as day}
                                {#if day === null}
                                    <div class="aspect-square"></div>
                                {:else}
                                    {@const dateKey = `${currentYear}-${String(
                                        currentMonth + 1
                                    ).padStart(2, '0')}-${String(day).padStart(2, '0')}`}
                                    {@const hasVisits = visitsByDate[dateKey]}
                                    {@const isSelected = selectedDate === dateKey}
                                    {@const isToday =
                                        new Date().toDateString() ===
                                        new Date(currentYear, currentMonth, day).toDateString()}

                                    <button
                                        onclick={() => selectDay(day)}
                                        class={`
                                            aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all duration-200
                                            ${
                                                isSelected
                                                    ? 'bg-slate-800 text-white shadow-lg scale-105 z-10'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                            }
                                            ${
                                                isToday && !isSelected
                                                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200'
                                                    : ''
                                            }
                                        `}
                                    >
                                        <span
                                            class={`leading-none ${
                                                isSelected
                                                    ? 'font-bold text-xl'
                                                    : 'font-bold text-lg'
                                            }`}
                                        >
                                            {day}
                                        </span>
                                        {#if hasVisits}
                                            <div class="flex gap-1 mt-1.5">
                                                {#each hasVisits.slice(0, 3) as v}
                                                    <div
                                                        class="w-1.5 h-1.5 rounded-full bg-emerald-500"
                                                    ></div>
                                                {/each}
                                            </div>
                                        {/if}
                                    </button>
                                {/if}
                            {/each}
                        </div>
                    </div>
                </div>

                {#if selectedDate}
                    <div transition:slide class="space-y-2">
                        <h3
                            class="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1"
                        >
                            Scheduled on
                            {new Date(selectedDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'long'
                            })}
                        </h3>
                    </div>
                {:else}
                    <div class="py-8 text-center">
                        <p
                            class="text-sm text-slate-400 flex items-center justify-center gap-2"
                        >
                            <Clock size={16} />
                            Select a date to view scheduled visits
                        </p>
                    </div>
                {/if}
            {/if}

            {#if viewMode === 'list' || (viewMode === 'calendar' && selectedDate)}
                {#if displayedVisits.length === 0 && viewMode === 'list'}
                    <div
                        in:fly={{ y: 5 }}
                        class="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200"
                    >
                        <p class="text-sm text-slate-400">No upcoming visits found.</p>
                    </div>
                {:else if displayedVisits.length > 0}
                    <div
                        class="space-y-4"
                        in:fly={{ y: 10, duration: 300 }}
                    >
                        {#each displayedVisits as visit (visit.id)}
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
                                            <span
                                                class="font-semibold tracking-tight group-hover:text-emerald-950 transition-colors"
                                            >
                                                {formatName(visit.participant)}
                                            </span>
                                            {#if visit.participant?.screening_id}
                                                <span
                                                    class="ml-2 text-slate-400 font-medium text-[15px]"
                                                >
                                                    {visit.participant.screening_id}
                                                </span>
                                            {/if}
                                        </h3>
                                        <div
                                            class="flex items-center gap-4 text-xs font-semibold"
                                        >
                                            {#if isOverdue(visit.due_date)}
                                                <div
                                                    class="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-100 px-2 py-1 rounded-md"
                                                >
                                                    <div
                                                        class="w-1.5 h-1.5 rounded-full bg-red-500"
                                                    ></div>
                                                    <span>
                                                        Due {formatDatePretty(visit.due_date)}
                                                    </span>
                                                </div>
                                            {:else}
                                                <div
                                                    class="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 rounded-md"
                                                >
                                                    <div
                                                        class="w-1.5 h-1.5 rounded-full bg-amber-500"
                                                    ></div>
                                                    <span>
                                                        Due {formatDatePretty(visit.due_date)}
                                                    </span>
                                                </div>
                                            {/if}
                                            {#if visit.scheduled_on}
                                                <div
                                                    class="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-md"
                                                >
                                                    <Phone size={12} />
                                                    <span>
                                                        {formatDatePretty(visit.scheduled_on)}
                                                    </span>
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                    <div
                                        class="flex flex-col items-center justify-center pl-6 border-l border-slate-50"
                                    >
                                        <span
                                            class="font-thin text-slate-400 leading-none uppercase text-[10px] tracking-wider"
                                        >
                                            visit
                                        </span>
                                        <span
                                            class="text-2xl font-semibold text-slate-700 leading-none mt-1"
                                        >
                                            {visit.visit_number}
                                        </span>
                                    </div>
                                </div>
                            </a>
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</div>
