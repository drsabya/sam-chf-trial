<!-- src/routes/participants/+page.svelte -->
<script lang="ts">
	import type { PageData } from './$types';

	type Participant = {
		id: string;
		first_name: string | null;
		middle_name: string | null;
		last_name: string | null;
		screening_id: string;
		randomization_id: string | null;
		screening_failure: boolean | null;
	};

	let { data }: { data: PageData } = $props();

	// Use the participants fetched from the server
	const allParticipants = data.participants as Participant[];

	// Use $state for the search input to make it reactive
	let search = $state('');

	function fullName(p: {
		first_name: string | null;
		middle_name: string | null;
		last_name: string | null;
	}) {
		return [p.first_name, p.middle_name, p.last_name]
			.map((x) => x?.trim())
			.filter((x) => x && x.length > 0)
			.join(' ');
	}

	function screeningBadge(screening_id: string | null | undefined) {
		return screening_id && screening_id.trim().length > 0 ? screening_id : '—';
	}

	// Reactive filtering logic
	const filteredParticipants = $derived(() => {
		const query = search.toLowerCase().trim();

		if (!query) {
			// If search is empty, return all participants
			return allParticipants;
		}

		return allParticipants.filter((p) => {
			const name = fullName(p).toLowerCase();
			const screeningId = p.screening_id?.toLowerCase() ?? '';
			const randomizationId = p.randomization_id?.toLowerCase() ?? '';

			return name.includes(query) || screeningId.includes(query) || randomizationId.includes(query);
		});
	});
</script>

<div class="max-w-xl mx-auto px-4 py-4 space-y-4">
	<div class="search-container">
		<input
			type="text"
			placeholder="Search name, screening id or randomisation id"
			bind:value={search}
			class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
		/>
	</div>

	<div>
		{#if filteredParticipants().length === 0}
			<p class="px-4 py-6 text-sm text-slate-500 text-center">
				No participants found matching "{search}".
			</p>
		{:else}
			<ul>
				{#each filteredParticipants() as p, i}
					<li>
						<a
							href={`/participants/${p.id}/visits`}
							class="flex items-center justify-between px-4 py-4 text-sm hover:bg-slate-50"
						>
							<div class="flex flex-col">
								<span class="font-semibold text-slate-900">
									{fullName(p) || 'Unnamed participant'}
								</span>
							</div>

							<!-- IDs + failure flag -->
							<span class="font-mono text-xs text-slate-700 flex items-center gap-2">
								<span class="flex items-center gap-1">
									<span>{screeningBadge(p.screening_id)}</span>

									{#if p.screening_failure}
										<span
											class="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600"
											title="Screening failure"
										>
											F
										</span>
									{/if}
								</span>

								{#if p.randomization_id}
									<span class="text-[11px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
										{p.randomization_id}
									</span>
								{/if}
							</span>
						</a>

						{#if i < filteredParticipants().length - 1}
							<hr class="border-slate-100" />
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
