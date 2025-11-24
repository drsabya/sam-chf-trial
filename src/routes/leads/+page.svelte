<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { fade } from 'svelte/transition';

	let { data, form }: { data: PageData; form: ActionData | null } = $props();

	// Sort leads logic
	const leads = $derived(
		[...(data.leads ?? [])].sort((a, b) => {
			if (a.patient_willing === false && b.patient_willing !== false) return 1;
			if (b.patient_willing === false && a.patient_willing !== false) return -1;
			if (a.scheduled_on && !b.scheduled_on) return -1;
			if (!a.scheduled_on && b.scheduled_on) return 1;
			if (a.was_called && !b.was_called) return -1;
			if (!a.was_called && b.was_called) return 1;
			return 0;
		})
	);

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

<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
	<div class="max-w-lg mx-auto space-y-8">
		<div
			class="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-gray-100"
		>
			<div class="px-8 pt-10 pb-2">
				<h1 class="text-2xl font-light text-emerald-900">New Lead</h1>
				<p class="text-sm text-gray-500 mt-2">Register a new patient interest.</p>
			</div>

			<div class="p-8 pt-6">
				<form method="POST" action="?/create" class="space-y-6">
					<div class="space-y-5">
						<div class="space-y-2">
							<label for="name" class="text-sm font-medium text-slate-700 ml-1">
								Full Name <span class="text-emerald-600">*</span>
							</label>
							<input
								id="name"
								name="name"
								type="text"
								required
								class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-slate-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50/50 transition-all duration-200"
								placeholder="e.g., Rohan Sharma"
								value={form?.values?.name ?? ''}
							/>
						</div>

						<div class="space-y-2">
							<label for="phone" class="text-sm font-medium text-slate-700 ml-1">
								Phone Number
							</label>
							<div class="relative">
								<span
									class="absolute left-4 top-3.5 text-gray-400 text-sm pointer-events-none select-none"
									>+91</span
								>
								<input
									id="phone"
									name="phone"
									type="tel"
									inputmode="numeric"
									pattern="[0-9]*"
									class="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-slate-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50/50 transition-all duration-200"
									placeholder="98765 43210"
									value={form?.values?.phone ?? ''}
								/>
							</div>
						</div>
					</div>

					{#if form?.message}
						<div
							transition:fade
							class="text-sm px-4 py-3 rounded-xl border flex items-start gap-2
                            {form?.success
								? 'bg-emerald-50 border-emerald-100 text-emerald-800'
								: 'bg-red-50 border-red-100 text-red-800'}"
						>
							<span class="text-lg leading-none">{form?.success ? '✓' : '⚠'}</span>
							{form.message}
						</div>
					{/if}

					<button
						type="submit"
						class="w-full py-4 rounded-xl text-sm font-bold tracking-wide shadow-lg shadow-emerald-900/20 bg-emerald-700 text-white hover:bg-emerald-800 hover:shadow-emerald-900/30 hover:-translate-y-0.5 transition-all duration-300 ease-out"
					>
						CREATE LEAD
					</button>
				</form>
			</div>
		</div>

		<div class="space-y-4">
			<div class="px-4 flex items-center justify-between">
				<h2 class="text-sm font-bold tracking-widest text-gray-400 uppercase">
					History ({leads.length})
				</h2>
			</div>

			{#if leads.length === 0}
				<div
					class="text-center py-12 opacity-50 border-2 border-dashed border-gray-200 rounded-3xl"
				>
					<p class="text-sm text-gray-400">No leads recorded yet.</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each leads as lead}
						<a
							href={`/leads/${lead.id}`}
							class="block bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-emerald-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group relative overflow-hidden"
						>
							<div
								class="absolute left-0 top-0 bottom-0 w-1
                                {lead.scheduled_on
									? 'bg-emerald-500'
									: lead.was_called && lead.patient_willing === false
										? 'bg-red-400'
										: lead.was_called
											? 'bg-emerald-300'
											: 'bg-amber-300'}"
							></div>

							<div class="flex justify-between items-center pl-2">
								<div>
									<h3
										class="font-medium text-slate-700 text-[15px] group-hover:text-emerald-900 transition-colors"
									>
										{lead.name}
									</h3>
									<div class="mt-1">
										{#if lead.scheduled_on}
											<span
												class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md"
											>
												📅 {formatDate(lead.scheduled_on)}
											</span>
										{:else if lead.was_called && lead.patient_willing === false}
											<span
												class="inline-flex items-center text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-md"
											>
												Unwilling
											</span>
										{:else if lead.was_called}
											<span
												class="inline-flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md"
											>
												Called
											</span>
										{:else}
											<span
												class="inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md"
											>
												Pending Call
											</span>
										{/if}
									</div>
								</div>

								<div class="text-gray-300 group-hover:text-emerald-400 transition-colors">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 20 20"
										fill="currentColor"
										class="w-5 h-5"
									>
										<path
											fill-rule="evenodd"
											d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
