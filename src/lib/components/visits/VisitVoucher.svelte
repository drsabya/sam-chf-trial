<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	export type VoucherStatus = '' | 'given' | 'not_given';

	interface Props {
		visit: any;
		participant: any;
		disabled?: boolean;
	}

	let {
		visit = $bindable(),
		participant: _participant,
		disabled = false
	}: Props = $props();

	let voucherStatus = $state<VoucherStatus>(
		visit?.voucher_given === true ? 'given' : visit?.voucher_given === false ? 'not_given' : ''
	);
	let loading = $state(false);

	const dispatch = createEventDispatcher<{
		changed: boolean | null;
	}>();

	async function handleVoucherChange(value: VoucherStatus) {
		if (disabled || loading || voucherStatus === value) return;

		const previousStatus = voucherStatus;
		voucherStatus = value; // Optimistic update

		loading = true;

		try {
			const fd = new FormData();
			fd.append('visitId', visit.id);
			fd.append('voucher_status', value);

			const res = await fetch('/apis/visits/voucher', {
				method: 'POST',
				body: fd
			});

			if (!res.ok) throw new Error(await res.text());

			const data = (await res.json()) as { ok: boolean; voucher_given: boolean | null };

			if (!data.ok) throw new Error('API returned not ok');

			// Sync strict state
			visit = { ...visit, voucher_given: data.voucher_given };
			dispatch('changed', data.voucher_given);
		} catch (err) {
			console.error('Error updating voucher:', err);
			// Revert on failure
			voucherStatus = previousStatus;
			alert('Could not update voucher status. Please try again.');
		} finally {
			loading = false;
		}
	}
</script>

<section class="mt-6 {disabled ? 'opacity-60 pointer-events-none' : ''}">
	<div class="flex items-center justify-between mb-3 px-1">
		<h3 class="text-xs font-bold uppercase tracking-widest text-slate-400">
			Voucher Status
		</h3>
		{#if loading}
			<span transition:fade class="text-xs font-medium text-slate-400 flex items-center gap-1">
				<svg class="animate-spin h-3 w-3 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				Saving...
			</span>
		{/if}
	</div>

	<div class="grid grid-cols-2 gap-3">
		<label class="group relative">
			<input
				type="radio"
				name="voucher_status"
				value="given"
				disabled={disabled || loading}
				checked={voucherStatus === 'given'}
				onchange={() => handleVoucherChange('given')}
				class="peer sr-only"
			/>
			<div
				class="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                bg-white border-slate-100 text-slate-500 shadow-sm
                hover:border-slate-200 hover:bg-slate-50
                peer-checked:bg-emerald-50/50 peer-checked:border-emerald-500 peer-checked:text-emerald-700 peer-checked:shadow-md
                active:scale-[0.98]"
			>
				<div class="p-2 rounded-full transition-colors duration-200 bg-slate-100 group-hover:bg-white group-peer-checked:bg-emerald-100 text-slate-400 group-peer-checked:text-emerald-600">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M20 6 9 17l-5-5"/>
					</svg>
				</div>
				<span class="text-sm font-semibold">Given</span>
			</div>
			
			{#if voucherStatus === 'given'}
				<div in:scale={{ duration: 200, start: 0.5 }} class="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm">
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
				</div>
			{/if}
		</label>

		<label class="group relative">
			<input
				type="radio"
				name="voucher_status"
				value="not_given"
				disabled={disabled || loading}
				checked={voucherStatus === 'not_given'}
				onchange={() => handleVoucherChange('not_given')}
				class="peer sr-only"
			/>
			<div
				class="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                bg-white border-slate-100 text-slate-500 shadow-sm
                hover:border-slate-200 hover:bg-slate-50
                peer-checked:bg-rose-50/50 peer-checked:border-rose-500 peer-checked:text-rose-700 peer-checked:shadow-md
                active:scale-[0.98]"
			>
				<div class="p-2 rounded-full transition-colors duration-200 bg-slate-100 group-hover:bg-white group-peer-checked:bg-rose-100 text-slate-400 group-peer-checked:text-rose-600">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 6 6 18"/><path d="m6 6 12 12"/>
					</svg>
				</div>
				<span class="text-sm font-semibold">Not Given</span>
			</div>
		</label>
	</div>
</section>