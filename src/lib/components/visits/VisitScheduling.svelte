<!-- src/lib/components/visits/VisitScheduling.svelte -->
<script lang="ts">
	import { Calendar, ChevronDown } from '@lucide/svelte';

	interface Visit {
		id: string;
		created_at: string | null;
		due_date: string | null;
		scheduled_on: string | null;
		visit_number: number;
		// other fields can exist, we just don't care here
	}

	interface Props {
		visit: Visit;
		sectionTitle?: string;
	}

	let { visit = $bindable(), sectionTitle = 'OPD Scheduling' }: Props = $props();

	/* ---------------------------------------------
       DATE HELPERS (local to component)
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

	// Compute start/end window based on visit_number + due_date
	function getWindowBounds(v: Visit): { start: Date; end: Date } {
		const createdAt = v.created_at ? toUtcStartOfDay(v.created_at) : toUtcStartOfDay(new Date());

		// If due_date is missing, fall back to 14 days from created_at
		if (!v.due_date) {
			const endFallback = addUtcDays(createdAt, 14);
			return { start: createdAt, end: endFallback };
		}

		const end = toUtcStartOfDay(v.due_date);
		let start = createdAt;

		// Your rules:
		// 1–2: all Tue/Wed/Fri till the due date (from created_at)
		// 3–5: last 7 days before due_date
		// 6–8: last 14 days before due_date
		if (v.visit_number >= 3 && v.visit_number <= 5) {
			const candidate = addUtcDays(end, -7);
			start = candidate > createdAt ? candidate : createdAt;
		} else if (v.visit_number >= 6 && v.visit_number <= 8) {
			const candidate = addUtcDays(end, -14);
			start = candidate > createdAt ? candidate : createdAt;
		} else {
			// visit 1–2 (or anything else) → from created_at
			start = createdAt;
		}

		return { start, end };
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

	/* ---------------------------------------------
       STATE
    --------------------------------------------- */
	let scheduledOn = $state<string>(visit.scheduled_on ?? '');

	let opdOptions = $derived.by(() => {
		const { start, end } = getWindowBounds(visit);
		return generateOpdOptions(start, end);
	});

	let saving = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	/* ---------------------------------------------
       SAVE HANDLER → calls /apis/visits/scheduling
    --------------------------------------------- */
	async function saveScheduledOn() {
		errorMessage = null;
		successMessage = null;

		if (!scheduledOn) {
			errorMessage = 'Please select an OPD date.';
			return;
		}

		saving = true;
		try {
			const res = await fetch('/apis/visits/scheduling', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					visitId: visit.id,
					scheduled_on: scheduledOn
				})
			});

			const out = await res.json();

			if (!res.ok || !out.ok) {
				errorMessage = out?.message || 'Failed saving appointment.';
				return;
			}

			// keep local visit in sync
			visit = { ...visit, scheduled_on: scheduledOn };
			successMessage = 'OPD date saved.';
		} catch (err) {
			console.error(err);
			errorMessage = 'Network error while saving appointment.';
		} finally {
			saving = false;
		}
	}
</script>

<section>
	<div class="flex items-center gap-2 mb-3 px-2">
		<Calendar class="w-4 h-4 text-amber-600" />
		<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
			{sectionTitle}
		</h3>
	</div>

	<div
		class="bg-amber-50/60 rounded-2xl border border-amber-200 p-3 sm:p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm"
	>
		<div class="relative flex-1 group">
			<select
				bind:value={scheduledOn}
				class="w-full appearance-none bg-white border border-amber-100 focus:border-amber-400 focus:ring-amber-200 rounded-xl py-3 pl-4 pr-10 text-sm font-medium text-slate-800 transition-all cursor-pointer hover:border-amber-300"
			>
				<option value="" disabled>Select OPD Date</option>
				{#each opdOptions as opt}
					<option value={opt}>{formatDatePretty(opt)}</option>
				{/each}
			</select>
			<ChevronDown
				class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none group-hover:text-amber-600 transition-colors"
			/>
		</div>

		<button
			type="button"
			onclick={saveScheduledOn}
			disabled={!scheduledOn || saving}
			class="bg-amber-600 text-white px-6 py-3 rounded-xl text-sm font-bold tracking-wide hover:bg-amber-700 active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-amber-600 transition-all shadow-lg shadow-amber-200"
		>
			{saving ? 'Saving…' : 'Save Date'}
		</button>
	</div>

	{#if errorMessage}
		<p class="mt-2 text-xs text-rose-600 px-2">{errorMessage}</p>
	{:else if successMessage}
		<p class="mt-2 text-xs text-emerald-600 px-2">{successMessage}</p>
	{/if}
</section>
