<!-- src/lib/components/visits/VisitEfficacyLabs.svelte -->
<script lang="ts">
	import {
		FileText,
		CloudUpload,
		Printer,
		RefreshCcw,
		ExternalLink,
		Loader,
		CheckCircle2
	} from '@lucide/svelte';
	import jsPDF from 'jspdf';

	interface Props {
		visit: any;
		participant: any;
		field?: 'efficacy';
		visionEndpoint?: string;
		sectionTitle?: string;
		sectionSubtitle?: string;
	}

	let {
		visit = $bindable(),
		participant,
		field = 'efficacy',
		visionEndpoint = '/apis/visits/vision/efficacy',
		sectionTitle = 'Efficacy labs',
		sectionSubtitle = 'NT-proBNP, TSH, homocysteine, cytokines & methylation markers'
	}: Props = $props();

	type ExtractionDialog = {
		title: string;
		fields: { label: string; value: string | number | null }[];
	};

	let uploading = $state(false);
	let files: File[] = $state([]);
	let extractionDialog: ExtractionDialog | null = $state(null);

	let filePublicUrl = $derived(r2PublicUrl(visit.efficacy_src));

	/* --------------------------------------------
	   Helpers
	--------------------------------------------- */
	function r2PublicUrl(key: string | null) {
		if (!key) return null;
		return `https://pub-4cd2e47347704d5dab6e20a0bbd4b079.r2.dev/${key}`;
	}

	function closeExtractionDialog() {
		extractionDialog = null;
	}

	function handleChange(evt: Event) {
		const target = evt.target as HTMLInputElement;
		if (target.files) files = Array.from(target.files);
	}

	function printUrl(e: Event, url: string | null) {
		e.preventDefault();
		e.stopPropagation();
		if (!url) return;
		const win = window.open(url, '_blank');
		if (!win) return;
		win.onload = () => win.print();
	}

	/* --------------------------------------------
	   PDF / image → single PDF
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

		const pdf = new jsPDF('p', 'pt', 'a4');
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
	   R2 upload
	--------------------------------------------- */
	async function uploadToR2(file: File) {
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

			if (field === 'efficacy') {
				visit = { ...visit, efficacy_src: objectKey };
				filePublicUrl = r2PublicUrl(objectKey);
			}
		} catch (err: any) {
			alert(err.message || 'Upload failed');
			throw err;
		}
	}

	/* --------------------------------------------
	   Upload + vision extraction
	--------------------------------------------- */
	async function uploadAndAnalyze() {
		if (!files.length) return;
		uploading = true;

		try {
			let finalFile: File;

			if (files.length === 1 && files[0].type === 'application/pdf') {
				finalFile = files[0];
			} else {
				const init = participant.initials?.trim() ?? '';
				const scrId = participant.screening_id ?? '';
				const vNum = visit?.visit_number != null ? `V${visit.visit_number}` : '';
				const labelText = [init, scrId, vNum].filter(Boolean).join(' ');
				finalFile = await convertFilesToSinglePdf(files, labelText);
			}

			const fd = new FormData();
			fd.append('visitId', visit.id);
			fd.append('visitNumber', String(visit.visit_number ?? ''));
			fd.append('field', field);
			fd.append('file', finalFile);

			try {
				const res = await fetch(visionEndpoint, {
					method: 'POST',
					body: fd
				});

				const out = await res.json();

				if (!out.ok) {
					console.warn('Efficacy extraction failed:', out.error);
				} else {
					extractionDialog = {
						title:
							visit?.visit_number != null
								? `Visit ${visit.visit_number} efficacy labs extracted`
								: 'Efficacy labs extracted',
						fields: [
							{ label: 'NT-proBNP', value: out.updated?.nt_pro_bnp ?? null },
							{ label: 'Serum TSH', value: out.updated?.serum_tsh ?? null },
							{
								label: 'Serum homocysteine',
								value: out.updated?.serum_homocysteine ?? null
							},
							{ label: 'GSH', value: out.updated?.gsh ?? null },
							{ label: 'TNF-α', value: out.updated?.tnf_alpha ?? null },
							{ label: 'IL-6', value: out.updated?.il6 ?? null },
							{ label: 'SAM / SAME', value: out.updated?.same ?? null },
							{ label: 'SAH', value: out.updated?.sah ?? null },
							{
								label: '5-methylcytosine',
								value: out.updated?.five_methylcytosine ?? null
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
				console.error('Efficacy vision endpoint error:', err);
			}

			await uploadToR2(finalFile);
			files = [];
		} catch (e) {
			console.error(e);
		} finally {
			uploading = false;
		}
	}
</script>

<section>
	<div class="flex items-center gap-2 mb-3 px-2">
		<FileText class="w-4 h-4 text-emerald-600" />
		<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
			{sectionTitle}
		</h3>
	</div>

	<div
		class="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden"
	>
		<div class="flex items-center justify-between mb-3 relative z-10">
			<h4 class="text-sm font-semibold text-slate-700">
				{sectionSubtitle}
			</h4>

			{#if uploading}
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
				<span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full"
					>Pending</span
				>
			{/if}
		</div>

		{#if uploading}
			<div
				class="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-col items-center justify-center gap-3"
			>
				<Loader class="w-6 h-6 text-emerald-600 animate-spin" />
				<span class="text-xs text-slate-500 font-medium"> Analyzing report &amp; uploading… </span>
			</div>
		{:else if filePublicUrl && files.length === 0}
			<!-- Already uploaded -->
			<div
				class="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100 group-hover:border-emerald-200 transition-colors"
			>
				<a
					href={filePublicUrl}
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
						onclick={(e) => printUrl(e, filePublicUrl)}
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
				onchange={handleChange}
			/>
		{:else if files.length > 0}
			<!-- Files selected -->
			<div class="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
				<div class="flex items-center gap-3 mb-4">
					<div
						class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"
					>
						<span class="text-sm font-bold text-emerald-700">
							{files.length}
						</span>
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-slate-900 truncate">
							{files.length === 1 ? files[0].name : 'Files ready to merge'}
						</p>
						<p class="text-xs text-slate-500">Ready to convert &amp; upload</p>
					</div>
					<button
						onclick={() => {
							files = [];
						}}
						class="p-2 text-slate-400 hover:text-rose-500 transition-colors"
					>
						✕
					</button>
				</div>
				<button
					type="button"
					class="w-full bg-emerald-600 text-white font-semibold text-sm py-3 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
					onclick={uploadAndAnalyze}
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
					>Tap to select efficacy report</span
				>
				<input type="file" class="hidden" accept="image/*,.pdf" multiple onchange={handleChange} />
			</label>
		{/if}
	</div>

	{#if visit.nt_pro_bnp != null || visit.serum_tsh != null || visit.serum_homocysteine != null || visit.gsh != null || visit.tnf_alpha != null || visit.il6 != null || visit.same != null || visit.sah != null || visit.five_methylcytosine != null}
		<div class="mt-4 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
			<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Stored values</p>
			<div class="space-y-1 text-xs text-slate-700">
				{#if visit.nt_pro_bnp != null}
					<div class="flex justify-between">
						<span>NT-proBNP</span>
						<span class="font-semibold">{visit.nt_pro_bnp}</span>
					</div>
				{/if}
				{#if visit.serum_tsh != null}
					<div class="flex justify-between">
						<span>Serum TSH</span>
						<span class="font-semibold">{visit.serum_tsh}</span>
					</div>
				{/if}
				{#if visit.serum_homocysteine != null}
					<div class="flex justify-between">
						<span>Serum homocysteine</span>
						<span class="font-semibold">{visit.serum_homocysteine}</span>
					</div>
				{/if}
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
						<span>SAM / SAME</span>
						<span class="font-semibold">{visit.same}</span>
					</div>
				{/if}
				{#if visit.sah != null}
					<div class="flex justify-between">
						<span>SAH</span>
						<span class="font-semibold">{visit.sah}</span>
					</div>
				{/if}
				{#if visit.five_methylcytosine != null}
					<div class="flex justify-between">
						<span>5-methylcytosine</span>
						<span class="font-semibold">{visit.five_methylcytosine}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

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
</section>
