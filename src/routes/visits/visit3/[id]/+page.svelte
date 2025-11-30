<!-- src/routes/visits/visit3/[id]/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';
	import {
		Calendar,
		FileText,
		CloudUpload,
		Printer,
		RefreshCcw,
		CheckCircle2,
		ChevronDown,
		ExternalLink,
		Loader
	} from '@lucide/svelte';
	import jsPDF from 'jspdf';
	import { fly } from 'svelte/transition';
	import VisitHeader from '$lib/components/visits/VisitHeader.svelte';

	let { data }: PageProps = $props();
	let visit = $state(data.visit);
	let participant = $state(data.participant);
	let opdOptions = $state<string[]>(data.opdOptions ?? []);

	let scheduledOn = $state<string>(visit.scheduled_on ?? '');

	let uploading = $state({
		efficacy: false
	});

	type ExtractionDialog = {
		title: string;
		fields: { label: string; value: string | number | null }[];
	};

	let extractionDialog: ExtractionDialog | null = $state(null);

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

	function closeExtractionDialog() {
		extractionDialog = null;
	}

	function handleChange(setter: (f: File[]) => void, evt: Event) {
		const target = evt.target as HTMLInputElement;
		if (target.files) setter(Array.from(target.files));
	}

	function printUrl(e: Event, url: string | null) {
		e.preventDefault();
		e.stopPropagation();
		if (!url) return;
		const win = window.open(url, '_blank');
		if (!win) return;
		win.onload = () => win.print();
	}

	function r2PublicUrl(key: string | null) {
		if (!key) return null;
		return `https://pub-4cd2e47347704d5dab6e20a0bbd4b079.r2.dev/${key}`;
	}

	/* --------------------------------------------
	   PDF & File Logic
	--------------------------------------------- */
	function fileToDataURL(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	function loadImage(src: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = reject;
			img.src = src;
		});
	}

	function isImageFile(file: File): boolean {
		return file.type.startsWith('image/');
	}

	async function convertFilesToSinglePdf(files: File[], labelText?: string): Promise<File> {
		if (!files || files.length === 0) throw new Error('No files to convert');

		const imageFiles = files.filter(isImageFile);
		if (imageFiles.length === 0) return files[0];

		const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
		const pageWidth = pdf.internal.pageSize.getWidth();
		const pageHeight = pdf.internal.pageSize.getHeight();
		const topMargin = 32;
		const bottomMargin = 16;
		const availableHeight = pageHeight - topMargin - bottomMargin;

		for (let i = 0; i < imageFiles.length; i++) {
			const imgFile = imageFiles[i];
			const dataUrl = await fileToDataURL(imgFile);
			const img = await loadImage(dataUrl);

			const imgW = img.naturalWidth || img.width;
			const imgH = img.naturalHeight || img.height;

			const scale = Math.min(pageWidth / imgW, availableHeight / imgH);
			const finalW = imgW * scale;
			const finalH = imgH * scale;

			const x = (pageWidth - finalW) / 2;
			const y = topMargin + (availableHeight - finalH) / 2;

			if (i > 0) pdf.addPage();

			if (labelText) {
				pdf.setTextColor(255, 0, 0);
				pdf.setFontSize(14);
				const textWidth = pdf.getTextWidth(labelText);
				pdf.text(labelText, pageWidth - textWidth - 20, 24);
			}

			pdf.addImage(dataUrl, imgFile.type === 'image/png' ? 'PNG' : 'JPEG', x, y, finalW, finalH);
		}

		const baseName = (imageFiles[0]?.name ?? files[0].name).replace(/\.\w+$/, '');
		return new File([pdf.output('blob')], `${baseName}.pdf`, { type: 'application/pdf' });
	}

	/* --------------------------------------------
	   R2 Upload
	--------------------------------------------- */
	async function uploadToR2(field: 'efficacy', file: File) {
		try {
			const presignRes = await fetch('/apis/r2/presign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ visitId: visit.id, field, filename: file.name })
			});

			const presigned = await presignRes.json();
			if (!presigned.ok) throw new Error('Failed to get presign URL');

			const { url, objectKey } = presigned;
			const up = await fetch(url, { method: 'PUT', body: file });
			if (!up.ok) throw new Error('Upload to R2 failed');

			const saveRes = await fetch('/apis/visits/visit1/upload', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ visitId: visit.id, field, objectKey })
			});

			const saved = await saveRes.json();
			if (!saved.ok) throw new Error('Failed saving key to DB');

			if (field === 'efficacy') visit.efficacy_src = objectKey;
		} catch (err: any) {
			alert(err.message || 'Upload failed');
			throw err;
		}
	}

	/* --------------------------------------------
	   Visit 3 Efficacy Upload & Extraction
	--------------------------------------------- */
	let efficacyFiles: File[] = $state([]);

	async function uploadEfficacy(files: File[]) {
		if (!files.length) return;
		uploading.efficacy = true;

		try {
			let finalFile: File;

			if (files.length === 1 && files[0].type === 'application/pdf') {
				finalFile = files[0];
			} else {
				const init = participant.initials?.trim() ?? '';
				const scrId = participant.screening_id ?? '';
				const vNum = 'V3';
				const labelText = [init, scrId, vNum].filter(Boolean).join(' ');
				finalFile = await convertFilesToSinglePdf(files, labelText);
			}

			// 1) Gemini extraction for Visit 3 markers (same as Visit 2 + homocysteine)
			const fd = new FormData();
			fd.append('visitId', visit.id);
			fd.append('field', 'efficacy');
			fd.append('file', finalFile);

			try {
				const res = await fetch('/apis/visits/visit3/vision/efficacy', {
					method: 'POST',
					body: fd
				});

				const out = await res.json();

				if (!out.ok) {
					console.warn('Visit 3 efficacy extraction failed:', out.error);
				} else {
					console.log('Visit 3 efficacy extraction success:', out.updated);
					extractionDialog = {
						title: 'Visit 3 efficacy markers extracted',
						fields: [
							{ label: 'GSH', value: out.updated?.gsh ?? null },
							{ label: 'TNF-α', value: out.updated?.tnf_alpha ?? null },
							{ label: 'IL-6', value: out.updated?.il6 ?? null },
							{ label: 'S-adenosylmethionine (SAME)', value: out.updated?.same ?? null },
							{ label: 'S-adenosylhomocysteine (SAH)', value: out.updated?.sah ?? null },
							{
								label: '5-methylcytosine (5mC)',
								value: out.updated?.five_methylcytosine ?? null
							},
							{
								label: 'Serum homocysteine',
								value: out.updated?.serum_homocysteine ?? null
							}
						]
					};

					if (out.updated) {
						visit = {
							...visit,
							...out.updated
						};
					}
				}
			} catch (err) {
				console.error('Visit 3 efficacy vision endpoint error:', err);
			}

			// 2) Upload to R2 and save efficacy_src
			await uploadToR2('efficacy', finalFile);

			// 3) Clear local selection
			efficacyFiles = [];
		} catch (e) {
			console.error(e);
		} finally {
			uploading.efficacy = false;
		}
	}

	let efficacyPublicUrl = $derived(r2PublicUrl(visit.efficacy_src));
</script>

<div class="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
	<div
		class="fixed top-0 left-0 right-0 h-64 bg-gradient-to-b from-white to-slate-50 -z-10 pointer-events-none"
	></div>

	<div class="max-w-2xl mx-auto pt-10 px-6">
		<VisitHeader {participant} {visit} />

		<div class="space-y-8">
			<!-- OPD Scheduling (Visit 3) -->
			<section in:fly={{ y: 20, delay: 100, duration: 600 }}>
				<div class="flex items-center gap-2 mb-3 px-2">
					<Calendar class="w-4 h-4 text-amber-600" />
					<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
						OPD Scheduling (Visit 3)
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

			<!-- Efficacy upload & extracted values (Visit 3 markers) -->
			<section in:fly={{ y: 20, delay: 180, duration: 600 }}>
				<div class="flex items-center gap-2 mb-3 px-2">
					<FileText class="w-4 h-4 text-emerald-600" />
					<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
						Visit 3 – Efficacy Markers
					</h3>
				</div>

				<div
					class="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden"
				>
					<div class="flex items-center justify-between mb-3 relative z-10">
						<h4 class="text-sm font-semibold text-slate-700">
							Efficacy report (GSH, TNF-α, IL-6, SAME, SAH, 5mC, Homocysteine)
						</h4>

						{#if uploading.efficacy}
							<span
								class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"
							>
								Processing...
							</span>
						{:else if visit.efficacy_src}
							<span
								class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1"
							>
								<CheckCircle2 class="w-3 h-3" /> Uploaded
							</span>
						{:else}
							<span
								class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full"
								>Pending</span
							>
						{/if}
					</div>

					{#if uploading.efficacy}
						<div
							class="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-col items-center justify-center gap-3"
						>
							<Loader class="w-6 h-6 text-emerald-600 animate-spin" />
							<span class="text-xs text-slate-500 font-medium">
								Analyzing report & uploading…
							</span>
						</div>
					{:else if efficacyPublicUrl && efficacyFiles.length === 0}
						<!-- Already uploaded -->
						<div
							class="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100 group-hover:border-emerald-200 transition-colors"
						>
							<a
								href={efficacyPublicUrl}
								target="_blank"
								class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
								title="Click to view report"
							>
								<div
									class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"
								>
									<FileText class="w-5 h-5 text-emerald-600" />
								</div>
								<div class="flex flex-col min-w-0">
									<div class="flex items-center gap-1 text-sm font-medium text-slate-900">
										<span>View report</span>
										<ExternalLink
											class="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
										/>
									</div>
									<span class="text-xs text-slate-400 truncate"> PDF • Click to open </span>
								</div>
							</a>
							<div class="flex items-center gap-1 pl-3 border-l border-slate-200 ml-3">
								<button
									onclick={(e) => printUrl(e, efficacyPublicUrl)}
									class="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
									title="Print"
								>
									<Printer class="w-4 h-4" />
								</button>
								<button
									onclick={() => document.getElementById('efficacy-input')?.click()}
									class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-colors"
								>
									<RefreshCcw class="w-4 h-4" />
								</button>
							</div>
						</div>
						<input
							id="efficacy-input"
							type="file"
							class="hidden"
							accept="image/*,.pdf"
							multiple
							onchange={(e) =>
								handleChange((files) => {
									efficacyFiles = files;
								}, e)}
						/>
					{:else if efficacyFiles.length > 0}
						<!-- Files selected -->
						<div class="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
							<div class="flex items-center gap-3 mb-4">
								<div
									class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"
								>
									<span class="text-sm font-bold text-emerald-700">
										{efficacyFiles.length}
									</span>
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium text-slate-900 truncate">
										{efficacyFiles.length === 1 ? efficacyFiles[0].name : 'Files ready to merge'}
									</p>
									<p class="text-xs text-slate-500">Ready to convert & upload</p>
								</div>
								<button
									onclick={() => {
										efficacyFiles = [];
									}}
									class="p-2 text-slate-400 hover:text-rose-500 transition-colors"
								>
									✕
								</button>
							</div>
							<button
								type="button"
								class="w-full bg-emerald-600 text-white font-semibold text-sm py-3 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
								onclick={() => uploadEfficacy(efficacyFiles)}
							>
								<CloudUpload class="w-4 h-4" />
								Upload &amp; Analyze
							</button>
						</div>
					{:else}
						<!-- No file yet -->
						<label
							class="group/label flex items-center justify-center gap-3 w-full border border-dashed border-slate-300 rounded-xl py-6 px-4 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/10 transition-all duration-300"
						>
							<div
								class="p-2 bg-slate-50 rounded-full group-hover/label:bg-emerald-100 transition-colors"
							>
								<CloudUpload class="w-5 h-5 text-slate-400 group-hover/label:text-emerald-600" />
							</div>
							<span class="text-sm text-slate-500 font-medium group-hover/label:text-emerald-700"
								>Tap to select combined report</span
							>
							<input
								type="file"
								class="hidden"
								accept="image/*,.pdf"
								multiple
								onchange={(e) =>
									handleChange((files) => {
										efficacyFiles = files;
									}, e)}
							/>
						</label>
					{/if}
				</div>

				<!-- Stored values -->
				{#if visit.gsh != null || visit.tnf_alpha != null || visit.il6 != null || visit.same != null || visit.sah != null || visit.five_methylcytosine != null || visit.serum_homocysteine != null}
					<div class="mt-4 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
						<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
							Stored values
						</p>
						<div class="space-y-1 text-xs text-slate-700">
							{#if visit.gsh != null}
								<div class="flex justify-between">
									<span>GSH</span>
									<span class="font-semibold">{visit.gsh}</span>
								</div>
							{/if}
							{#if visit.tnf_alpha != null}
								<div class="flex justify-between">
									<span>TNF-α</span>
									<span class="font-semibold">{visit.tnf_alpha}</span>
								</div>
							{/if}
							{#if visit.il6 != null}
								<div class="flex justify-between">
									<span>IL-6</span>
									<span class="font-semibold">{visit.il6}</span>
								</div>
							{/if}
							{#if visit.same != null}
								<div class="flex justify-between">
									<span>S-adenosylmethionine (SAME)</span>
									<span class="font-semibold">{visit.same}</span>
								</div>
							{/if}
							{#if visit.sah != null}
								<div class="flex justify-between">
									<span>S-adenosylhomocysteine (SAH)</span>
									<span class="font-semibold">{visit.sah}</span>
								</div>
							{/if}
							{#if visit.five_methylcytosine != null}
								<div class="flex justify-between">
									<span>5-methylcytosine (5mC)</span>
									<span class="font-semibold">{visit.five_methylcytosine}</span>
								</div>
							{/if}
							{#if visit.serum_homocysteine != null}
								<div class="flex justify-between">
									<span>Serum homocysteine</span>
									<span class="font-semibold">{visit.serum_homocysteine}</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</section>

			<!-- VISIT CONCLUSION FOR VISIT 3 -->
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
								Visit 3 status
							</span>
							<span class="text-sm font-semibold text-emerald-800">
								Completed on {formatDatePretty(visit.visit_date)}
							</span>
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
								Visit conclusion
							</h3>
						</div>
						<p class="text-xs text-slate-500">
							Clicking the button will mark Visit 3 as completed (using today’s date) and
							automatically create Visit 4 with the appropriate schedule window based on the
							protocol.
						</p>
						<button
							type="submit"
							class="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-950 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-500 active:scale-[0.98] transition-all"
						>
							<CheckCircle2 class="w-4 h-4" />
							<span>Mark Visit 3 completed &amp; create Visit 4</span>
						</button>
					</form>
				{/if}
			</section>
		</div>
	</div>

	{#if extractionDialog}
		<div
			class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
			role="dialog"
			aria-modal="true"
			onclick={closeExtractionDialog}
		>
			<div
				class="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-5 space-y-4"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="flex items-start justify-between gap-3">
					<div>
						<h2 class="text-sm font-semibold text-slate-900">
							{extractionDialog.title}
						</h2>
						<p class="text-xs text-slate-500 mt-1">
							These values were extracted automatically using AI and added to the database.
						</p>
					</div>
					<button
						type="button"
						class="text-slate-400 hover:text-slate-600 text-xs"
						onclick={closeExtractionDialog}
					>
						✕
					</button>
				</div>

				<div class="max-h-56 overflow-y-auto space-y-1">
					{#each extractionDialog.fields as field (field.label)}
						{#if field.value !== null}
							<div class="flex items-center justify-between text-xs">
								<span class="text-slate-500">{field.label}</span>
								<span class="font-semibold text-slate-900">{field.value}</span>
							</div>
						{/if}
					{/each}
				</div>

				<div class="flex justify-end">
					<button
						type="button"
						class="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-900 text-white hover:bg-ску"
						onclick={closeExtractionDialog}
					>
						Close
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
