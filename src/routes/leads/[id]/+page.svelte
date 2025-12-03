<!-- src/routes/leads/[id]/+page.svelte -->
<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { Phone, Calendar, UserX, CheckCircle2 } from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	let { data, form }: { data: PageData; form: ActionData | null } = $props();

	// Prefer updated lead from the action response if present
	const lead = (form?.lead as any) ?? data.lead;

	// Helper: Formats date for display
	function formatDateTime(value: string | null | undefined) {
		if (!value) return 'Not scheduled';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return 'Not scheduled';
		return d.toLocaleDateString('en-IN', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	// Helper: Formats date for input[type="date"]
	function toDateInputValue(value: string | null | undefined) {
		if (!value) return '';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return '';
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
			d.getMonth() + 1
		).padStart(2, '0')}`;
	}

	const phoneValue = (form?.values?.phone as string | undefined) ?? lead.phone ?? '';

	/* =============================
       State Logic
    ================================*/

	// "Patient contacted" checkbox
	let wasCalledChecked = $state(
		form?.values?.was_called !== undefined
			? Boolean(form.values.was_called)
			: Boolean(lead.was_called)
	);

	// Patient status: 'unknown' | 'willing' | 'unwilling'
	type PatientStatus = 'unknown' | 'willing' | 'unwilling';

	const initialStatusFromLead: PatientStatus =
		lead.patient_willing === true
			? 'willing'
			: lead.patient_willing === false
			? 'unwilling'
			: 'unknown';

	let patientStatus = $state<PatientStatus>(
		(form?.values?.patient_status as PatientStatus | undefined) ?? initialStatusFromLead
	);

	// Track whether user explicitly hit "Clear selection"
	let clearStatus = $state(false);

	// Date value for scheduling
	let scheduledOnValue = $state(
		(form?.values?.scheduled_on as string | undefined) ?? toDateInputValue(lead.scheduled_on)
	);

	// Derived helper
	let isPatientWilling = $derived(patientStatus === 'willing');

	// If user selects willing/unwilling again, clearStatus should reset
	$effect(()=>{
		if (patientStatus === 'willing' || patientStatus === 'unwilling') {
			clearStatus = false;
		}
	})
</script>

<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
	<div class="max-w-lg mx-auto">
		<div class="mb-6">
			<a
				href="/leads"
				class="inline-flex items-center text-sm font-medium text-gray-400 hover:text-emerald-700 transition-colors"
			>
				← Back to Leads
			</a>
		</div>

		<div
			class="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-gray-100"
		>
			<div class="px-8 pt-10 pb-6 border-b border-gray-50 bg-slate-50/30">
				<div class="flex justify-between items-start">
					<div>
						<h1 class="text-2xl font-light text-emerald-900">{lead.name}</h1>
						{#if lead.phone}
							<a
								href={`tel:${lead.phone}`}
								class="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-emerald-600 mt-1 transition-colors"
							>
								<span>{lead.phone}</span>
								<span
									class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100"
								>
									<Phone class="w-3.5 h-3.5" />
								</span>
							</a>
						{/if}
					</div>

					<div class="text-right">
						{#if lead.patient_willing === false}
							<span
								class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100"
							>
								Unwilling
							</span>
						{:else if lead.scheduled_on}
							<span
								class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
							>
								Scheduled
							</span>
						{:else if lead.was_called}
							<span
								class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100"
							>
								Contacted
							</span>
						{:else}
							<span
								class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100"
							>
								New Lead
							</span>
						{/if}
					</div>
				</div>
			</div>

			<div class="p-8">
				<form method="POST" action="?/update" class="space-y-8">
					<!-- Hidden clear-status field -->
					<input type="hidden" name="clear_status" value={clearStatus ? '1' : ''} />

					<!-- Contact details -->
					<div class="space-y-3">
						<label for="phone" class="text-sm font-bold tracking-wide text-gray-400 uppercase">
							Contact Details
						</label>
						<div class="relative">
							<div
								class="absolute left-4 top-3.5 text-gray-400 text-sm pointer-events-none select-none"
							>
								<Phone class="w-4 h-4" />
							</div>
							<input
								id="phone"
								name="phone"
								type="tel"
								required
								inputmode="numeric"
								pattern="[0-9]*"
								class="w-full bg-gray-50 border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50/50 transition-all duration-200"
								placeholder="Phone Number"
								value={phoneValue}
							/>
						</div>
					</div>

					<!-- Call outcome -->
					<div class="space-y-4">
						<h3 class="text-sm font-bold tracking-wide text-gray-400 uppercase">Call Outcome</h3>

						<!-- Patient contacted -->
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<label
								class="relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border cursor-pointer transition-all duration-200 select-none text-center h-24
                                {wasCalledChecked
									? 'bg-emerald-50/50 border-emerald-200 shadow-sm'
									: 'bg-white border-gray-100 hover:border-emerald-200 hover:bg-gray-50'}"
							>
								<input
									type="checkbox"
									name="was_called"
									bind:checked={wasCalledChecked}
									class="absolute opacity-0 w-0 h-0"
								/>
								<div
									class="p-2 rounded-full {wasCalledChecked
										? 'bg-emerald-100 text-emerald-700'
										: 'bg-gray-100 text-gray-400'}"
								>
									<CheckCircle2 class="w-5 h-5" />
								</div>
								<span
									class="text-xs font-bold {wasCalledChecked
										? 'text-emerald-900'
										: 'text-gray-500'}"
								>
									Patient Contacted
								</span>
							</label>
						</div>

						<!-- Patient willing / unwilling (explicit options) -->
						<div class="space-y-2">
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<!-- Patient willing -->
								<label
									class="relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border cursor-pointer transition-all duration-200 select-none text-center h-20
                                    {patientStatus === 'willing'
										? 'bg-emerald-50/50 border-emerald-200 shadow-sm'
										: 'bg-white border-gray-100 hover:border-emerald-200 hover:bg-gray-50'}"
								>
									<input
										type="radio"
										name="patient_status"
										value="willing"
										bind:group={patientStatus}
										class="absolute opacity-0 w-0 h-0"
									/>
									<div
										class="p-1.5 rounded-full {patientStatus === 'willing'
											? 'bg-emerald-100 text-emerald-700'
											: 'bg-gray-100 text-gray-400'}"
									>
										<CheckCircle2 class="w-4 h-4" />
									</div>
									<span
										class="text-[11px] font-bold {patientStatus === 'willing'
											? 'text-emerald-900'
											: 'text-gray-500'}"
									>
										Patient Willing
									</span>
								</label>

								<!-- Patient unwilling -->
								<label
									class="relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border cursor-pointer transition-all duration-200 select-none text-center h-20
                                    {patientStatus === 'unwilling'
										? 'bg-red-50 border-red-200 shadow-sm'
										: 'bg-white border-gray-100 hover:border-red-200 hover:bg-gray-50'}"
								>
									<input
										type="radio"
										name="patient_status"
										value="unwilling"
										bind:group={patientStatus}
										class="absolute opacity-0 w-0 h-0"
									/>
									<div
										class="p-1.5 rounded-full {patientStatus === 'unwilling'
											? 'bg-red-100 text-red-700'
											: 'bg-gray-100 text-gray-400'}"
									>
										<UserX class="w-4 h-4" />
									</div>
									<span
										class="text-[11px] font-bold {patientStatus === 'unwilling'
											? 'text-red-900'
											: 'text-gray-500'}"
									>
										Patient Unwilling
									</span>
								</label>
							</div>

							<div class="flex justify-end">
								<button
									type="button"
									on:click={() => {
										patientStatus = 'unknown';
										clearStatus = true;
									}}
									class="inline-flex items-center px-3 py-1.5 text-[11px] rounded-full border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50/60 transition-colors"
								>
									Clear selection
								</button>
							</div>
						</div>
					</div>

					<!-- Scheduling -->
					<div class="space-y-3">
						<label
							for="scheduled_on"
							class="text-sm font-bold tracking-wide text-gray-400 uppercase"
						>
							Scheduling
						</label>
						<div class="relative">
							<div class="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
								<Calendar class="w-4 h-4" />
							</div>
							<input
								id="scheduled_on"
								name="scheduled_on"
								type="date"
								bind:value={scheduledOnValue}
								disabled={!isPatientWilling}
								class="w-full bg-gray-50 border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50/50 transition-all duration-200 {isPatientWilling
									? ''
									: 'opacity-60 cursor-not-allowed'}"
							/>
						</div>
						<p class="text-xs text-right text-gray-400 pr-1">
							Current: {formatDateTime(lead.scheduled_on)}
						</p>
						<p class="text-[11px] text-right text-gray-400 pr-1">
							Note: Scheduling is only saved if patient is marked as willing.
						</p>
					</div>

					{#if form?.message}
						<div
							transition:fade
							class="text-sm px-4 py-3 rounded-xl border bg-red-50 border-red-100 text-red-800"
						>
							{form.message}
						</div>
					{/if}

					<button
						type="submit"
						class="w-full py-4 rounded-xl text-sm font-bold tracking-wide shadow-lg shadow-emerald-900/20 bg-emerald-700 text-white hover:bg-emerald-800 hover:shadow-emerald-900/30 hover:-translate-y-0.5 transition-all duration-300 ease-out"
					>
						SAVE CHANGES
					</button>
				</form>
			</div>
		</div>
	</div>
</div>
