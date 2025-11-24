<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Use the participants fetched from the server
	const allParticipants = data.participants;

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

	function screeningBadge(screening_id: string) {
		return screening_id || '—';
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

	<div class="bg-white rounded-2xl shadow-sm border border-slate-100">
		{#if filteredParticipants().length === 0}
			<p class="px-4 py-6 text-sm text-slate-500 text-center">
				No participants found matching **{search}**.
			</p>
		{:else}
			<ul>
				{#each filteredParticipants() as p, i}
					<li>
						<a
							href={`/participants/${p.id}`}
							class="flex items-center justify-between px-4 py-4 text-sm hover:bg-slate-50"
						>
							<div class="flex flex-col">
								<span class="font-semibold text-slate-900">
									{fullName(p) || 'Unnamed participant'}
								</span>
							</div>

							<span
								class="inline-flex items-center justify-center rounded-full bg-emerald-300/90 text-emerald-900 text-xs font-semibold px-3 py-1"
							>
								{screeningBadge(p.screening_id)}
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
