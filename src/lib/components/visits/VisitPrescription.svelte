<!-- src/lib/components/visits/VisitPrescription.svelte -->
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
		sectionTitle?: string;
		sectionSubtitle?: string;
	}

	let {
		visit = $bindable(),
		participant,
		sectionTitle = 'Prescription',
		sectionSubtitle = 'OPD prescription / medication chart'
	}: Props = $props();

	let uploading = $state(false);
	let files: File[] = $state([]);

	/* --------------------------------------------
	   Helpers
	--------------------------------------------- */
	function r2PublicUrl(key: string | null) {
		if (!key) return null;
		return `https://pub-4cd2e47347704d5dab6e20a0bbd4b079.r2.dev/${key}`;
	}

	let prescriptionPublicUrl = $derived(
		r2PublicUrl(visit.prescription_src)
	);

	let monthLabel = $derived.by(() => {
		const v = Number(visit?.visit_number ?? 0);
		if ([2, 3, 4].includes(v)) return '1 month';
		if ([5, 6, 7].includes(v)) return '3 months';
		return null;
	});

	function handleChange(evt: Event) {
		const input = evt.target as HTMLInputElement;
		if (input.files && input.files.length) {
			files = [...files, ...Array.from(input.files)];
			input.value = '';
		}
	}

	function openFilePicker() {
		document.getElementById('prescription-input')?.click();
	}

	function printUrl(e: Event, url: string | null) {
		e.preventDefault();
		if (!url) return;
		const win = window.open(url, '_blank');
		win?.onload && win.print();
	}

	function isImageFile(file: File) {
		return file.type.startsWith('image/');
	}

	function fileToDataURL(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const r = new FileReader();
			r.onload = () => resolve(r.result as string);
			r.onerror = reject;
			r.readAsDataURL(file);
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

	async function convertFilesToSinglePdf(files: File[], label?: string): Promise<File> {
		const images = files.filter(isImageFile);
		if (!images.length) return files[0];

		const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
		const pw = pdf.internal.pageSize.getWidth();
		const ph = pdf.internal.pageSize.getHeight();

		for (let i = 0; i < images.length; i++) {
			if (i) pdf.addPage();
			const dataUrl = await fileToDataURL(images[i]);
			const img = await loadImage(dataUrl);

			const scale = Math.min(pw / img.width, (ph - 48) / img.height);
			const w = img.width * scale;
			const h = img.height * scale;

			if (label) {
				pdf.setFontSize(14);
				pdf.setTextColor(138, 43, 226);
				pdf.text(label, pw - pdf.getTextWidth(label) - 20, 24);
			}

			pdf.addImage(dataUrl, 'JPEG', (pw - w) / 2, 32, w, h);
		}

		return new File([pdf.output('blob')], 'prescription.pdf', {
			type: 'application/pdf'
		});
	}

	/* --------------------------------------------
	   Upload logic
	--------------------------------------------- */
	async function uploadPrescription() {
		if (!files.length) return;
		uploading = true;

		try {
			let finalFile: File;

			if (files.length === 1 && files[0].type === 'application/pdf') {
				finalFile = files[0];
			} else {
				const label = [
					participant.initials,
					participant.screening_id,
					`V${visit.visit_number}`,
					'PRESCRIPTION'
				]
					.filter(Boolean)
					.join(' ');
				finalFile = await convertFilesToSinglePdf(files, label);
			}

			// 1️⃣ Presign
			const presign = await fetch('/apis/r2/presign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					visitId: visit.id,
					field: 'prescription',
					filename: finalFile.name
				})
			}).then(r => r.json());

			if (!presign.ok) throw new Error('Presign failed');

			// 2️⃣ Upload to R2
			const up = await fetch(presign.url, {
				method: 'PUT',
				body: finalFile
			});
			if (!up.ok) throw new Error('R2 upload failed');

			// 3️⃣ Persist prescription_src
			const save = await fetch('/apis/visits/prescription', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					visitId: visit.id,
					objectKey: presign.objectKey
				})
			}).then(r => r.json());

			if (!save.ok) throw new Error('DB save failed');

			visit = { ...visit, prescription_src: presign.objectKey };
			files = [];
		} catch (e: any) {
			alert(e.message || 'Upload failed');
		} finally {
			uploading = false;
		}
	}
</script>

<section>
	<div class="flex items-center gap-2 mb-3 px-2">
		<FileText class="w-4 h-4 text-violet-600" />
		<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
			{sectionTitle} {monthLabel ? `- ${monthLabel}` : ''}
		</h3>
	</div>

	<div class="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
		<div class="flex items-center justify-between mb-3">
			<h4 class="text-sm font-semibold text-slate-700">
				{sectionSubtitle}
			</h4>

			{#if uploading}
				<span class="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
					Uploading…
				</span>
			{:else if visit.prescription_src}
				<span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
					<CheckCircle2 class="w-3 h-3" /> Uploaded
				</span>
			{:else}
				<span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
					Pending
				</span>
			{/if}
		</div>

		{#if prescriptionPublicUrl && !files.length}
			<div class="flex items-center justify-between bg-slate-50 rounded-xl p-3">
				<a href={prescriptionPublicUrl} target="_blank" class="flex items-center gap-3">
					<FileText class="w-5 h-5 text-violet-600" />
					<span class="text-sm font-medium">View prescription</span>
				</a>
				<div class="flex gap-2">
					<button onclick={(e) => printUrl(e, prescriptionPublicUrl)}>
						<Printer class="w-4 h-4" />
					</button>
					<button onclick={openFilePicker}>
						<RefreshCcw class="w-4 h-4" />
					</button>
				</div>
			</div>
		{:else}
			<label class="flex justify-center border border-dashed rounded-xl py-6 cursor-pointer">
				<CloudUpload class="w-5 h-5 text-slate-400" />
				<input
					id="prescription-input"
					type="file"
					class="hidden"
					accept="image/*,.pdf"
					multiple
					onchange={handleChange}
				/>
			</label>
		{/if}

		{#if files.length}
			<button
				class="mt-4 w-full bg-violet-600 text-white py-3 rounded-xl"
				onclick={uploadPrescription}
			>
				Upload prescription
			</button>
		{/if}
	</div>
</section>
