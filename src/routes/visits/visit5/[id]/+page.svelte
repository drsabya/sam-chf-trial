<!-- src/routes/visits/visit5/[id]/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';
	import { Calendar, CheckCircle2, ChevronDown } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import VisitHeader from '$lib/components/visits/VisitHeader.svelte';
	import VisitSafetyLabs from '$lib/components/visits/VisitSafetyLabs.svelte';

	let { data }: PageProps = $props();
	let visit = $state(data.visit);
	let participant = $state(data.participant);
	let opdOptions = $state<string[]>(data.opdOptions ?? []);

	let scheduledOn = $state<string>(visit.scheduled_on ?? '');

	type VoucherStatus = '' | 'given' | 'not_given';

	let voucherStatus = $state<VoucherStatus>(
		visit.voucher_given === true ? 'given' : visit.voucher_given === false ? 'not_given' : ''
	);

	/* --------------------------------------------
	   Helpers
	--------------------------------------------- */
	function formatDatePretty(value: string | null | undefined) {
		if (!value) return 'Not set';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return 'Not set';
		return d.toLocaleDateString('en-GB', {
			weekday: 'short',
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	/* --------------------------------------------
	   Voucher: update on selection change (via action)
	--------------------------------------------- */
	async function handleVoucherChange(status: VoucherStatus) {
		voucherStatus = status;
		if (!status) return;

		const fd = new FormData();
		fd.append('voucher_status', status);

		try {
			const res = await fetch('?/updateVoucher', {
				method: 'POST',
				body: fd,
				headers: {
					Accept: 'application/json'
				}
			});

			let out: any = null;
			try {
				out = await res.json();
			} catch {
				// ignore JSON parse errors; not critical
			}

			if (!res.ok) {
				console.error('Voucher update failed:', res.status, out);
				alert(out?.message ?? 'Failed to update voucher status');
				return;
			}

			// Success (type: 'success', status: 200, etc.)
			visit = {
				...visit,
				voucher_given: status === 'given' ? true : status === 'not_given' ? false : null
			};
		} catch (err) {
			console.error('Voucher update error:', err);
			alert('Failed to update voucher status');
		}
	}
</script>

<div class="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
	<div
		class="fixed top-0 left-0 right-0 h-64 bg-gradient-to-b from-white to-slate-50 -z-10 pointer-events-none"
	></div>

	<div class="max-w-2xl mx-auto pt-10 px-6">
		<VisitHeader {participant} {visit} />

		<div class="space-y-8">
			<!-- OPD Scheduling (Visit 5) -->
			<section in:fly={{ y: 20, delay: 80, duration: 600 }}>
				<div class="flex items-center gap-2 mb-3 px-2">
					<Calendar class="w-4 h-4 text-amber-600" />
					<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
						OPD Scheduling (Visit 5)
					</h3>
				</div>

				<div
					class="bg-amber-50/60 rounded-2xl border border-amber-200 p-2 flex items-center shadow-sm"
				>
					<form
						method="POST"
						action="?/update"
						class="flex-1 flex flex-col sm:flex-row gap-2 w-full"
					>
						<div class="relative flex-1 group">
							<select
								name="scheduled_on"
								bind:value={scheduledOn}
								class="w-full appearance-none bg-white border border-amber-100 focus:border-amber-400 focus:ring-amber-200 rounded-xl py-3 pl-4 pr-10 text-sm font-medium text-slate-800 transition-all cursor-pointer hover:border-amber-300"
							>
								<option value="" disabled>Select OPD Date</option>
								{#each opdOptions as opt}
									<option value={opt}>{formatDatePretty(opt)}</option>
								{/each}
							</select>
							<ChevronDown
								class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none group-hover:text-amber-600 transition-colors"
							/>
						</div>

						<button
							type="submit"
							disabled={!scheduledOn}
							class="bg-amber-600 text-white px-8 py-3 rounded-xl text-sm font-bold tracking-wide hover:bg-amber-700 active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-amber-600 transition-all shadow-lg shadow-amber-200"
						>
							Save Date
						</button>
					</form>
				</div>
			</section>

			<!-- Voucher Selection (Visit 5) -->
			<section in:fly={{ y: 20, delay: 140, duration: 600 }} class="mt-4">
				<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500 px-2 mb-3">
					Voucher
				</h3>

				<div class="space-y-3">
					<!-- Voucher Given -->
					<label
						class="flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border transition shadow-sm
							{voucherStatus === 'given'
							? 'bg-emerald-200 border-emerald-600 text-emerald-900'
							: 'bg-white border-slate-300 text-slate-700 hover:bg-emerald-50'}"
					>
						<input
							type="radio"
							name="voucher_status"
							value="given"
							checked={voucherStatus === 'given'}
							onchange={() => handleVoucherChange('given')}
							class="h-4 w-4 text-emerald-700"
						/>
						<span class="font-medium">Voucher given</span>
					</label>

					<!-- Voucher Not Given -->
					<label
						class="flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border transition shadow-sm
						{voucherStatus === 'not_given'
							? 'bg-rose-200 border-rose-600 text-rose-900'
							: 'bg-white border-slate-300 text-slate-700 hover:bg-rose-50'}"
					>
						<input
							type="radio"
							name="voucher_status"
							value="not_given"
							checked={voucherStatus === 'not_given'}
							onchange={() => handleVoucherChange('not_given')}
							class="h-4 w-4 text-rose-700"
						/>
						<span class="font-medium">Voucher not given</span>
					</label>
				</div>
			</section>

			<!-- Safety upload & extracted values (Visit 5) -->
			<VisitSafetyLabs
				bind:visit
				{participant}
				visionEndpoint="/apis/visits/vision/safety"
				sectionTitle="Visit 5 – Safety Labs"
				sectionSubtitle="Blood investigations (Hb, CBC, LFT, RFT, Lipids)"
			/>

			<!-- VISIT 5 CONCLUSION -->
			<section in:fly={{ y: 20, delay: 260, duration: 600 }}>
				{#if visit.visit_date}
					<div
						class="mt-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 p-4 flex items-center gap-3"
					>
						<div class="bg-emerald-100 text-emerald-700 p-2 rounded-full">
							<CheckCircle2 class="w-5 h-5" />
						</div>
						<div class="flex flex-col">
							<span class="text-xs font-bold text-slate-500 uppercase tracking-wide">
								Visit 5 status
							</span>
							<span class="text-sm font-semibold text-emerald-800">
								Completed on {formatDatePretty(visit.visit_date)}
							</span>
							{#if visit.voucher_given !== null}
								<span class="text-xs text-slate-600 mt-1">
									Voucher:
									<span class="font-semibold">
										{visit.voucher_given ? 'Given' : 'Not given'}
									</span>
								</span>
							{/if}
						</div>
					</div>
				{:else}
					<form
						method="POST"
						action="?/conclude"
						class="mt-4 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-2"
					>
						<div class="flex items-center gap-2 mb-1">
							<CheckCircle2 class="w-4 h-4 text-slate-700" />
							<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
								Visit 5 conclusion
							</h3>
						</div>
						<p class="text-xs text-slate-500">
							Clicking the button will mark Visit 5 as completed (using today’s date), and
							automatically create Visit 6 with the appropriate schedule window based on the
							protocol. Voucher status must be selected before concluding.
						</p>
						<button
							type="submit"
							disabled={!voucherStatus}
							class="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-950 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-500 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
						>
							<CheckCircle2 class="w-4 h-4" />
							<span>Mark Visit 5 completed &amp; create Visit 6</span>
						</button>
					</form>
				{/if}
			</section>
		</div>
	</div>
</div>
