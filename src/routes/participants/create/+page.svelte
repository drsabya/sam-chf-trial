<!-- src/routes/participants/create/+page.svelte -->
<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData | null } = $props();
</script>

<div class="min-h-screen bg-slate-50">
	<div class="max-w-3xl mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
		<header class="mb-6 sm:mb-8">
			<h1 class="text-xl sm:text-2xl font-semibold text-slate-900">Create participant</h1>
			<p class="mt-1 text-sm text-slate-600">
				Add a new participant with basic identifiers. You can fill the remaining details later.
			</p>
		</header>

		<form
			method="POST"
			class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6"
		>
			{#if form?.error}
				<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{form.error}
				</div>
			{/if}

			<!-- Name block -->
			<div class="space-y-2">
				<label class="block text-sm font-medium text-slate-800">Name</label>
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div class="space-y-1">
						<label for="first_name" class="text-xs font-medium text-slate-600">First name *</label>
						<input
							id="first_name"
							name="first_name"
							type="text"
							required
							class="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
							value={form?.values?.first_name ?? ''}
						/>
					</div>

					<div class="space-y-1">
						<label for="middle_name" class="text-xs font-medium text-slate-600">Middle name</label>
						<input
							id="middle_name"
							name="middle_name"
							type="text"
							class="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
							value={form?.values?.middle_name ?? ''}
						/>
					</div>

					<div class="space-y-1">
						<label for="last_name" class="text-xs font-medium text-slate-600">Last name *</label>
						<input
							id="last_name"
							name="last_name"
							type="text"
							required
							class="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
							value={form?.values?.last_name ?? ''}
						/>
					</div>
				</div>
			</div>

			<!-- IDs block -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div class="space-y-1">
					<label for="screening_id" class="block text-sm font-medium text-slate-800">
						Screening ID *
					</label>
					<input
						id="screening_id"
						name="screening_id"
						type="text"
						required
						class="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 uppercase tracking-wide outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
						placeholder="S1, S2, …"
						value={form?.values?.screening_id ?? ''}
					/>
					<p class="mt-1 text-xs text-slate-500">Must be unique (e.g. S1, S2, S3…).</p>
				</div>

				<div class="space-y-1">
					<label for="randomization_id" class="block text-sm font-medium text-slate-800">
						Randomization ID
					</label>
					<input
						id="randomization_id"
						name="randomization_id"
						type="text"
						class="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 uppercase tracking-wide outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
						placeholder="R1, R2, … (optional)"
						value={form?.values?.randomization_id ?? ''}
					/>
					<p class="mt-1 text-xs text-slate-500">
						You can leave this blank until the participant is randomized.
					</p>
				</div>
			</div>

			<div class="flex items-center justify-end gap-3 pt-2">
				<a
					href="/participants"
					class="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
				>
					Cancel
				</a>
				<button
					type="submit"
					class="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
				>
					Save participant
				</button>
			</div>
		</form>
	</div>
</div>
