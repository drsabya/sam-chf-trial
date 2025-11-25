<!-- src/routes/visits/visit1/[id]/+page.svelte -->
<script lang="ts">
	/* --------------------------------------------
       Imports
    --------------------------------------------- */
	import type { PageProps } from './$types';
	import {
		Calendar,
		FileText,
		CloudUpload,
		Printer,
		RefreshCcw,
		CheckCircle2,
		Clock,
		ChevronDown,
		Loader2,
		ExternalLink,
		AlertCircle,
		Loader,
		AlertOctagon
	} from '@lucide/svelte';
	import jsPDF from 'jspdf';
	import { fly } from 'svelte/transition';
	import VisitHeader from '$lib/components/visits/VisitHeader.svelte';

	let { data }: PageProps = $props();
	let visit = $state(data.visit);
	let participant = $state(data.participant);
	let opdOptions = $state<string[]>(data.opdOptions ?? []);

	let scheduledOn = $state<string>(visit.scheduled_on ?? '');
	let visitDate = $state<string>(visit.visit_date ?? '');

	// Track loading state
	let uploading = $state({
		ecg: false,
		echo: false,
		efficacy: false,
		safety: false
	});

	// --- New visit conclusion state ---
	type VoucherStatus = '' | 'given' | 'not_given';
	type ScreeningOutcome = '' | 'failure' | 'success';

	let voucherStatus = $state<VoucherStatus>('');
	let screeningOutcome = $state<ScreeningOutcome>('');

	const concludeButtonColorClass = $derived(
		screeningOutcome === 'failure'
			? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500'
			: screeningOutcome === 'success'
				? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
				: 'bg-slate-900 hover:bg-slate-950 focus:ring-slate-500'
	);

	const hasRandomizationId = $derived(Boolean(participant.randomization_id));

	const concludeLabel = $derived(
		hasRandomizationId
			? 'Save'
			: screeningOutcome === 'failure'
				? 'Declaring screening failure'
				: screeningOutcome === 'success'
					? 'Randomize'
					: 'Conclude visit'
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
       R2 Upload Logic
    --------------------------------------------- */
	async function uploadToR2(field: 'ecg' | 'echo' | 'efficacy' | 'safety', file: File) {
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

			if (field === 'ecg') visit.ecg_src = objectKey;
			if (field === 'echo') visit.echo_src = objectKey;
			if (field === 'efficacy') visit.efficacy_src = objectKey;
			if (field === 'safety') visit.safety_src = objectKey;
		} catch (err: any) {
			alert(err.message || 'Upload failed');
			throw err;
		}
	}

	/* --------------------------------------------
        State & Handlers
    --------------------------------------------- */
	let ecgFiles: File[] = $state([]);
	let echoFiles: File[] = $state([]);
	let efficacyFiles: File[] = $state([]);
	let safetyFiles: File[] = $state([]);

	type ExtractionDialog = {
		title: string;
		fields: { label: string; value: string | number | null }[];
	};

	let extractionDialog: ExtractionDialog | null = $state(null);

	function closeExtractionDialog() {
		extractionDialog = null;
	}

	function handleChange(setter: (f: File[]) => void, evt: Event) {
		const target = evt.target as HTMLInputElement;
		if (target.files) setter(Array.from(target.files));
	}

	async function uploadField(field: 'ecg' | 'echo' | 'efficacy' | 'safety', files: File[]) {
		if (!files.length) return;
		uploading[field] = true;

		try {
			let finalFile: File;

			if (files.length === 1 && files[0].type === 'application/pdf') {
				finalFile = files[0];
			} else {
				const init = participant.initials?.trim() ?? '';
				const scrId = participant.screening_id ?? '';
				const vNum = `V${visit.visit_number ?? 1}`;
				const labelText = [init, scrId, vNum].filter(Boolean).join(' ');
				finalFile = await convertFilesToSinglePdf(files, labelText);
			}

			// --- Extract Echo LVEF BEFORE uploading ---
			if (field === 'echo') {
				const fd = new FormData();
				fd.append('visitId', visit.id);
				fd.append('field', 'echo');
				fd.append('file', finalFile);

				try {
					const res = await fetch('/apis/visits/visit1/vision/echo', {
						method: 'POST',
						body: fd
					});
					const out = await res.json();

					if (!out.ok) {
						console.warn('Echo extraction failed:', out.error);
					} else {
						console.log('Echo extraction success:', out.updated);
						extractionDialog = {
							title: 'Echo values extracted',
							fields: [
								{
									label: 'LVEF (%)',
									value: out.updated?.echo_lvef ?? null
								}
							]
						};
					}
				} catch (err) {
					console.error('Echo vision endpoint error:', err);
				}
			}

			// --- Extract Efficacy labs (BNP/TSH/Hcy) BEFORE uploading ---
			if (field === 'efficacy') {
				const fd = new FormData();
				fd.append('visitId', visit.id);
				fd.append('field', 'efficacy');
				fd.append('file', finalFile);

				try {
					const res = await fetch('/apis/visits/visit1/vision/efficacy', {
						method: 'POST',
						body: fd
					});
					const out = await res.json();

					if (!out.ok) {
						console.warn('Efficacy extraction failed:', out.error);
					} else {
						console.log('Efficacy extraction success:', out.updated);
						extractionDialog = {
							title: 'Efficacy labs extracted',
							fields: [
								{
									label: 'NT-proBNP',
									value: out.updated?.nt_pro_bnp ?? null
								},
								{
									label: 'TSH',
									value: out.updated?.serum_tsh ?? null
								},
								{
									label: 'Homocysteine',
									value: out.updated?.serum_homocysteine ?? null
								}
							]
						};
					}
				} catch (err) {
					console.error('Efficacy vision endpoint error:', err);
				}
			}

			// --- Extract Safety labs BEFORE uploading ---
			if (field === 'safety') {
				const fd = new FormData();
				fd.append('visitId', visit.id);
				fd.append('field', 'safety');
				fd.append('file', finalFile);

				try {
					const res = await fetch('/apis/visits/visit1/vision/safety', {
						method: 'POST',
						body: fd
					});
					const out = await res.json();

					if (!out.ok) {
						console.warn('Safety extraction failed:', out.error);
					} else {
						console.log('Safety extraction success:', out.updated);
						extractionDialog = {
							title: 'Safety labs extracted',
							fields: [
								{ label: 'Hb', value: out.updated?.hb ?? null },
								{ label: 'RBCs', value: out.updated?.rbcs ?? null },
								{ label: 'WBCs', value: out.updated?.wbcs ?? null },
								{ label: 'Polymorphs (%)', value: out.updated?.polymorphs ?? null },
								{ label: 'Lymphocytes (%)', value: out.updated?.lymphocytes ?? null },
								{ label: 'Monocytes (%)', value: out.updated?.monocytes ?? null },
								{ label: 'Platelets', value: out.updated?.platelets ?? null },
								{ label: 'SGOT / AST', value: out.updated?.sgot_ast ?? null },
								{ label: 'SGPT / ALT', value: out.updated?.sgpt_alt ?? null },
								{ label: 'Total bilirubin', value: out.updated?.bilirubin_total ?? null },
								{ label: 'Direct bilirubin', value: out.updated?.bilirubin_direct ?? null },
								{ label: 'Indirect bilirubin', value: out.updated?.bilirubin_indirect ?? null },
								{ label: 'BUN', value: out.updated?.bun ?? null },
								{ label: 'Serum creatinine', value: out.updated?.serum_creatinine ?? null },
								{ label: 'Total cholesterol', value: out.updated?.total_cholesterol ?? null },
								{ label: 'HDL', value: out.updated?.hdl ?? null },
								{ label: 'LDL', value: out.updated?.ldl ?? null },
								{ label: 'Triglycerides', value: out.updated?.triglycerides ?? null }
							]
						};
					}
				} catch (err) {
					console.error('Safety vision endpoint error:', err);
				}
			}

			// --- Upload final PDF to R2 (existing flow) ---
			await uploadToR2(field, finalFile);

			// Clear local file selections
			if (field === 'ecg') ecgFiles = [];
			if (field === 'echo') echoFiles = [];
			if (field === 'efficacy') efficacyFiles = [];
			if (field === 'safety') safetyFiles = [];
		} catch (e) {
			console.error(e);
		} finally {
			uploading[field] = false;
		}
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
</script>

<div class="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
	<div
		class="fixed top-0 left-0 right-0 h-64 bg-gradient-to-b from-white to-slate-50 -z-10 pointer-events-none"
	></div>

	<div class="max-w-2xl mx-auto pt-10 px-6">
		<VisitHeader {participant} {visit} />

		<div class="space-y-8">
			<section in:fly={{ y: 20, delay: 100, duration: 600 }}>
				<div class="flex items-center gap-2 mb-3 px-2">
					<Calendar class="w-4 h-4 text-amber-600" />
					<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">OPD Scheduling</h3>
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

			<section in:fly={{ y: 20, delay: 200, duration: 600 }}>
				<div class="flex items-center gap-2 mb-4 px-2">
					<FileText class="w-4 h-4 text-emerald-600" />
					<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">Clinical Data</h3>
				</div>

				<div class="grid grid-cols-1 gap-4">
					{#each [{ label: '12-lead ECG', field: 'ecg' as const, files: ecgFiles, src: visit.ecg_src }, { label: '2D Echo', field: 'echo' as const, files: echoFiles, src: visit.echo_src }, { label: 'Efficacy (BNP/TSH/Hcy)', field: 'efficacy' as const, files: efficacyFiles, src: visit.efficacy_src }, { label: 'Safety (Blood Inv.)', field: 'safety' as const, files: safetyFiles, src: visit.safety_src }] as item}
						{@const publicUrl = r2PublicUrl(item.src)}
						{@const isLoading = uploading[item.field]}

						<div
							class="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden"
						>
							<div class="flex items-center justify-between mb-3 relative z-10">
								<h4 class="text-sm font-semibold text-slate-700">{item.label}</h4>
								{#if isLoading}
									<span
										class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"
									>
										Processing...
									</span>
								{:else if item.src}
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

							{#if isLoading}
								<div
									class="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-col items-center justify-center gap-3"
								>
									<Loader class="w-6 h-6 text-emerald-600 animate-spin" />
									<span class="text-xs text-slate-500 font-medium">Analyzing and uploading...</span>
								</div>
							{:else if publicUrl && item.files.length === 0}
								<div
									class="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100 group-hover:border-emerald-200 transition-colors"
								>
									<a
										href={publicUrl}
										target="_blank"
										class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
										title="Click to view file"
									>
										<div
											class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"
										>
											<FileText class="w-5 h-5 text-emerald-600" />
										</div>
										<div class="flex flex-col min-w-0">
											<div class="flex items-center gap-1 text-sm font-medium text-slate-900">
												<span>View Document</span>
												<ExternalLink
													class="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
												/>
											</div>
											<span class="text-xs text-slate-400 truncate">PDF • Click to open</span>
										</div>
									</a>
									<div class="flex items-center gap-1 pl-3 border-l border-slate-200 ml-3">
										<button
											onclick={(e) => printUrl(e, publicUrl)}
											class="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
											title="Print"
										>
											<Printer class="w-4 h-4" />
										</button>
										<button
											onclick={() => document.getElementById(`${item.field}-input`)?.click()}
											class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-colors"
											title="Re-upload"
										>
											<RefreshCcw class="w-4 h-4" />
										</button>
									</div>
								</div>
								<input
									id={`${item.field}-input`}
									type="file"
									class="hidden"
									accept="image/*,.pdf"
									multiple
									onchange={(e) =>
										handleChange((files) => {
											if (item.field === 'ecg') ecgFiles = files;
											if (item.field === 'echo') echoFiles = files;
											if (item.field === 'efficacy') efficacyFiles = files;
											if (item.field === 'safety') safetyFiles = files;
										}, e)}
								/>
							{:else if item.files.length > 0}
								<div class="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
									<div class="flex items-center gap-3 mb-4">
										<div
											class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"
										>
											<span class="text-sm font-bold text-emerald-700">{item.files.length}</span>
										</div>
										<div class="min-w-0 flex-1">
											<p class="text-sm font-medium text-slate-900 truncate">
												{item.files.length === 1 ? item.files[0].name : 'Files ready to merge'}
											</p>
											<p class="text-xs text-slate-500">Ready to convert & upload</p>
										</div>
										<button
											onclick={() => {
												if (item.field === 'ecg') ecgFiles = [];
												if (item.field === 'echo') echoFiles = [];
												if (item.field === 'efficacy') efficacyFiles = [];
												if (item.field === 'safety') safetyFiles = [];
											}}
											class="p-2 text-slate-400 hover:text-rose-500 transition-colors">✕</button
										>
									</div>
									<button
										type="button"
										class="w-full bg-emerald-600 text-white font-semibold text-sm py-3 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
										onclick={() => uploadField(item.field, item.files)}
									>
										<CloudUpload class="w-4 h-4" />
										Upload &amp; Analyze
									</button>
								</div>
							{:else}
								<label
									class="group/label flex items-center justify-center gap-3 w-full border border-dashed border-slate-300 rounded-xl py-6 px-4 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/10 transition-all duration-300"
								>
									<div
										class="p-2 bg-slate-50 rounded-full group-hover/label:bg-emerald-100 transition-colors"
									>
										<CloudUpload
											class="w-5 h-5 text-slate-400 group-hover/label:text-emerald-600"
										/>
									</div>
									<span
										class="text-sm text-slate-500 font-medium group-hover/label:text-emerald-700"
										>Tap to select files</span
									>
									<input
										type="file"
										class="hidden"
										accept="image/*,.pdf"
										multiple
										onchange={(e) =>
											handleChange((files) => {
												if (item.field === 'ecg') ecgFiles = files;
												if (item.field === 'echo') echoFiles = files;
												if (item.field === 'efficacy') efficacyFiles = files;
												if (item.field === 'safety') safetyFiles = files;
											}, e)}
									/>
								</label>
							{/if}
						</div>
					{/each}
				</div>
			</section>

			<!-- New Visit Conclusion section -->
			<section in:fly={{ y: 20, delay: 300, duration: 600 }}>
				<div class="flex items-center gap-2 mb-4 px-2">
					<CheckCircle2 class="w-4 h-4 text-slate-700" />
					<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
						Visit Conclusion
					</h3>
				</div>

				<form
					method="POST"
					action="?/conclude"
					class="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-6"
				>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<!-- Voucher status -->
						<fieldset class="space-y-3">
							<legend class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
								Voucher
							</legend>
							<div class="flex flex-col gap-2">
								<label
									class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-all
          {voucherStatus === 'given'
										? 'border-emerald-500 bg-emerald-50 text-emerald-800'
										: 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40'}"
								>
									<input
										type="radio"
										name="voucher_status"
										value="given"
										bind:group={voucherStatus}
										class="hidden"
									/>
									<span
										class="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold
            {voucherStatus === 'given'
											? 'border-emerald-500 bg-emerald-500 text-white'
											: 'border-slate-300 text-slate-400'}">✔</span
									>
									<span>Voucher given</span>
								</label>

								<label
									class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-all
          {voucherStatus === 'not_given'
										? 'border-slate-900 bg-slate-900 text-white'
										: 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'}"
								>
									<input
										type="radio"
										name="voucher_status"
										value="not_given"
										bind:group={voucherStatus}
										class="hidden"
									/>
									<span
										class="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold
            {voucherStatus === 'not_given'
											? 'border-white bg-white text-slate-900'
											: 'border-slate-300 text-slate-400'}">✕</span
									>
									<span>Voucher not given</span>
								</label>
							</div>
						</fieldset>

						{#if !hasRandomizationId}
							<!-- Screening outcome -->
							<fieldset class="space-y-3">
								<legend class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
									Screening Outcome
								</legend>
								<div class="flex flex-col gap-2">
									<label
										class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-all
            {screeningOutcome === 'failure'
											? 'border-rose-500 bg-rose-50 text-rose-800'
											: 'border-slate-200 hover:border-rose-300 hover:bg-rose-50/40'}"
									>
										<input
											type="radio"
											name="screening_outcome"
											value="failure"
											bind:group={screeningOutcome}
											class="hidden"
										/>
										<span
											class="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold
              {screeningOutcome === 'failure'
												? 'border-rose-500 bg-rose-500 text-white'
												: 'border-slate-300 text-slate-400'}">!</span
										>
										<span>Screening failure</span>
									</label>

									<label
										class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-all
            {screeningOutcome === 'success'
											? 'border-emerald-500 bg-emerald-50 text-emerald-800'
											: 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40'}"
									>
										<input
											type="radio"
											name="screening_outcome"
											value="success"
											bind:group={screeningOutcome}
											class="hidden"
										/>
										<span
											class="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold
              {screeningOutcome === 'success'
												? 'border-emerald-500 bg-emerald-500 text-white'
												: 'border-slate-300 text-slate-400'}">✔</span
										>
										<span>Screening success</span>
									</label>
								</div>
							</fieldset>
						{/if}
					</div>

					<div class="pt-2 border-t border-slate-100 mt-4">
						<button
							type="submit"
							disabled={!voucherStatus || (!hasRandomizationId && !screeningOutcome)}
							class={'w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ' +
								concludeButtonColorClass}
						>
							{#if hasRandomizationId}
								<CheckCircle2 class="w-4 h-4" />
							{:else if screeningOutcome === 'failure'}
								<AlertOctagon class="w-4 h-4" />
							{:else if screeningOutcome === 'success'}
								<CheckCircle2 class="w-4 h-4" />
							{:else}
								<Clock class="w-4 h-4" />
							{/if}
							<span>{concludeLabel}</span>
						</button>
					</div>
				</form>
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
						class="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-900 text-white hover:bg-slate-800"
						onclick={closeExtractionDialog}
					>
						Close
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
