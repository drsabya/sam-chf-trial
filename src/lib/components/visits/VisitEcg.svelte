<!-- src/lib/components/visits/VisitEcg.svelte -->
<script lang="ts">
	import {
		FileText,
		CloudUpload,
		Printer,
		RefreshCcw,
		ExternalLink,
		CheckCircle2,
		Loader
	} from '@lucide/svelte';
	import jsPDF from 'jspdf';

	interface Props {
		visit: any;
		participant: any;
		field?: 'ecg';
		sectionTitle?: string;
		sectionSubtitle?: string;
	}

	let {
		visit = $bindable(),
		participant,
		field = 'ecg',
		sectionTitle = 'ECG (Visit)',
		sectionSubtitle = 'ECG report (storage only)'
	}: Props = $props();

	let uploading = $state(false);
	let files: File[] = $state([]);

	let ecgPublicUrl = $derived(r2PublicUrl(visit.ecg_src));

	/* --------------------------------------------
	   Helpers
	--------------------------------------------- */
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

	function r2PublicUrl(key: string | null) {
		if (!key) return null;
		return `https://pub-4cd2e47347704d5dab6e20a0bbd4b079.r2.dev/${key}`;
	}

	function isImageFile(file: File): boolean {
		return file.type.startsWith('image/');
	}

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

	async function convertFilesToSinglePdf(files: File[], labelText?: string): Promise<File> {
		if (!files || files.length === 0) throw new Error('No files to convert');

		const imageFiles = files.filter(isImageFile);
		if (imageFiles.length === 0) {
			// already a PDF or some other single file
			return files[0];
		}

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

			// update visit locally so parent sees new ecg_src via $bindable
			if (field === 'ecg') {
				visit = { ...visit, ecg_src: objectKey };
			}

			ecgPublicUrl = r2PublicUrl(objectKey);
		} catch (err: any) {
			alert(err.message || 'Upload failed');
			throw err;
		}
	}

	/* --------------------------------------------
	   Main upload handler (no vision)
	--------------------------------------------- */
	async function uploadEcg() {
		if (!files.length) return;
		uploading = true;

		try {
			let finalFile: File;

			if (files.length === 1 && files[0].type === 'application/pdf') {
				finalFile = files[0];
			} else {
				const init = participant.initials?.trim() ?? '';
				const scrId = participant.screening_id ?? '';
				const vNum = typeof visit.visit_number === 'number' ? `V${visit.visit_number}` : 'VISIT';
				const labelText = [init, scrId, vNum, 'ECG'].filter(Boolean).join(' ');
				finalFile = await convertFilesToSinglePdf(files, labelText);
			}

			await uploadToR2(finalFile);
			files = [];
		} catch (err) {
			console.error(err);
			alert('ECG upload failed');
		} finally {
			uploading = false;
		}
	}
</script>

<section>
	<div class="flex items-center gap-2 mb-3 px-2">
		<FileText class="w-4 h-4 text-sky-600" />
		<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
			{sectionTitle}
		</h3>
	</div>

	<div
		class="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-300"
	>
		<div class="flex items-center justify-between mb-3">
			<h4 class="text-sm font-semibold text-slate-700">
				{sectionSubtitle}
			</h4>

			{#if uploading}
				<span
					class="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"
				>
					Uploading...
				</span>
			{:else if visit.ecg_src}
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
				<Loader class="w-6 h-6 text-sky-600 animate-spin" />
				<span class="text-xs text-slate-500 font-medium"> Uploading ECG report… </span>
			</div>
		{:else if ecgPublicUrl && files.length === 0}
			<!-- Already uploaded -->
			<div
				class="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100 group-hover:border-sky-200 transition-colors"
			>
				<a
					href={ecgPublicUrl}
					target="_blank"
					class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
					title="Click to view ECG report"
				>
					<div
						class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"
					>
						<FileText class="w-5 h-5 text-sky-600" />
					</div>
					<div class="flex flex-col min-w-0">
						<div class="flex items-center gap-1 text-sm font-medium text-slate-900">
							<span>View ECG report</span>
							<ExternalLink
								class="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
							/>
						</div>
						<span class="text-xs text-slate-400 truncate"> PDF • Click to open </span>
					</div>
				</a>
				<div class="flex items-center gap-1 pl-3 border-l border-slate-200 ml-3">
					<button
						onclick={(e) => printUrl(e, ecgPublicUrl)}
						class="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
						title="Print"
					>
						<Printer class="w-4 h-4" />
					</button>
					<button
						onclick={() => document.getElementById('ecg-input')?.click()}
						class="p-2 text-slate-400 hover:text-sky-600 hover:bg-white rounded-lg transition-colors"
						title="Re-upload"
					>
						<RefreshCcw class="w-4 h-4" />
					</button>
				</div>
			</div>
			<input
				id="ecg-input"
				type="file"
				class="hidden"
				accept="image/*,.pdf"
				multiple
				onchange={handleChange}
			/>
		{:else if files.length > 0}
			<!-- Files selected -->
			<div class="bg-sky-50/50 rounded-xl p-4 border border-sky-100">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
						<span class="text-sm font-bold text-sky-700">
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
					class="w-full bg-sky-600 text-white font-semibold text-sm py-3 rounded-xl shadow-lg shadow-sky-200 hover:bg-sky-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
					onclick={uploadEcg}
				>
					<CloudUpload class="w-4 h-4" />
					Upload ECG
				</button>
			</div>
		{:else}
			<!-- No file yet -->
			<label
				class="group/label flex items-center justify-center gap-3 w-full border border-dashed border-slate-300 rounded-xl py-6 px-4 cursor-pointer hover:border-sky-500 hover:bg-sky-50/10 transition-all duration-300"
			>
				<div class="p-2 bg-slate-50 rounded-full group-hover/label:bg-sky-100 transition-colors">
					<CloudUpload class="w-5 h-5 text-slate-400 group-hover/label:text-sky-600" />
				</div>
				<span class="text-sm text-slate-500 font-medium group-hover/label:text-sky-700"
					>Tap to select ECG report</span
				>
				<input
					id="ecg-input"
					type="file"
					class="hidden"
					accept="image/*,.pdf"
					multiple
					onchange={handleChange}
				/>
			</label>
		{/if}
	</div>
</section>
