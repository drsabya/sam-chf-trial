<!-- src/routes/participants/[id]/create-visit/+page.svelte -->
<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData | null } = $props();
	const participant = data.participant;
	const visits = data.visits;

	// Values & messages from action
	const values: any = (form as any)?.values ?? {};
	const errorMessage: string | null = (form as any)?.error ?? null;
	const message: string | null = (form as any)?.message ?? null;
	const success: boolean = (form as any)?.success ?? false;
</script>

<div class="min-h-screen bg-slate-50">
	<div class="max-w-3xl mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
		<header class="mb-6">
			<h1 class="text-xl font-semibold text-slate-900">
				Create Visit for {participant.first_name}
				{participant.last_name}
			</h1>
			<p class="text-sm text-slate-600">Add a new follow-up visit for this participant.</p>
		</header>

		<form
			method="POST"
			class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6"
		>
			<!-- Error -->
			{#if errorMessage}
				<div class="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
					{errorMessage}
				</div>
			{/if}

			<!-- Success -->
			{#if message}
				<div
					class={`rounded-lg px-3 py-2 text-sm ${
						success
							? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
							: 'bg-red-50 border border-red-200 text-red-700'
					}`}
				>
					{message}
				</div>
			{/if}

			<!-- Visit number -->
			<div class="space-y-1">
				<label class="block text-sm font-medium text-slate-800">Visit Number *</label>
				<input
					type="number"
					name="visit_number"
					required
					min="1"
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500"
					value={values.visit_number ?? ''}
				/>
			</div>

			<!-- Optional visit date -->
			<div class="space-y-1">
				<label class="block text-sm font-medium text-slate-800">Visit Date (optional)</label>
				<input
					type="date"
					name="visit_date"
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500"
					value={values.visit_date ?? ''}
				/>
				<p class="text-xs text-slate-500">Leave blank if the visit has not yet been completed.</p>
			</div>

			<div class="flex justify-end gap-3">
				<a
					href={`/participants/${participant.id}`}
					class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
				>
					Back to participant
				</a>
				<button
					type="submit"
					class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow hover:bg-emerald-700"
				>
					Create Visit
				</button>
			</div>
		</form>

		<!-- Existing visits -->
		<section class="mt-10">
			<h2 class="text-lg font-semibold text-slate-900 mb-3">Existing Visits</h2>

			{#if visits.length === 0}
				<p class="text-sm text-slate-500">No visits recorded yet.</p>
			{:else}
				<div class="space-y-2">
					{#each visits as v}
						<div class="rounded-xl border border-slate-200 bg-white p-4">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm font-medium text-slate-800">Visit {v.visit_number}</p>
									<p class="text-xs text-slate-500">
										{v.visit_date ? `Completed on ${v.visit_date}` : 'Not completed yet'}
									</p>
								</div>
								<a href={`/visits/visit1/${v.id}`} class="text-emerald-600 hover:underline text-sm">
									Open →
								</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- 🔗 Create more participants -->
		<div class="mt-8 text-center">
			<a
				href="/participants/create"
				class="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
			>
				Create more participants
			</a>
		</div>
	</div>
</div>
