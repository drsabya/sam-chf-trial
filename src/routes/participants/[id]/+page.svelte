<script lang="ts">
    import type { PageData, ActionData } from './$types';
    import { slide } from 'svelte/transition';
    import { 
        Phone, 
        ChevronRight, 
        ChevronDown, 
        ChevronUp,
        User, 
        MapPin, 
        Briefcase, 
        Save
    } from '@lucide/svelte';

    let { data, form }: { data: PageData; form: ActionData | null } = $props();

    // -- State for Toggle --
    let showDetails = $state(false);

    // -- Participant Data --
    const participant = (form?.participant as any) ?? data.participant;
    const values: any = (form as any)?.values ?? {};
    const message: string | null = (form as any)?.message ?? null;
    const success: boolean = (form as any)?.success ?? false;

    // -- Reactive Phone Logic (for the call button) --
    // We default to form value (if error), then saved participant value, then empty
    let phoneValue = $state(values.phone ?? participant.phone ?? '');

    const initials =
        participant.initials ??
        [participant.first_name, participant.middle_name, participant.last_name]
            .map((n: string | null | undefined) => n?.trim?.()[0]?.toUpperCase?.() ?? '')
            .filter(Boolean)
            .join('');

    const screeningId = participant.screening_id; // Just the ID, no formatting
    const randomizationId = participant.randomization_id; // Just the ID, no formatting

    function currentValue(field: string, fallback: any = '') {
        return values[field] ?? participant[field] ?? fallback;
    }
</script>

<div class="min-h-screen bg-white font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900 pb-32">
    
    <div class="max-w-xl mx-auto px-6 pt-8 flex justify-between items-center">
        <a href="/participants" class="text-[10px] font-bold tracking-[0.2em] text-slate-300 hover:text-emerald-600 transition-colors uppercase">
            &larr; Participants
        </a>
        <a href={`/participants/${participant.id}/visits`} class="group flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-emerald-600 hover:text-emerald-800 transition-colors uppercase">
            <span>Visits</span>
            <ChevronRight size={12} class="transition-transform group-hover:translate-x-0.5" />
        </a>
    </div>

    <div class="max-w-xl mx-auto px-6 mt-12">
        
        <div class="flex flex-col items-center justify-center mb-16 space-y-4">
            
           <div class="flex gap-8 text-center items-baseline">
                <div class="group relative">
                    <h1 class="text-5xl font-light tracking-tight text-slate-900 leading-none">
                        {initials || '-'}
                    </h1>
                    <span class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Initials</span>
                </div>

                <div class="group relative">
                    <h1 class="text-5xl font-light tracking-tight text-slate-900 leading-none">
                        {screeningId}
                    </h1>
                    <span class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Screening</span>
                </div>

                {#if randomizationId}
                    <div class="group relative">
                        <h1 class="text-5xl font-light tracking-tight text-emerald-600 leading-none">
                            {randomizationId}
                        </h1>
                        <span class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Randomization</span>
                    </div>
                {/if}
            </div>
        </div>

        <form method="POST" action="?/update" class="space-y-10">
            
            <section class="space-y-8">
                
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div class="group relative">
                        <input
                            id="first_name"
                            name="first_name"
                            type="text"
                            class="peer block w-full border-b border-slate-200 bg-transparent py-2.5 text-lg font-medium text-slate-900 placeholder-transparent focus:border-emerald-500 focus:outline-none transition-colors"
                            value={currentValue('first_name', '')}
                            placeholder="First Name"
                        />
                        <label for="first_name" class="absolute left-0 -top-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-300 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-[10px] peer-focus:text-emerald-600">
                            First Name
                        </label>
                    </div>

                    <div class="group relative">
                        <input
                            id="middle_name"
                            name="middle_name"
                            type="text"
                            class="peer block w-full border-b border-slate-200 bg-transparent py-2.5 text-lg font-medium text-slate-900 placeholder-transparent focus:border-emerald-500 focus:outline-none transition-colors"
                            value={currentValue('middle_name', '')}
                            placeholder="Middle"
                        />
                         <label for="middle_name" class="absolute left-0 -top-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-300 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-[10px] peer-focus:text-emerald-600">
                            Middle Name
                        </label>
                    </div>

                    <div class="group relative">
                        <input
                            id="last_name"
                            name="last_name"
                            type="text"
                            class="peer block w-full border-b border-slate-200 bg-transparent py-2.5 text-lg font-medium text-slate-900 placeholder-transparent focus:border-emerald-500 focus:outline-none transition-colors"
                            value={currentValue('last_name', '')}
                            placeholder="Last Name"
                        />
                         <label for="last_name" class="absolute left-0 -top-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-300 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-[10px] peer-focus:text-emerald-600">
                            Last Name
                        </label>
                    </div>
                </div>

                <div class="pt-4">
                     <label for="phone" class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Contact Number</label>
                    <div class="relative group">
                        <input
                            id="phone"
                            name="phone"
                            type="tel"
                            bind:value={phoneValue}
                            class="block w-full rounded-2xl bg-slate-50 border border-slate-100 py-5 pl-5 pr-20 text-3xl font-light tracking-wide text-slate-900 placeholder:text-slate-200 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all"
                            placeholder="Phone..."
                            required
                        />
                        
                        {#if phoneValue}
                            <a 
                                href={`tel:${phoneValue}`}
                                class="absolute right-3 top-1/2 -translate-y-1/2 h-12 w-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all duration-300 z-10"
                                aria-label="Call this number"
                            >
                                <Phone size={20} class="fill-current" />
                            </a>
                        {/if}
                    </div>
                </div>
            </section>


            <div class="flex justify-center pt-6">
                <button 
                    type="button" 
                    onclick={() => showDetails = !showDetails}
                    class="group flex items-center gap-3 px-6 py-3 rounded-full text-xs font-semibold text-slate-400 bg-white border border-slate-100 hover:border-emerald-200 hover:text-emerald-700 hover:shadow-md transition-all duration-300"
                >
                    {#if showDetails}
                        <span>Hide Extended Profile</span>
                        <ChevronUp size={14} />
                    {:else}
                        <span>Show Extended Profile</span>
                        <ChevronDown size={14} />
                    {/if}
                </button>
            </div>


            {#if showDetails}
                <section transition:slide={{ duration: 300, axis: 'y' }} class="space-y-10 pt-6">
                    
                    <div class="space-y-4">
                        <div class="flex items-center gap-2 text-slate-300 border-b border-slate-50 pb-2">
                            <User size={14} />
                            <h3 class="text-[10px] uppercase tracking-widest font-bold">Demographics</h3>
                        </div>
                        <div class="grid grid-cols-2 gap-6">
                            <div>
                                <label for="age" class="block text-xs font-medium text-slate-500 mb-2">Age</label>
                                <input id="age" name="age" type="number" class="w-full bg-slate-50 rounded-lg px-3 py-2 text-sm border-transparent focus:bg-white focus:border-emerald-500 focus:ring-0 transition-colors" value={currentValue('age')} />
                            </div>
                            <div>
                                <label for="sex" class="block text-xs font-medium text-slate-500 mb-2">Sex</label>
                                <select id="sex" name="sex" class="w-full bg-slate-50 rounded-lg px-3 py-2 text-sm border-transparent focus:bg-white focus:border-emerald-500 focus:ring-0 transition-colors">
                                    <option value="">Select</option>
                                    <option value="Male" selected={currentValue('sex') === 'Male'}>Male</option>
                                    <option value="Female" selected={currentValue('sex') === 'Female'}>Female</option>
                                    <option value="Other" selected={currentValue('sex') === 'Other'}>Other</option>
                                </select>
                            </div>
                        </div>
                         <div>
                            <label for="alternate_phone" class="block text-xs font-medium text-slate-500 mb-2">Alternate Phone</label>
                            <input id="alternate_phone" name="alternate_phone" type="tel" class="w-full bg-slate-50 rounded-lg px-3 py-2 text-sm border-transparent focus:bg-white focus:border-emerald-500 focus:ring-0 transition-colors" value={currentValue('alternate_phone')} />
                        </div>
                    </div>

                    <div class="space-y-4">
                        <div class="flex items-center gap-2 text-slate-300 border-b border-slate-50 pb-2">
                            <MapPin size={14} />
                            <h3 class="text-[10px] uppercase tracking-widest font-bold">Location</h3>
                        </div>
                        <textarea 
                            id="address" 
                            name="address" 
                            rows="2" 
                            class="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm border-transparent focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all resize-none"
                            placeholder="Full Address..."
                        >{currentValue('address')}</textarea>
                    </div>

                    <div class="space-y-4">
                        <div class="flex items-center gap-2 text-slate-300 border-b border-slate-50 pb-2">
                            <Briefcase size={14} />
                            <h3 class="text-[10px] uppercase tracking-widest font-bold">Socio-Economic</h3>
                        </div>
                        <div class="grid grid-cols-1 gap-4">
                            <div class="grid grid-cols-2 gap-4">
                                <input type="text" name="education" placeholder="Education" value={currentValue('education')} class="bg-slate-50 rounded-lg px-3 py-2 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-colors" />
                                <input type="text" name="occupation" placeholder="Occupation" value={currentValue('occupation')} class="bg-slate-50 rounded-lg px-3 py-2 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-colors" />
                            </div>
                            <input type="number" name="income" placeholder="Monthly Income (₹)" value={currentValue('income')} class="bg-slate-50 rounded-lg px-3 py-2 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-colors" />
                        </div>
                    </div>

                </section>
            {/if}

            <div class="fixed bottom-8 left-0 right-0 flex justify-center z-50 pointer-events-none">
                <button
                    type="submit"
                    class="pointer-events-auto shadow-[0_20px_40px_-10px_rgba(16,185,129,0.4)] flex items-center gap-3 bg-emerald-600 text-white px-10 py-4 rounded-full font-semibold tracking-wide hover:bg-emerald-700 hover:-translate-y-1 active:translate-y-0 transition-all duration-300"
                >
                    <Save size={18} />
                    <span>Save Changes</span>
                </button>
            </div>

            {#if message}
                <div class={`text-center text-xs font-medium py-4 ${success ? 'text-emerald-600' : 'text-red-500'}`}>
                    {message}
                </div>
            {/if}

        </form>
    </div>
</div>