<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { supabase } from '$lib/supabaseClient';

	let file: File | null = null;
	let uploading = false;
	let message = '';

	async function handleUpload() {
		message = '';

		if (!file) {
			message = 'Please choose a file first.';
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

			message =
				'✅ Uploaded to R2 and inserted in lab_reports.\nBackground Gemini processing started.';

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
			message = `❌ Error: ${err.message}`;
		} finally {
			uploading = false;
		}
	}
</script>

<main class="max-w-2xl mx-auto mt-12 p-6 rounded-2xl border border-emerald-200 bg-white shadow-md">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-semibold text-emerald-800">SAM-CHF Tools</h1>
			<p class="text-sm text-gray-600 mt-1">Upload lab reports and manage trial leads.</p>
		</div>

		<!-- Leads Button -->
		<a
			href="/leads"
			class="px-4 py-2 rounded-full border border-emerald-400 text-emerald-700 bg-emerald-50 text-sm font-medium hover:bg-emerald-100 transition"
		>
			Leads
		</a>
	</div>

	<!-- Uploader Card -->
	<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
		<h2 class="text-emerald-700 text-lg font-semibold mb-1">R2 + Gemini Lab Report Uploader</h2>
		<p class="text-emerald-700 text-sm">
			Upload a lab report. R2 stores it and Gemini extracts <strong>Homocysteine</strong>,
			<strong>TSH</strong>, <strong>BNP</strong>.
		</p>
	</div>

	<!-- File Input -->
	<div class="flex flex-col gap-3">
		<input
			id="file-input"
			type="file"
			class="border rounded-lg px-3 py-2 text-sm"
			on:change={(e) => {
				const target = e.currentTarget as HTMLInputElement;
				file = target.files?.[0] ?? null;
				message = '';
			}}
		/>

		<div class="flex gap-3 flex-wrap">
			<!-- Upload Button -->
			<button
				type="button"
				on:click={handleUpload}
				disabled={uploading}
				class="px-5 py-2.5 rounded-full text-white font-medium text-sm shadow-md transition
				       bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300"
			>
				{uploading ? 'Uploading…' : 'Upload report'}
			</button>

			<!-- Leads Button -->
			<a
				href="/leads"
				class="px-5 py-2.5 rounded-full border border-emerald-300 text-emerald-700 bg-white text-sm font-medium hover:bg-emerald-50 transition"
			>
				Go to Leads
			</a>
		</div>
	</div>

	<!-- Message -->
	{#if message}
		<p
			class="mt-4 text-sm whitespace-pre-wrap px-3 py-2 rounded-lg border"
			class:bg-red-50={message.startsWith('❌')}
			class:text-red-700={message.startsWith('❌')}
			class:border-red-200={message.startsWith('❌')}
			class:bg-emerald-50={!message.startsWith('❌')}
			class:text-emerald-800={!message.startsWith('❌')}
			class:border-emerald-200={!message.startsWith('❌')}
		>
			{message}
		</p>
	{/if}
</main>
