<!-- src/routes/leads/+page.svelte -->
<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData | null } = $props();

	// Sort leads:
	// 1) scheduled_on present
	// 2) called
	// 3) not called
	// 4) patient_willing === false => bottom
	const leads = [...(data.leads ?? [])].sort((a, b) => {
		// Not willing always at the bottom
		if (a.patient_willing === false && b.patient_willing !== false) return 1;
		if (b.patient_willing === false && a.patient_willing !== false) return -1;

		// Leads with scheduled_on come first
		if (a.scheduled_on && !b.scheduled_on) return -1;
		if (!a.scheduled_on && b.scheduled_on) return 1;

		// Called come before not called
		if (a.was_called && !b.was_called) return -1;
		if (!a.was_called && b.was_called) return 1;

		return 0;
	});

	function formatDate(value: string | null | undefined) {
		if (!value) return 'Not scheduled';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return 'Not scheduled';
		return d.toLocaleDateString('en-IN', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<main class="max-w-2xl mx-auto px-4 pt-10 pb-16 font-sans">
	<div class="space-y-12">
		<!-- Create Lead Form -->
		<section class="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
			<div class="space-y-1">
				<h1 class="text-xl font-semibold tracking-tight text-gray-900">
					New <span class="text-emerald-700">Lead</span>
				</h1>
				<p class="text-sm text-gray-500">Enter the details below.</p>
			</div>

			<form method="POST" action="?/create" class="space-y-5">
				<div class="space-y-2">
					<label for="name" class="block text-xs uppercase tracking-wide font-medium text-gray-600">
						Full Name <span class="text-red-500">*</span>
					</label>
					<input
						id="name"
						name="name"
						type="text"
						required
						class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
						placeholder="e.g., Rohan Sharma"
						value={form?.values?.name ?? ''}
					/>
				</div>

				<div class="space-y-2">
					<label
						for="phone"
						class="block text-xs uppercase tracking-wider font-medium text-gray-600"
					>
						Phone <span class="text-gray-400 normal-case font-normal">(optional)</span>
					</label>
					<input
						id="phone"
						name="phone"
						type="tel"
						inputmode="numeric"
						pattern="[0-9]*"
						class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
						placeholder="e.g., 9876543210"
						value={form?.values?.phone ?? ''}
					/>
				</div>

				{#if form?.message}
					<p
						class="text-sm whitespace-pre-wrap px-4 py-2.5 rounded-xl border"
						class:bg-red-50={form?.message && !form?.success}
						class:text-red-700={form?.message && !form?.success}
						class:border-red-200={form?.message && !form?.success}
						class:bg-emerald-50={form?.success}
						class:text-emerald-800={form?.success}
						class:border-emerald-200={form?.success}
					>
						{form.message}
					</p>
				{/if}

				<button
					type="submit"
					class="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500"
				>
					Create Lead
				</button>
			</form>
		</section>

		<!-- Leads List -->
		<section class="space-y-4">
			<h2 class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
				All Leads ({leads.length})
			</h2>

			{#if leads.length === 0}
				<p class="text-sm text-gray-500 py-6 text-center border-y border-gray-200">No leads yet.</p>
			{:else}
				<div class="divide-y divide-gray-200 border-y border-gray-200">
					{#each leads as lead}
						<a
							href={`/leads/${lead.id}`}
							class="flex items-center justify-between px-2 py-4 hover:bg-gray-50 transition"
						>
							<!-- LEFT: Name -->
							<div>
								<p class="font-medium text-gray-900">{lead.name}</p>
							</div>

							<!-- RIGHT: Status logic with badges -->
							<div class="text-right text-xs leading-tight">
								<!-- Scheduled (dark emerald, no badge) -->
								{#if lead.scheduled_on}
									<div class="text-gray-500">Scheduled on</div>
									<div class="font-semibold text-emerald-700">
										{formatDate(lead.scheduled_on)}
									</div>

									<!-- Patient unwilling (red badge) -->
								{:else if lead.was_called && lead.patient_willing === false}
									<div
										class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold
								 bg-red-100 text-red-700 border border-red-200"
									>
										Patient unwilling
									</div>

									<!-- Called (green badge) -->
								{:else if lead.was_called}
									<div
										class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold
								 bg-emerald-100 text-emerald-700 border border-emerald-200"
									>
										Called
									</div>

									<!-- Not called yet (yellow badge) -->
								{:else}
									<div
										class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold
								 bg-amber-100 text-amber-700 border border-amber-200"
									>
										Not called yet
									</div>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</main>
