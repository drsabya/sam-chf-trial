<script lang="ts">
	import type { PageData } from './$types';
	import type { VisitRow } from './+page.server';

	let { data }: { data: PageData } = $props();

	// Data from server
	let participants = $state(data.participants ?? []);
	let visits = $state<VisitRow[]>(data.visits ?? []);

	// Filter state: Default to showing only randomized participants
	let showRandomizedOnly = $state(true);

	function formatName(participant: any | null) {
		if (!participant) return 'Unknown participant';
		const parts = [participant.first_name, participant.middle_name, participant.last_name]
			.map((x: string | null) => x?.trim())
			.filter(Boolean);
		return parts.join(' ') || 'Unknown participant';
	}

	// Helper: numeric sort key based on screening_id (e.g. "S10" -> 10)
	function getScreeningSortKey(p: any): number {
		const raw = (p?.screening_id ?? '').toString();
		const match = raw.match(/\d+/); // first number in the string
		if (!match) return Number.POSITIVE_INFINITY;
		const num = Number.parseInt(match[0], 10);
		return Number.isNaN(num) ? Number.POSITIVE_INFINITY : num;
	}

	// Derived filtered + NATURALLY sorted list of participants
	let filteredParticipants = $derived.by(() => {
		const base = showRandomizedOnly
			? participants.filter((p) => p.randomization_id !== null && p.randomization_id !== '')
			: participants;

		// Sort like S1, S2, ... S9, S10, ... based on numeric part
		return base
			.slice()
			.sort((a, b) => {
				const aKey = getScreeningSortKey(a);
				const bKey = getScreeningSortKey(b);

				if (aKey === bKey) {
					// fall back to lexicographic when numeric part is same / missing
					const aId = (a.screening_id ?? '') as string;
					const bId = (b.screening_id ?? '') as string;
					return aId.localeCompare(bId);
				}

				return aKey - bKey;
			});
	});

	// Map visits for quick lookup: participant_id -> visit_number -> VisitRow
	type VisitsByParticipant = Record<string, Record<number, VisitRow>>;

	const visitsByParticipant = $derived(() => {
		const map: VisitsByParticipant = {};
		for (const v of visits) {
			if (!map[v.participant_id]) {
				map[v.participant_id] = {};
			}
			map[v.participant_id][v.visit_number] = v;
		}
		return map;
	});

	// Variable options for dropdown
	const variableOptions = [
		{ key: 'height_cm', label: 'Height (cm)' },
		{ key: 'weight_kg', label: 'Weight (kg)' },
		{ key: 'bmi', label: 'BMI' },
		{ key: 'temperature_c', label: 'Temperature (°C)' },
		{ key: 'pulse_rate', label: 'Pulse rate (/min)' },
		{ key: 'bp_systolic', label: 'BP Systolic (mmHg)' },
		{ key: 'bp_diastolic', label: 'BP Diastolic (mmHg)' },
		{ key: 'respiratory_rate', label: 'Respiratory rate (/min)' },
		{ key: 'hb', label: 'Hemoglobin' },
		{ key: 'rbcs', label: 'RBCs' },
		{ key: 'wbcs', label: 'WBCs' },
		{ key: 'polymorphs', label: 'Polymorphs (%)' },
		{ key: 'lymphocytes', label: 'Lymphocytes (%)' },
		{ key: 'monocytes', label: 'Monocytes (%)' },
		{ key: 'platelets', label: 'Platelets' },
		{ key: 'sgot_ast', label: 'SGOT/AST' },
		{ key: 'sgpt_alt', label: 'SGPT/ALT' },
		{ key: 'bilirubin_total', label: 'Bilirubin total' },
		{ key: 'bilirubin_direct', label: 'Bilirubin direct' },
		{ key: 'bilirubin_indirect', label: 'Bilirubin indirect' },
		{ key: 'bun', label: 'BUN' },
		{ key: 'serum_creatinine', label: 'Serum creatinine' },
		{ key: 'total_cholesterol', label: 'Total cholesterol' },
		{ key: 'hdl', label: 'HDL' },
		{ key: 'ldl', label: 'LDL' },
		{ key: 'triglycerides', label: 'Triglycerides' },
		{ key: 'nt_pro_bnp', label: 'NT-proBNP' },
		{ key: 'serum_tsh', label: 'Serum TSH' },
		{ key: 'serum_homocysteine', label: 'Serum homocysteine' },
		{ key: 'gsh', label: 'GSH' },
		{ key: 'tnf_alpha', label: 'TNF-α' },
		{ key: 'il6', label: 'IL-6' },
		{ key: 'same', label: 'SAMe' },
		{ key: 'sah', label: 'SAH' },
		{ key: 'five_methylcytosine', label: '5-methylcytosine' },
		{ key: 'echo_lvef', label: 'LVEF (%)' },
		{ key: 'hfss_score', label: 'HFSS score' },
		{ key: 'mlfhq_score', label: 'MLHFQ score' },
		{ key: 'hospitalizations_cardiac', label: 'Cardiac hospitalizations' },
		{ key: 'hospitalizations_noncardiac', label: 'Non-cardiac hospitalizations' },
		{ key: 'worsening_hf_events', label: 'Worsening HF events' },
		// Text-ish variables – keep them at the end
		{ key: 'history', label: 'History (text)' },
		{ key: 'cvs', label: 'CVS (text)' },
		{ key: 'cns', label: 'CNS (text)' },
		{ key: 'rs', label: 'RS (text)' },
		{ key: 'pa', label: 'PA (text)' },
		{ key: 'concomitant_medications', label: 'Concomitant medications (text)' },
		{ key: 'concomitant_illness', label: 'Concomitant illness (text)' },
		{ key: 'compliance_self_report_percent', label: 'Compliance self-report (%)' },
		{ key: 'compliance_self_report_notes', label: 'Compliance notes (text)' },
		{ key: 'ecg', label: 'ECG (text)' }
	] as const;

	type VariableKey = (typeof variableOptions)[number]['key'];

	let selectedVariable = $state<VariableKey>('echo_lvef');

	function formatValue(value: unknown) {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'number') {
			if (!Number.isFinite(value)) return '—';
			return value.toString();
		}
		const str = String(value).trim();
		if (!str) return '—';
		// Truncate very long text values for table display
		return str.length > 40 ? str.slice(0, 37) + '…' : str;
	}

	function getVisitValue(participantId: string, visitNumber: number) {
		const visitsForParticipant = visitsByParticipant();
		if (!visitsForParticipant) return '—';

		const v = visitsForParticipant[participantId]?.[visitNumber];
		if (!v) return '—';

		// Dynamic key lookup
		const raw = v[selectedVariable as keyof VisitRow];
		return formatValue(raw);
	}

	const visitNumbers = [1, 2, 3, 4, 5, 6, 7, 8];
</script>

<div class="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
	<div class="mx-auto max-w-full">
		<div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
			<div>
				<h1 class="text-xl font-semibold text-slate-900">Master Chart</h1>
				<p class="text-xs text-slate-500 mt-1">
					One row per participant. Scroll horizontally to see more visits.
				</p>
			</div>

			<div class="flex flex-col sm:flex-row gap-4 sm:items-center">
				<!-- Filter Toggle -->
				<div class="flex items-center bg-white rounded-lg border border-slate-200 p-1">
					<button
						onclick={() => (showRandomizedOnly = true)}
						class={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
							showRandomizedOnly
								? 'bg-emerald-50 text-emerald-700 shadow-sm'
								: 'text-slate-500 hover:bg-slate-50'
						}`}
					>
						Randomized
					</button>
					<button
						onclick={() => (showRandomizedOnly = false)}
						class={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
							!showRandomizedOnly
								? 'bg-emerald-50 text-emerald-700 shadow-sm'
								: 'text-slate-500 hover:bg-slate-50'
						}`}
					>
						All Screened
					</button>
				</div>

				<!-- Variable Selector -->
				<div class="relative w-full sm:w-auto">
					<select
						bind:value={selectedVariable}
						class="block w-full sm:w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
					>
						{#each variableOptions as opt}
							<option value={opt.key}>{opt.label}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5">
			{#if filteredParticipants.length === 0}
				<div class="text-center py-8">
					<p class="text-sm text-slate-500">No participants found matching the current filter.</p>
				</div>
			{:else}
				<div class="mb-3 text-xs text-slate-500">
					Showing <span class="font-semibold text-slate-900">{filteredParticipants.length}</span>
					participants. Displaying:
					<span class="font-semibold text-emerald-600">
						{variableOptions.find((v) => v.key === selectedVariable)?.label}
					</span>
				</div>

				<div class="overflow-x-auto border rounded-lg border-slate-200">
					<table class="table-auto min-w-full text-xs sm:text-sm border-collapse whitespace-nowrap">
						<thead class="bg-slate-50/90 text-slate-700">
							<tr class="border-b border-slate-200">
								<!-- Sticky Name -->
								<th
									class="text-left px-4 py-3 font-semibold sm:sticky sm:left-0 bg-slate-50 z-20 border-r border-slate-200/60 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
								>
									Name
								</th>
								<!-- Sticky Screening ID -->
								<th
									class="text-left px-4 py-3 font-semibold sm:sticky sm:left-[10rem] bg-slate-50 z-20 border-r border-slate-200/60"
								>
									Screening ID
								</th>
								<!-- New Columns -->
								<th class="text-left px-4 py-3 font-semibold bg-slate-50">Rand. ID</th>
								<th
									class="text-left px-4 py-3 font-semibold bg-slate-50 border-r border-slate-200/60"
								>
									Rand. Code
								</th>

								{#each visitNumbers as vno}
									<th class="text-center px-3 py-3 font-semibold min-w-[80px]">
										Visit {vno}
									</th>
								{/each}
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each filteredParticipants as participant}
								<tr class="hover:bg-slate-50/80 transition-colors">
									<!-- Sticky Name Cell -->
									<td
										class="px-4 py-2.5 text-slate-900 font-medium sm:sticky sm:left-0 bg-white z-10 border-r border-slate-200/60 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
									>
										{formatName(participant)}
									</td>
									<!-- Sticky Screening ID Cell -->
									<td
										class="px-4 py-2.5 font-mono text-slate-600 sm:sticky sm:left-[10rem] bg-white z-10 border-r border-slate-200/60"
									>
										{participant.screening_id || '—'}
									</td>
									<!-- New Data Cells -->
									<td class="px-4 py-2.5 font-mono text-slate-600">
										{participant.randomization_id || '—'}
									</td>
									<td class="px-4 py-2.5 font-mono text-slate-600 border-r border-slate-200/60">
										{participant.randomization_code || '—'}
									</td>

									{#each visitNumbers as vno}
										<td class="px-3 py-2.5 text-center text-slate-700">
											{getVisitValue(participant.id, vno)}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="mt-4 flex items-center justify-between">
					<p class="text-[11px] text-slate-400">— indicates no value.</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Custom utility to fix sticky left offset for the second column if Tailwind arbitrarily fails,
	   though sm:left-[10rem] usually works. Adjust 10rem to match the approximate width of the Name column. */
	@media (min-width: 640px) {
		th.sm\:sticky.sm\:left-\[10rem\],
		td.sm\:sticky.sm\:left-\[10rem\] {
			left: 11rem; /* Adjust based on Name column width */
		}
	}
</style>
