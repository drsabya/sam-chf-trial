<!-- src/lib/components/visits/VisitHeader.svelte -->
<script lang="ts">
	import {
		Phone,
		AlertCircle,
		CheckCircle2,
		CircleAlert,
		CheckCircle,
		CircleCheck,
		ExternalLink
	} from '@lucide/svelte';

	interface Props {
		participant: any;
		visit: any;
	}

	let { participant, visit }: Props = $props();

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

	const fullName = $derived(
		[participant.first_name, participant.middle_name, participant.last_name]
			.map((x: string) => x?.trim())
			.filter(Boolean)
			.join(' ')
	);

	const initials = $derived(participant.initials?.trim() ?? 'P');
</script>

<div class="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/60 border border-slate-100 mb-8">
	<div class="flex flex-col">
		<div
			class="flex items-center gap-2 sm:gap-3 text-sm font-medium text-slate-500 uppercase tracking-widest mt-1 mb-2"
		>
			<span class="text-slate-900 font-bold">{initials}</span>
			<span class="text-slate-300">•</span>

			{#if participant.screening_id}
				<span>{participant.screening_id}</span>
				<span class="text-slate-300">•</span>
			{/if}

			{#if participant.randomization_id}
				<span>{participant.randomization_id}</span>
				<span class="text-slate-300">•</span>
			{/if}

			<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold"
				>V{visit.visit_number ?? 1}</span
			>
		</div>

		<h1 class="text-3xl font-bold text-slate-900 tracking-tight mt-1">
			<a href={`/participants/${participant.id}`} class="inline-flex items-center gap-2 group">
				<span>{fullName}</span>
				<ExternalLink class="text-slate-400" />
			</a>
		</h1>

		{#if participant.phone}
			<div class="mt-2 flex items-center gap-2">
				<a
					href="tel:{participant.phone}"
					class="flex items-center gap-2 text-emerald-700 font-semibold hover:underline decoration-emerald-300/50 underline-offset-4 transition-all"
				>
					<Phone class="w-4 h-4" />
					{participant.phone}
				</a>
			</div>
		{/if}

		{#if visit.visit_date}
			<!-- VISIT COMPLETED block -->
			<div class="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2">
				<div class="bg-emerald-50 text-emerald-600 p-1.5 rounded-md">
					<CircleCheck class="w-4 h-4" />
				</div>
				<div class="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-2">
					<span class="text-xs font-bold text-slate-500 uppercase tracking-wide">Completed</span>
					<span class="text-sm font-bold text-emerald-700">
						{formatDatePretty(visit.visit_date)}
					</span>
				</div>
			</div>
		{:else}
			<!-- Default DUE DATE block -->
			<div class="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2">
				<div class="bg-rose-50 text-rose-600 p-1.5 rounded-md">
					<CircleAlert class="w-4 h-4" />
				</div>
				<div class="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-2">
					<span class="text-xs font-bold text-slate-500 uppercase tracking-wide">Due Date</span>
					<span class="text-sm font-bold text-rose-600">{formatDatePretty(visit.due_date)}</span>
				</div>
			</div>
		{/if}
	</div>
</div>
