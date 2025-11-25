<!-- src/routes/screening/+page.svelte -->
<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { goto } from '$app/navigation';

	let c1 = $state(false);
	let c2 = $state(false);
	let showConfirmation = $state(false);

	const canGenerate = $derived(c1 && c2);

	let loading = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	// Step 1: User clicks button, open dialog
	function handleInitialClick() {
		if (!canGenerate || loading) return;
		showConfirmation = true;
	}

	// Step 2: User confirms in dialog, execute logic
	async function handleConfirmGenerate() {
		if (!canGenerate || loading) return;

		loading = true;
		errorMessage = null;
		successMessage = null;

		try {
			// 1️⃣ Create participant with next screening_id
			const participantRes = await fetch('/apis/participants/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!participantRes.ok) {
				const body = await participantRes.json().catch(() => null);
				throw new Error(body?.error ?? 'Failed to create participant');
			}

			const { participant } = await participantRes.json();
			if (!participant?.id) {
				throw new Error('Participant creation response is missing id');
			}

			// 2️⃣ Create Visit 1 for this participant
			// 2️⃣ Create Visit 1 using the new unified API
			const visitRes = await fetch('/apis/visits/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					participantId: participant.id,
					visitNumber: 1
				})
			});

			if (!visitRes.ok) {
				const body = await visitRes.json().catch(() => null);
				throw new Error(body?.error ?? 'Failed to create Visit 1');
			}

			const { visit } = await visitRes.json();

			const screeningLabel =
				participant.screening_id ?? participant.screeningId ?? 'new participant';

			// Optional: keep this for console debugging
			console.log('Created participant & visit:', { participant, visit });

			// ✅ Navigate straight to participant details page
			await goto(`/participants/${participant.id}`);
		} catch (err) {
			console.error('Error generating screening ID:', err);
			errorMessage =
				err instanceof Error ? err.message : 'Something went wrong while generating Screening ID.';
		} finally {
			loading = false;
			showConfirmation = false;
			c1 = false;
			c2 = false;
		}
	}

	function handleCancel() {
		if (loading) return;
		showConfirmation = false;
	}
</script>

<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800 relative">
	<div class="max-w-lg mx-auto relative z-0">
		<div
			class="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-gray-100"
		>
			<div class="px-8 pt-10 pb-4">
				<h1 class="text-2xl font-light text-emerald-900">Patient Eligibility</h1>
				<p class="text-sm text-gray-500 mt-2">Confirm inclusion criteria to proceed.</p>
			</div>

			<div class="p-8 space-y-6">
				<div class="space-y-4">
					<label
						class="flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all duration-200 group select-none
                        {c1
							? 'bg-emerald-50/50 border-emerald-200 shadow-sm'
							: 'bg-white border-gray-100 hover:border-emerald-200 hover:bg-gray-50'}"
					>
						<div class="pt-0.5">
							<input
								type="checkbox"
								bind:checked={c1}
								class="w-5 h-5 accent-emerald-600 cursor-pointer"
								disabled={loading}
							/>
						</div>
						<span
							class="text-[15px] font-medium text-slate-700 leading-relaxed group-hover:text-emerald-900 transition-colors"
						>
							LVEF &lt; 40% documented within the last 2 weeks.
						</span>
					</label>

					<label
						class="flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all duration-200 group select-none
                        {c2
							? 'bg-emerald-50/50 border-emerald-200 shadow-sm'
							: 'bg-white border-gray-100 hover:border-emerald-200 hover:bg-gray-50'}"
					>
						<div class="pt-0.5">
							<input
								type="checkbox"
								bind:checked={c2}
								class="w-5 h-5 accent-emerald-600 cursor-pointer"
								disabled={loading}
							/>
						</div>
						<span
							class="text-[15px] font-medium text-slate-700 leading-relaxed group-hover:text-emerald-900 transition-colors"
						>
							No hospitalization for MI, Stroke, CABG (planned or done), or worsening HF in the last
							4 weeks.
						</span>
					</label>
				</div>

				<button
					class="w-full py-4 rounded-xl text-sm font-bold tracking-wide shadow-lg transition-all duration-300 ease-out
                    {canGenerate && !loading
						? 'bg-emerald-700 text-white shadow-emerald-900/20 hover:bg-emerald-800 hover:shadow-emerald-900/30 hover:-translate-y-0.5'
						: 'bg-gray-100 text-gray-400 shadow-none cursor-not-allowed'}"
					disabled={!canGenerate || loading}
					onclick={handleInitialClick}
				>
					{#if loading}
						<span class="inline-flex items-center justify-center gap-2">
							<span
								class="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
							/>
							Generating...
						</span>
					{:else}
						GENERATE SCREENING ID
					{/if}
				</button>

				{#if errorMessage}
					<p class="text-sm text-red-600 text-center">{errorMessage}</p>
				{/if}

				{#if successMessage}
					<p class="text-sm text-emerald-700 text-center font-medium">{successMessage}</p>
				{/if}
			</div>
		</div>

		<div class="text-center mt-8">
			<a
				href="/"
				class="text-sm font-medium text-gray-400 hover:text-emerald-700 transition-colors"
			>
				← Back to Dashboard
			</a>
		</div>
	</div>

	{#if showConfirmation}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
			transition:fade={{ duration: 200 }}
		>
			<div class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onclick={handleCancel}></div>

			<div
				class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100"
				transition:scale={{ start: 0.95, duration: 200 }}
			>
				<div class="flex flex-col items-center text-center">
					<div
						class="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-4"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="w-6 h-6"
						>
							<path
								fill-rule="evenodd"
								d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>

					<h3 class="text-lg font-semibold text-slate-900 mb-2">Are you sure?</h3>

					<p class="text-sm text-slate-600 mb-8 leading-relaxed">
						Warning: Do not generate ID if eligibility criteria are not met. Are you sure you want
						to generate ID?
					</p>

					<div class="flex gap-3 w-full">
						<button
							class="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
							onclick={handleCancel}
							disabled={loading}
						>
							Cancel
						</button>
						<button
							class="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
							onclick={handleConfirmGenerate}
							disabled={loading}
						>
							Yes, Generate
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
