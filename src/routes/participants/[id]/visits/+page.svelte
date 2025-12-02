<script lang="ts">
	import type { PageData } from './$types';
	import {
		ArrowLeft,
		ArrowUpRight,
		Clock,
		CircleCheck,
		Calendar,
		ArrowRight,
		AlertTriangle
	} from '@lucide/svelte';

	let { data }: { data: PageData } = $props();
	const { participant, visits } = data;

	const initials =
		participant.initials ??
		[participant.first_name, participant.middle_name, participant.last_name]
			.map((n: string | null | undefined) => n?.trim?.()[0]?.toUpperCase?.() ?? '')
			.filter(Boolean)
			.join('');

	const screeningId = participant.screening_id;
	const randomizationId = participant.randomization_id;
	const isScreeningFailure = participant.screening_failure === true;

	function formatDate(value: string | null | undefined) {
		if (!value) return 'Pending';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return 'Invalid';
		return d.toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<div
	class="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900 pb-32"
>
	<div class="max-w-xl mx-auto px-6 pt-8 flex justify-end items-center"></div>

	<div class="max-w-xl mx-auto px-6 mt-12">
		{#if isScreeningFailure}
			<div
				class="mb-8 rounded-2xl border border-red-200 bg-rose-50 px-4 py-3 text-sm text-rose-500 flex gap-3 items-start"
			>
				<div class="mt-0.5">
					<AlertTriangle size={18} strokeWidth={2.4} />
				</div>
				<div>
					<p class="text-[10px] font-bold tracking-[0.22em] uppercase">
						Screening Failure
					</p>
					<p class="mt-1 text-xs leading-snug">
						This participant is marked as <span class="font-semibold">screening failure</span>.
						Please ensure no further study visits are scheduled or performed as per protocol.
					</p>
				</div>
			</div>
		{/if}

		<div class="flex flex-col items-center justify-center mb-16 space-y-4">
			<div class="flex gap-8 text-center items-baseline">
				<div class="group relative">
					<h1 class="text-5xl font-light tracking-tight text-slate-900 leading-none">
						{initials || '-'}
					</h1>
					<span
						class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
						>Initials</span
					>
				</div>

				<div class="group relative">
					<h1 class="text-5xl font-light tracking-tight text-slate-900 leading-none">
						{screeningId}
					</h1>
					<span
						class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
						>Screening</span
					>
				</div>

				{#if randomizationId}
					<div class="group relative">
						<h1 class="text-5xl font-light tracking-tight text-emerald-600 leading-none">
							{randomizationId}
						</h1>
						<span
							class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
							>Randomization</span
						>
					</div>
				{/if}
			</div>

			<a
				href={`/participants/${participant.id}`}
				class="group flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400 hover:text-emerald-600 transition-colors uppercase"
			>
				<span>Go to Profile</span>
				<ArrowRight size={14} class="transition-transform group-hover:-translate-x-1" />
			</a>
		</div>

		<main class="space-y-4">
			{#if visits.length === 0}
				<div
					class="bg-white py-12 text-center border border-dashed border-slate-300 rounded-2xl"
				>
					<p class="text-slate-400 text-sm font-medium">No visits scheduled.</p>
				</div>
			{:else}
				{#each visits as visit}
					{@const isCompleted = !!visit.visit_date}
					{@const dateStr = formatDate(isCompleted ? visit.visit_date : visit.due_date)}

					<a
						href={`/visits/visit${visit.visit_number}/${visit.id}`}
						class="group block bg-white rounded-2xl p-2 shadow-xl/2 hover:border-emerald-500 hover:ring-1 hover:ring-emerald-500 hover:shadow-lg hover:shadow-emerald-900/5 hover:-translate-y-0.5 transition-all duration-200"
					>
						<div class="flex items-center gap-5">
							<div
								class={`h-20 w-20 shrink-0 rounded-xl flex flex-col items-center justify-center border transition-colors duration-200 ${
									isCompleted
										? 'bg-emerald-50 border-emerald-100'
										: 'bg-slate-100 border-slate-200'
								}`}
							>
								<span
									class={`text-[9px] font-bold uppercase tracking-widest mb-1 ${
										isCompleted ? 'text-emerald-600' : 'text-slate-400'
									}`}
								>
									Visit
								</span>
								<span
									class={`text-3xl font-light leading-none ${
										isCompleted ? 'text-emerald-700' : 'text-slate-600'
									}`}
								>
									{visit.visit_number}
								</span>
							</div>

							<div class="flex-1 min-w-0 py-2">
								<div class="flex items-center gap-2 mb-1">
									{#if isCompleted}
										<div class="flex items-center gap-1.5 text-emerald-600">
											<CircleCheck size={12} strokeWidth={2.5} />
											<span
												class="text-[10px] font-bold uppercase tracking-widest"
												>Completed</span
											>
										</div>
									{:else}
										<div class="flex items-center gap-1.5 text-amber-600">
											<Clock size={12} strokeWidth={2.5} />
											<span
												class="text-[10px] font-bold uppercase tracking-widest"
												>Due</span
											>
										</div>
									{/if}
								</div>

								<h3
									class={`text-lg font-semibold tracking-tight ${
										isCompleted ? 'text-slate-900' : 'text-amber-600'
									}`}
								>
									{dateStr}
								</h3>
							</div>

							<div
								class="pr-5 text-slate-300 group-hover:text-emerald-600 transition-colors"
							>
								<ArrowUpRight size={20} strokeWidth={2} />
							</div>
						</div>
					</a>
				{/each}
			{/if}
		</main>
	</div>
</div>
