<!-- src/routes/participants/[id]/+page.svelte -->
<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { Phone } from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData | null } = $props();

	// Participant data – prefer updated participant from action if present
	const participant = (form?.participant as any) ?? data.participant;
	const visits = data.visits ?? [];

	// Values returned on validation failure (so we can re-fill the form)
	const values: any = (form as any)?.values ?? {};

	const message: string | null = (form as any)?.message ?? null;
	const success: boolean = (form as any)?.success ?? false;

	const initials =
		participant.initials ??
		[participant.first_name, participant.middle_name, participant.last_name]
			.map((n: string | null | undefined) => n?.trim?.()[0]?.toUpperCase?.() ?? '')
			.filter(Boolean)
			.join('');

	const fullName = [participant.first_name, participant.middle_name, participant.last_name]
		.map((n: string | null | undefined) => n?.trim?.())
		.filter(Boolean)
		.join(' ');

	const phone = participant.phone;
	const screeningId = participant.screening_id;

	let activeTab = $state<'details' | 'visits'>('details');

	function currentValue(field: string, fallback: any = '') {
		// Prefer form values (if validation failed), else current participant value
		return values[field] ?? participant[field] ?? fallback;
	}
</script>

<div class="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
	<div class="max-w-xl mx-auto space-y-6">
		<!-- Top header block -->
		<div class="text-center space-y-2 mt-4">
			<div class="flex items-center justify-center gap-2 text-sm text-slate-500 mb-1">
				<span class="text-2xl font-semibold tracking-wide text-slate-900">
					{initials || 'NA'}
				</span>
				<span class="text-2xl text-slate-400">•</span>
				<span class="text-2xl font-extrabold tracking-wide text-slate-900">
					{screeningId}
				</span>
			</div>

			<p class="text-base font-medium text-slate-800">
				{fullName || 'Unnamed Participant'}
			</p>

			{#if phone}
				<a
					href={`tel:${phone}`}
					class="inline-flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 mt-1"
				>
					<Phone class="w-4 h-4" />
					<span>{phone}</span>
				</a>
			{/if}
		</div>

		<!-- Tabs -->
		<div class="mt-6 rounded-full bg-slate-100 p-1 flex text-sm font-medium">
			<button
				type="button"
				class={`flex-1 py-2 rounded-full transition-all ${
					activeTab === 'details'
						? 'bg-white shadow text-slate-900'
						: 'text-slate-500 hover:text-slate-800'
				}`}
				onclick={() => (activeTab = 'details')}
			>
				Details
			</button>
			<button
				type="button"
				class={`flex-1 py-2 rounded-full transition-all ${
					activeTab === 'visits'
						? 'bg-white shadow text-slate-900'
						: 'text-slate-500 hover:text-slate-800'
				}`}
				onclick={() => (activeTab = 'visits')}
			>
				Visits
			</button>
		</div>

		<!-- Details Tab -->
		{#if activeTab === 'details'}
			<form
				method="POST"
				action="?/update"
				class="mt-4 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-5 sm:p-6 space-y-5"
			>
				<p class="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase mb-1">
					Core Details
				</p>

				<!-- First name -->
				<div class="space-y-1.5">
					<label for="first_name" class="text-xs font-medium text-slate-700">First Name</label>
					<input
						id="first_name"
						name="first_name"
						type="text"
						class="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						value={currentValue('first_name', '')}
						placeholder="First Name"
					/>
				</div>

				<!-- Middle name -->
				<div class="space-y-1.5">
					<label for="middle_name" class="text-xs font-medium text-slate-700">Middle Name</label>
					<input
						id="middle_name"
						name="middle_name"
						type="text"
						class="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						value={currentValue('middle_name', '')}
						placeholder="Middle Name"
					/>
				</div>

				<!-- Last name -->
				<div class="space-y-1.5">
					<label for="last_name" class="text-xs font-medium text-slate-700">Last Name</label>
					<input
						id="last_name"
						name="last_name"
						type="text"
						class="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						value={currentValue('last_name', '')}
						placeholder="Last Name"
					/>
				</div>

				<!-- Phone -->
				<div class="space-y-1.5">
					<label for="phone" class="text-xs font-medium text-slate-700">Phone</label>
					<input
						id="phone"
						name="phone"
						type="tel"
						class="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						value={currentValue('phone', '')}
						placeholder="Primary phone number"
						required
					/>
				</div>

				<!-- Alternate phone -->
				<div class="space-y-1.5">
					<label for="alternate_phone" class="text-xs font-medium text-slate-700">
						Alternate Phone
					</label>
					<input
						id="alternate_phone"
						name="alternate_phone"
						type="tel"
						class="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						value={currentValue('alternate_phone', '')}
						placeholder="Alternate phone number"
					/>
				</div>

				<!-- Age -->
				<div class="space-y-1.5">
					<label for="age" class="text-xs font-medium text-slate-700">Age</label>
					<input
						id="age"
						name="age"
						type="number"
						min="0"
						class="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						value={currentValue('age', '')}
						placeholder="Age in years"
					/>
				</div>

				<!-- Sex -->
				<div class="space-y-1.5">
					<label for="sex" class="text-xs font-medium text-slate-700">Sex</label>
					<select
						id="sex"
						name="sex"
						class="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
					>
						{#await Promise.resolve() then}
							<!-- quick hack to compute current -->
							{@const currentSex = currentValue('sex', '')}
							<option value="">Select</option>
							<option value="Male" selected={currentSex === 'Male'}>Male</option>
							<option value="Female" selected={currentSex === 'Female'}>Female</option>
							<option value="Other" selected={currentSex === 'Other'}>Other</option>
						{/await}
					</select>
				</div>

				<!-- Address -->
				<div class="space-y-1.5">
					<label for="address" class="text-xs font-medium text-slate-700">Address</label>
					<textarea
						id="address"
						name="address"
						rows="2"
						class="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
						placeholder="Full address">{currentValue('address', '')}</textarea
					>
				</div>

				<!-- Education -->
				<div class="space-y-1.5">
					<label for="education" class="text-xs font-medium text-slate-700">Education</label>
					<input
						id="education"
						name="education"
						type="text"
						class="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						value={currentValue('education', '')}
						placeholder="Education"
					/>
				</div>

				<!-- Occupation -->
				<div class="space-y-1.5">
					<label for="occupation" class="text-xs font-medium text-slate-700">Occupation</label>
					<input
						id="occupation"
						name="occupation"
						type="text"
						class="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						value={currentValue('occupation', '')}
						placeholder="Occupation"
					/>
				</div>

				<!-- Income -->
				<div class="space-y-1.5">
					<label for="income" class="text-xs font-medium text-slate-700">Monthly Income (₹)</label>
					<input
						id="income"
						name="income"
						type="number"
						min="0"
						class="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						value={currentValue('income', '')}
						placeholder="Monthly income"
					/>
				</div>

				<!-- Submit button -->
				<button
					type="submit"
					class="mt-2 w-full py-3 rounded-2xl text-sm font-semibold tracking-wide bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-transform hover:-translate-y-0.5"
				>
					Save Changes
				</button>

				{#if message}
					<p class={`text-xs text-center mt-1 ${success ? 'text-emerald-700' : 'text-red-600'}`}>
						{message}
					</p>
				{/if}
				<div class="pt-4 text-center">
					<a
						href={`/participants/${participant.id}/create-visit`}
						class="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
					>
						Add a new visit →
					</a>
				</div>
			</form>
		{/if}

		<!-- Visits Tab -->
		{#if activeTab === 'visits'}
			<div
				class="mt-4 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-5 sm:p-6"
			>
				<p class="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase mb-3">
					Visits
				</p>

				{#if visits.length === 0}
					<p class="text-sm text-slate-500">No visits recorded yet for this participant.</p>
				{:else}
					<div class="space-y-3 text-sm">
						{#each visits as visit}
							<div
								class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 border border-slate-100"
							>
								<div>
									<p class="font-medium text-slate-800">
										Visit {visit.visit_number ?? visit.visitNumber}
									</p>
									<p class="text-xs text-slate-500 mt-0.5">
										Start: {visit.start_date ?? visit.startDate ?? '—'}
									</p>
								</div>

								<a
									href={`/visits/visit${visit.visit_number ?? visit.visitNumber}/${visit.id}`}
									class="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
								>
									Open
								</a>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
