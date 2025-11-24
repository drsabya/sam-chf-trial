<!-- src/routes/leads/[id]/+page.svelte -->
<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { Phone } from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData | null } = $props();

	const lead = (form?.lead as any) ?? data.lead;

	function formatDateTime(value: string | null | undefined) {
		if (!value) return 'Not scheduled';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return 'Not scheduled';
		return d.toLocaleDateString('en-IN', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	function toDateInputValue(value: string | null | undefined) {
		if (!value) return '';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return '';
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
			d.getDate()
		).padStart(2, '0')}`;
	}

	const phoneValue = (form?.values?.phone as string | undefined) ?? lead.phone ?? '';

	/* =============================
	   Checkbox Logic (Inversion)
	   patient_unwilling checkbox ON → patient_willing = false
	   patient_unwilling checkbox OFF → patient_willing = true/null
	================================*/
	let wasCalledChecked =
		form?.values?.was_called !== undefined
			? Boolean(form.values.was_called)
			: Boolean(lead.was_called);

	let patientUnwilling =
		form?.values?.patient_willing !== undefined
			? !Boolean(form.values.patient_willing)
			: lead.patient_willing === false;

	let scheduledOnValue =
		(form?.values?.scheduled_on as string | undefined) ?? toDateInputValue(lead.scheduled_on);
</script>

<main class="max-w-xl mx-auto px-4 pt-10 pb-12">
	<div class="space-y-6">
		<!-- Header -->
		<section class="bg-white border border-emerald-100 rounded-2xl shadow-sm p-6 space-y-3">
			<a
				href="/leads"
				class="inline-flex items-center text-xs font-medium text-emerald-700 hover:text-emerald-800"
			>
				<span class="mr-1.5">&larr;</span> Back to leads
			</a>

			<p class="text-xs text-emerald-700 font-medium uppercase tracking-wide">Lead details</p>

			<h1 class="text-2xl font-semibold text-gray-900">
				{lead.name}
			</h1>

			{#if lead.phone}
				<a
					href={`tel:${lead.phone}`}
					class="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 mt-1"
				>
					<Phone class="w-4 h-4" />
					<span>{lead.phone}</span>
				</a>
			{/if}

			<div class="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-2">
				<!-- Called Chip -->
				<div class="inline-flex items-center gap-1.5">
					<span
						class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border"
						class:bg-emerald-50={lead.was_called}
						class:text-emerald-700={lead.was_called}
						class:border-emerald-200={lead.was_called}
						class:bg-amber-50={!lead.was_called}
						class:text-amber-700={!lead.was_called}
						class:border-amber-200={!lead.was_called}
					>
						{lead.was_called ? 'Called' : 'Not called yet'}
					</span>
				</div>

				<!-- Patient willingness chip -->
				<div class="inline-flex items-center gap-1.5">
					<span
						class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border"
						class:bg-emerald-50={lead.patient_willing === true}
						class:text-emerald-700={lead.patient_willing === true}
						class:border-emerald-200={lead.patient_willing === true}
						class:bg-amber-50={lead.patient_willing === false}
						class:text-amber-700={lead.patient_willing === false}
						class:border-amber-200={lead.patient_willing === false}
						class:bg-slate-50={lead.patient_willing == null}
						class:text-slate-700={lead.patient_willing == null}
						class:border-slate-200={lead.patient_willing == null}
					>
						{lead.patient_willing === true
							? 'Willing'
							: lead.patient_willing === false
								? 'Unwilling'
								: 'Not assessed'}
					</span>
				</div>
			</div>
		</section>

		<!-- Edit form -->
		<section class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
			<h2 class="text-sm font-semibold text-gray-800">Call planning</h2>

			<form method="POST" action="?/update" class="space-y-5">
				<!-- Phone -->
				<div class="space-y-1.5">
					<label for="phone" class="text-sm font-medium text-gray-700"
						>Phone <span class="text-red-500">*</span></label
					>
					<input
						id="phone"
						name="phone"
						type="tel"
						required
						inputmode="numeric"
						pattern="[0-9]*"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
						placeholder="Update phone number"
						value={phoneValue}
					/>
				</div>

				<!-- Patient called (emerald checkbox, label toggles) -->
				<div class="flex items-center gap-3">
					<input
						id="was_called"
						name="was_called"
						type="checkbox"
						bind:checked={wasCalledChecked}
						class="h-5 w-5 rounded border-gray-400 accent-emerald-600 focus:ring-emerald-600 focus:ring-2"
					/>
					<label for="was_called" class="text-sm font-medium text-gray-700"> Patient called </label>
				</div>

				<!-- Patient UNWILLING (red checkbox, normal label, label toggles) -->
				<div class="flex items-center gap-3">
					<input
						id="patient_unwilling"
						name="patient_willing"
						type="checkbox"
						bind:checked={patientUnwilling}
						class="h-5 w-5 accent-red-600 border-gray-300 focus:ring-red-500 focus:ring-2"
					/>
					<label for="patient_unwilling" class="text-sm font-medium text-gray-700">
						Patient unwilling
					</label>
				</div>

				<!-- Scheduled date -->
				<div class="space-y-1.5">
					<label for="scheduled_on" class="text-sm font-medium text-gray-700">
						Scheduled on <span class="text-gray-400 text-xs">(optional)</span>
					</label>
					<input
						id="scheduled_on"
						name="scheduled_on"
						type="date"
						bind:value={scheduledOnValue}
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
					/>
					<p class="text-xs text-gray-400">
						Current: {formatDateTime(lead.scheduled_on)}
					</p>
				</div>

				<!-- Messages -->
				{#if form?.message}
					<p class="text-sm px-3 py-2 rounded-lg border bg-red-50 text-red-700 border-red-300">
						{form.message}
					</p>
				{/if}

				<!-- Save -->
				<button
					type="submit"
					class="w-full rounded-full px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700"
				>
					Save changes
				</button>
			</form>
		</section>
	</div>
</main>
