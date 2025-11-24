<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { fly } from 'svelte/transition';

	let file: File | null = null;
	let uploading = false;
	let message = '';

	async function handleUpload() {
		message = '';

		if (!file) {
			message = 'Please select a file first.';
			return;
		}

		uploading = true;

		try {
			// 1) Request presigned R2 upload URL
			const presignRes = await fetch('/apis/r2/presign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					visitId: 'demo-visit',
					field: 'lab-report',
					filename: file.name
				})
			});

			if (!presignRes.ok) throw new Error('Presign failed');

			const { ok, url, objectKey } = await presignRes.json();

			if (!ok || !url || !objectKey) throw new Error('Invalid presign payload');

			// 2) Upload to R2
			const uploadRes = await fetch(url, { method: 'PUT', body: file });
			if (!uploadRes.ok) throw new Error('R2 upload failed');

			// 3) Insert row into supabase
			const { data: inserted, error } = await supabase
				.from('lab_reports')
				.insert({
					src: objectKey,
					homocysteine: null,
					tsh: null,
					bnp: null
				})
				.select()
				.single();

			if (error) throw new Error(error.message);

			message = 'Analysis started. Processing in background.';

			// 4) Fire-and-forget Gemini processing
			if (inserted?.id) {
				fetch('/apis/lab_reports/process', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: inserted.id })
				});
			}

			// reset file input
			file = null;
			const input = document.getElementById('file-input') as HTMLInputElement;
			if (input) input.value = '';
		} catch (err: any) {
			message = `Error: ${err.message}`;
		} finally {
			uploading = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
	<div class="max-w-lg mx-auto">
		<div
			class="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-gray-100"
		>
			<div class="px-8 pt-10 pb-6">
				<h1 class="text-3xl font-light tracking-tight text-emerald-900 mb-2">SAM-CHF</h1>
				<p class="text-sm text-gray-500 leading-relaxed">
					Upload patient lab reports for automated extraction of Homocysteine, TSH, and BNP via
					Gemini AI.
				</p>
			</div>

			<div class="px-8 pb-8">
				<div class="space-y-6">
					<div class="relative group">
						<input
							id="file-input"
							type="file"
							accept=".pdf,.jpg,.png"
							class="block w-full text-sm text-gray-500
                                file:mr-4 file:py-3 file:px-6
                                file:rounded-full file:border-0
                                file:text-sm file:font-medium
                                file:bg-emerald-50 file:text-emerald-700
                                hover:file:bg-emerald-100
                                file:transition file:duration-200
                                file:cursor-pointer cursor-pointer
                                focus:outline-none"
							on:change={(e) => {
								const target = e.currentTarget as HTMLInputElement;
								file = target.files?.[0] ?? null;
								message = '';
							}}
						/>
					</div>

					<button
						type="button"
						on:click={handleUpload}
						disabled={uploading || !file}
						class="w-full py-3.5 px-4 rounded-xl text-emerald-900 text-sm font-medium border border-emerald-100 bg-emerald-50
                               transition-all duration-200 ease-in-out
                               hover:bg-emerald-100 hover:border-emerald-200
                               disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
					>
						{uploading ? 'Processing Report...' : 'Upload & Analyze'}
					</button>
				</div>

				{#if message}
					<div
						in:fly={{ y: 10, duration: 300 }}
						class="mt-6 p-4 rounded-xl text-sm border flex items-start gap-3
                        {message.startsWith('Error')
							? 'bg-red-50 text-red-700 border-red-100'
							: 'bg-emerald-50 text-emerald-800 border-emerald-100'}"
					>
						<span class="text-lg leading-none mt-0.5">
							{message.startsWith('Error') ? '✕' : '✓'}
						</span>
						<p class="font-medium">{message}</p>
					</div>
				{/if}
			</div>

			<div class="bg-gray-50 px-8 py-6 border-t border-gray-100">
				<div class="grid grid-cols-2 gap-4">
					<a
						href="/leads"
						class="flex items-center justify-center px-4 py-3 rounded-xl bg-white border border-gray-200
                               text-gray-600 text-sm font-medium transition-all hover:border-emerald-300 hover:text-emerald-700 hover:shadow-sm"
					>
						View Leads
					</a>
					<a
						href="/screening"
						class="flex items-center justify-center px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg shadow-emerald-600/20
                               bg-emerald-600 transition-all duration-200 hover:bg-emerald-700 hover:shadow-emerald-600/30 hover:-translate-y-0.5"
					>
						+ New screening
					</a>
				</div>
			</div>
		</div>

		<p class="text-center text-xs text-gray-400 mt-8">Secure R2 Storage • Gemini Processing</p>
	</div>
</div>
