<!-- src/routes/visits/visit6/[id]/+page.svelte -->
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
		Loader,
		HeartPulse,
		CircleCheck
	} from '@lucide/svelte';
	import jsPDF from 'jspdf';
	import { fly } from 'svelte/transition';
	import VisitHeader from '$lib/components/visits/VisitHeader.svelte';
	import VisitEfficacyLabs from '$lib/components/visits/VisitEfficacyLabs.svelte';

	let { data }: PageProps = $props();
	let visit = $state(data.visit);
	let participant = $state(data.participant);
	let opdOptions = $state<string[]>(data.opdOptions ?? []);

	let scheduledOn = $state<string>(visit.scheduled_on ?? '');

	let uploading = $state({
		echo: false,
		safety: false
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
	   PDF & File Logic (same pattern as Visit 2)
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
	   R2 Upload (generic endpoint re-used)
	--------------------------------------------- */
	type UploadField = 'echo' | 'ecg' | 'efficacy' | 'safety';

	async function uploadToR2(field: UploadField, file: File) {
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

			if (field === 'echo') visit.echo_src = objectKey;
			if (field === 'ecg') visit.ecg_src = objectKey;
			if (field === 'efficacy') visit.efficacy_src = objectKey;
			if (field === 'safety') visit.safety_src = objectKey;
		} catch (err: any) {
			alert(err.message || 'Upload failed');
			throw err;
		}
	}

	/* --------------------------------------------
	   Visit 6 – Echo/ECG Upload & Extraction
	--------------------------------------------- */
	let echoFiles: File[] = $state([]);
	let ecgFiles: File[] = $state([]);

	async function uploadEcho(files: File[]) {
		if (!files.length) return;
		uploading.echo = true;

		try {
			let finalFile: File;

			if (files.length === 1 && files[0].type === 'application/pdf') {
				finalFile = files[0];
			} else {
				const init = participant.initials?.trim() ?? '';
				const scrId = participant.screening_id ?? '';
				const vNum = 'V6';
				const labelText = [init, scrId, vNum, 'ECHO'].filter(Boolean).join(' ');
				finalFile = await convertFilesToSinglePdf(files, labelText);
			}

			// 1) Gemini extraction for LVEF (Visit 6 echo)
			const fd = new FormData();
			fd.append('visitId', visit.id);
			fd.append('field', 'echo');
			fd.append('file', finalFile);

			try {
				const res = await fetch('/apis/visits/visit6/echo', {
					method: 'POST',
					body: fd
				});

				const out = await res.json();

				if (!out.ok) {
					console.warn('Visit 6 echo extraction failed:', out.error);
				} else {
					extractionDialog = {
						title: 'Visit 6 echocardiography extracted',
						fields: [{ label: 'LVEF (%)', value: out.updated?.echo_lvef ?? null }]
					};

					if (out.updated) {
						visit = {
							...visit,
							...out.updated
						};
					}
				}
			} catch (err) {
				console.error('Visit 6 echo endpoint error:', err);
			}

			// 2) Upload to R2 and save echo_src
			await uploadToR2('echo', finalFile);

			// 3) Clear local selection
			echoFiles = [];
		} catch (e) {
			console.error(e);
		} finally {
			uploading.echo = false;
		}
	}

	async function uploadEcg(files: File[]) {
		if (!files.length) return;
		// For ECG we are just storing the PDF (no AI extraction for now).
		try {
			let finalFile: File;

			if (files.length === 1 && files[0].type === 'application/pdf') {
				finalFile = files[0];
			} else {
				const init = participant.initials?.trim() ?? '';
				const scrId = participant.screening_id ?? '';
				const vNum = 'V6';
				const labelText = [init, scrId, vNum, 'ECG'].filter(Boolean).join(' ');
				finalFile = await convertFilesToSinglePdf(files, labelText);
			}

			await uploadToR2('ecg', finalFile);
			ecgFiles = [];
		} catch (err) {
			console.error(err);
			alert('ECG upload failed');
		}
	}

	let echoPublicUrl = $derived(r2PublicUrl(visit.echo_src));
	let ecgPublicUrl = $derived(r2PublicUrl(visit.ecg_src));

	/* --------------------------------------------
	   Visit 6 – Efficacy Upload & Extraction
	--------------------------------------------- */

	/* --------------------------------------------
	   Visit 6 – Safety Upload & Extraction
	--------------------------------------------- */
	let safetyFiles: File[] = $state([]);

	async function uploadSafety(files: File[]) {
		if (!files.length) return;
		uploading.safety = true;

		try {
			let finalFile: File;

			if (files.length === 1 && files[0].type === 'application/pdf') {
				finalFile = files[0];
			} else {
				const init = participant.initials?.trim() ?? '';
				const scrId = participant.screening_id ?? '';
				const vNum = 'V6';
				const labelText = [init, scrId, vNum, 'SAFETY'].filter(Boolean).join(' ');
				finalFile = await convertFilesToSinglePdf(files, labelText);
			}

			const fd = new FormData();
			fd.append('visitId', visit.id);
			fd.append('field', 'safety');
			fd.append('file', finalFile);

			try {
				const res = await fetch('/apis/visits/visit6/safety', {
					method: 'POST',
					body: fd
				});

				const out = await res.json();

				if (!out.ok) {
					console.warn('Visit 6 safety extraction failed:', out.error);
				} else {
					extractionDialog = {
						title: 'Visit 6 safety labs extracted',
						fields: [
							{ label: 'Hb', value: out.updated?.hb ?? null },
							{ label: 'RBCs', value: out.updated?.rbcs ?? null },
							{ label: 'WBCs', value: out.updated?.wbcs ?? null },
							{ label: 'Polymorphs', value: out.updated?.polymorphs ?? null },
							{ label: 'Lymphocytes', value: out.updated?.lymphocytes ?? null },
							{ label: 'Monocytes', value: out.updated?.monocytes ?? null },
							{ label: 'Platelets', value: out.updated?.platelets ?? null },
							{ label: 'SGOT/AST', value: out.updated?.sgot_ast ?? null },
							{ label: 'SGPT/ALT', value: out.updated?.sgpt_alt ?? null },
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

					if (out.updated) {
						visit = {
							...visit,
							...out.updated
						};
					}
				}
			} catch (err) {
				console.error('Visit 6 safety endpoint error:', err);
			}

			await uploadToR2('safety', finalFile);
			safetyFiles = [];
		} catch (e) {
			console.error(e);
		} finally {
			uploading.safety = false;
		}
	}

	let safetyPublicUrl = $derived(r2PublicUrl(visit.safety_src));
</script>

<div class="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
	<div
		class="fixed top-0 left-0 right-0 h-64 bg-gradient-to-b from-white to-slate-50 -z-10 pointer-events-none"
	></div>

	<div class="max-w-2xl mx-auto pt-10 px-6">
		<VisitHeader {participant} {visit} />

		<div class="space-y-8">
			<!-- OPD Scheduling (Visit 6) -->
			<section in:fly={{ y: 20, delay: 100, duration: 600 }}>
				<div class="flex items-center gap-2 mb-3 px-2">
					<Calendar class="w-4 h-4 text-amber-600" />
					<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
						OPD Scheduling (Visit 6)
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

			<!-- Echo & ECG Upload -->
			<section in:fly={{ y: 20, delay: 160, duration: 600 }}>
				<div class="flex items-center gap-2 mb-3 px-2">
					<HeartPulse class="w-4 h-4 text-rose-500" />
					<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
						Echo & ECG (Visit 6)
					</h3>
				</div>

				<div class="space-y-4">
					<!-- Echo -->
					<div
						class="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-300"
					>
						<div class="flex items-center justify-between mb-3">
							<h4 class="text-sm font-semibold text-slate-700">Echocardiography report (LVEF)</h4>

							{#if uploading.echo}
								<span
									class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"
								>
									Processing...
								</span>
							{:else if visit.echo_src}
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

						{#if uploading.echo}
							<div
								class="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-col items-center justify-center gap-3"
							>
								<Loader class="w-6 h-6 text-emerald-600 animate-spin" />
								<span class="text-xs text-slate-500 font-medium">
									Analyzing echo & uploading…
								</span>
							</div>
						{:else if echoPublicUrl && echoFiles.length === 0}
							<div
								class="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100 group-hover:border-emerald-200 transition-colors"
							>
								<a
									href={echoPublicUrl}
									target="_blank"
									class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
									title="Click to view echo report"
								>
									<div
										class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"
									>
										<FileText class="w-5 h-5 text-emerald-600" />
									</div>
									<div class="flex flex-col min-w-0">
										<div class="flex items-center gap-1 text-sm font-medium text-slate-900">
											<span>View echo report</span>
											<ExternalLink
												class="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
											/>
										</div>
										<span class="text-xs text-slate-400 truncate"> PDF • Click to open </span>
									</div>
								</a>
								<div class="flex items-center gap-1 pl-3 border-l border-slate-200 ml-3">
									<button
										onclick={(e) => printUrl(e, echoPublicUrl)}
										class="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
										title="Print"
									>
										<Printer class="w-4 h-4" />
									</button>
									<button
										onclick={() => document.getElementById('echo-input')?.click()}
										class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-colors"
										title="Re-upload"
									>
										<RefreshCcw class="w-4 h-4" />
									</button>
								</div>
							</div>
							<input
								id="echo-input"
								type="file"
								class="hidden"
								accept="image/*,.pdf"
								multiple
								onchange={(e) =>
									handleChange((files) => {
										echoFiles = files;
									}, e)}
							/>
						{:else if echoFiles.length > 0}
							<div class="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
								<div class="flex items-center gap-3 mb-4">
									<div
										class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"
									>
										<span class="text-sm font-bold text-emerald-700">
											{echoFiles.length}
										</span>
									</div>
									<div class="min-w-0 flex-1">
										<p class="text-sm font-medium text-slate-900 truncate">
											{echoFiles.length === 1 ? echoFiles[0].name : 'Files ready to merge'}
										</p>
										<p class="text-xs text-slate-500">Ready to convert & upload</p>
									</div>
									<button
										onclick={() => {
											echoFiles = [];
										}}
										class="p-2 text-slate-400 hover:text-rose-500 transition-colors"
									>
										✕
									</button>
								</div>
								<button
									type="button"
									class="w-full bg-emerald-600 text-white font-semibold text-sm py-3 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
									onclick={() => uploadEcho(echoFiles)}
								>
									<CloudUpload class="w-4 h-4" />
									Upload &amp; Analyze echo
								</button>
							</div>
						{:else}
							<label
								class="group/label flex items-center justify-center gap-3 w-full border border-dashed border-slate-300 rounded-xl py-6 px-4 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/10 transition-all duration-300"
							>
								<div
									class="p-2 bg-slate-50 rounded-full group-hover/label:bg-emerald-100 transition-colors"
								>
									<CloudUpload class="w-5 h-5 text-slate-400 group-hover/label:text-emerald-600" />
								</div>
								<span class="text-sm text-slate-500 font-medium group-hover/label:text-emerald-700"
									>Tap to select echo report</span
								>
								<input
									type="file"
									class="hidden"
									accept="image/*,.pdf"
									multiple
									onchange={(e) =>
										handleChange((files) => {
											echoFiles = files;
										}, e)}
								/>
							</label>
						{/if}

						{#if visit.echo_lvef != null}
							<div class="mt-3 text-xs text-slate-700 flex justify-between">
								<span class="font-medium">Stored LVEF</span>
								<span class="font-semibold">{visit.echo_lvef}%</span>
							</div>
						{/if}
					</div>

					<!-- ECG -->
					<div
						class="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-300"
					>
						<div class="flex items-center justify-between mb-3">
							<h4 class="text-sm font-semibold text-slate-700">ECG report (storage only)</h4>
							{#if visit.ecg_src}
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

						{#if ecgPublicUrl && ecgFiles.length === 0}
							<div
								class="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100 group-hover:border-emerald-200 transition-colors"
							>
								<a
									href={ecgPublicUrl}
									target="_blank"
									class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
									title="Click to view ECG"
								>
									<div
										class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"
									>
										<FileText class="w-5 h-5 text-emerald-600" />
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
										class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-colors"
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
								onchange={(e) =>
									handleChange((files) => {
										ecgFiles = files;
									}, e)}
							/>
						{:else if ecgFiles.length > 0}
							<div class="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
								<div class="flex items-center gap-3 mb-4">
									<div
										class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"
									>
										<span class="text-sm font-bold text-emerald-700">
											{ecgFiles.length}
										</span>
									</div>
									<div class="min-w-0 flex-1">
										<p class="text-sm font-medium text-slate-900 truncate">
											{ecgFiles.length === 1 ? ecgFiles[0].name : 'Files ready to merge'}
										</p>
										<p class="text-xs text-slate-500">Ready to convert & upload</p>
									</div>
									<button
										onclick={() => {
											ecgFiles = [];
										}}
										class="p-2 text-slate-400 hover:text-rose-500 transition-colors"
									>
										✕
									</button>
								</div>
								<button
									type="button"
									class="w-full bg-emerald-600 text-white font-semibold text-sm py-3 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
									onclick={() => uploadEcg(ecgFiles)}
								>
									<CloudUpload class="w-4 h-4" />
									Upload ECG
								</button>
							</div>
						{:else}
							<label
								class="group/label flex items-center justify-center gap-3 w-full border border-dashed border-slate-300 rounded-xl py-6 px-4 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/10 transition-all duration-300"
							>
								<div
									class="p-2 bg-slate-50 rounded-full group-hover/label:bg-emerald-100 transition-colors"
								>
									<CloudUpload class="w-5 h-5 text-slate-400 group-hover/label:text-emerald-600" />
								</div>
								<span class="text-sm text-slate-500 font-medium group-hover/label:text-emerald-700"
									>Tap to select ECG report</span
								>
								<input
									type="file"
									class="hidden"
									accept="image/*,.pdf"
									multiple
									onchange={(e) =>
										handleChange((files) => {
											ecgFiles = files;
										}, e)}
								/>
							</label>
						{/if}
					</div>
				</div>
			</section>

			<!-- Efficacy (Visit 6) using reusable component -->
			<section in:fly={{ y: 20, delay: 210, duration: 600 }}>
				<VisitEfficacyLabs
					bind:visit
					{participant}
					sectionTitle="Visit 6 – Efficacy Markers"
					sectionSubtitle="NT-proBNP, TSH, homocysteine, cytokines & methylation markers"
				/>
			</section>

			<!-- Safety upload (Visit 6) -->
			<section in:fly={{ y: 20, delay: 260, duration: 600 }}>
				<div class="flex items-center gap-2 mb-3 px-2">
					<FileText class="w-4 h-4 text-sky-600" />
					<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
						Visit 6 – Safety Labs
					</h3>
				</div>

				<div
					class="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden"
				>
					<div class="flex items-center justify-between mb-3 relative z-10">
						<h4 class="text-sm font-semibold text-slate-700">
							Routine safety labs (CBC, LFT, RFT, lipids)
						</h4>

						{#if uploading.safety}
							<span
								class="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"
							>
								Processing...
							</span>
						{:else if visit.safety_src}
							<span
								class="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full flex items-center gap-1"
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

					{#if uploading.safety}
						<div
							class="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-col items-center justify-center gap-3"
						>
							<Loader class="w-6 h-6 text-sky-600 animate-spin" />
							<span class="text-xs text-slate-500 font-medium">
								Analyzing safety labs & uploading…
							</span>
						</div>
					{:else if safetyPublicUrl && safetyFiles.length === 0}
						<div
							class="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100 group-hover:border-sky-200 transition-colors"
						>
							<a
								href={safetyPublicUrl}
								target="_blank"
								class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
								title="Click to view report"
							>
								<div
									class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"
								>
									<FileText class="w-5 h-5 text-sky-600" />
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
									onclick={(e) => printUrl(e, safetyPublicUrl)}
									class="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
									title="Print"
								>
									<Printer class="w-4 h-4" />
								</button>
								<button
									onclick={() => document.getElementById('safety-input')?.click()}
									class="p-2 text-slate-400 hover:text-sky-600 hover:bg-white rounded-lg transition-colors"
								>
									<RefreshCcw class="w-4 h-4" />
								</button>
							</div>
						</div>
						<input
							id="safety-input"
							type="file"
							class="hidden"
							accept="image/*,.pdf"
							multiple
							onchange={(e) =>
								handleChange((files) => {
									safetyFiles = files;
								}, e)}
						/>
					{:else if safetyFiles.length > 0}
						<div class="bg-sky-50/50 rounded-xl p-4 border border-sky-100">
							<div class="flex items-center gap-3 mb-4">
								<div
									class="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center shrink-0"
								>
									<span class="text-sm font-bold text-sky-700">
										{safetyFiles.length}
									</span>
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium text-slate-900 truncate">
										{safetyFiles.length === 1 ? safetyFiles[0].name : 'Files ready to merge'}
									</p>
									<p class="text-xs text-slate-500">Ready to convert & upload</p>
								</div>
								<button
									onclick={() => {
										safetyFiles = [];
									}}
									class="p-2 text-slate-400 hover:text-rose-500 transition-colors"
								>
									✕
								</button>
							</div>
							<button
								type="button"
								class="w-full bg-sky-600 text-white font-semibold text-sm py-3 rounded-xl shadow-lg shadow-sky-200 hover:bg-sky-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
								onclick={() => uploadSafety(safetyFiles)}
							>
								<CloudUpload class="w-4 h-4" />
								Upload &amp; Analyze safety labs
							</button>
						</div>
					{:else}
						<label
							class="group/label flex items-center justify-center gap-3 w-full border border-dashed border-slate-300 rounded-xl py-6 px-4 cursor-pointer hover:border-sky-500 hover:bg-sky-50/10 transition-all duration-300"
						>
							<div
								class="p-2 bg-slate-50 rounded-full group-hover/label:bg-sky-100 transition-colors"
							>
								<CloudUpload class="w-5 h-5 text-slate-400 group-hover/label:text-sky-600" />
							</div>
							<span class="text-sm text-slate-500 font-medium group-hover/label:text-sky-700"
								>Tap to select combined safety report</span
							>
							<input
								type="file"
								class="hidden"
								accept="image/*,.pdf"
								multiple
								onchange={(e) =>
									handleChange((files) => {
										safetyFiles = files;
									}, e)}
							/>
						</label>
					{/if}
				</div>

				{#if visit.hb != null || visit.rbcs != null || visit.wbcs != null || visit.polymorphs != null || visit.lymphocytes != null || visit.monocytes != null || visit.platelets != null || visit.sgot_ast != null || visit.sgpt_alt != null || visit.bilirubin_total != null || visit.bilirubin_direct != null || visit.bilirubin_indirect != null || visit.bun != null || visit.serum_creatinine != null || visit.total_cholesterol != null || visit.hdl != null || visit.ldl != null || visit.triglycerides != null}
					<div class="mt-4 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
						<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
							Stored safety values
						</p>
						<div class="grid grid-cols-2 gap-y-1 gap-x-4 text-[11px] text-slate-700">
							{#if visit.hb != null}
								<div class="flex justify-between">
									<span>Hb</span>
									<span class="font-semibold">{visit.hb}</span>
								</div>
							{/if}
							{#if visit.rbcs != null}
								<div class="flex justify-between">
									<span>RBCs</span>
									<span class="font-semibold">{visit.rbcs}</span>
								</div>
							{/if}
							{#if visit.wbcs != null}
								<div class="flex justify-between">
									<span>WBCs</span>
									<span class="font-semibold">{visit.wbcs}</span>
								</div>
							{/if}
							{#if visit.polymorphs != null}
								<div class="flex justify-between">
									<span>Polymorphs</span>
									<span class="font-semibold">{visit.polymorphs}</span>
								</div>
							{/if}
							{#if visit.lymphocytes != null}
								<div class="flex justify-between">
									<span>Lymphocytes</span>
									<span class="font-semibold">{visit.lymphocytes}</span>
								</div>
							{/if}
							{#if visit.monocytes != null}
								<div class="flex justify-between">
									<span>Monocytes</span>
									<span class="font-semibold">{visit.monocytes}</span>
								</div>
							{/if}
							{#if visit.platelets != null}
								<div class="flex justify-between">
									<span>Platelets</span>
									<span class="font-semibold">{visit.platelets}</span>
								</div>
							{/if}
							{#if visit.sgot_ast != null}
								<div class="flex justify-between">
									<span>SGOT/AST</span>
									<span class="font-semibold">{visit.sgot_ast}</span>
								</div>
							{/if}
							{#if visit.sgpt_alt != null}
								<div class="flex justify-between">
									<span>SGPT/ALT</span>
									<span class="font-semibold">{visit.sgpt_alt}</span>
								</div>
							{/if}
							{#if visit.bilirubin_total != null}
								<div class="flex justify-between">
									<span>Total bili</span>
									<span class="font-semibold">{visit.bilirubin_total}</span>
								</div>
							{/if}
							{#if visit.bilirubin_direct != null}
								<div class="flex justify-between">
									<span>Direct bili</span>
									<span class="font-semibold">{visit.bilirubin_direct}</span>
								</div>
							{/if}
							{#if visit.bilirubin_indirect != null}
								<div class="flex justify-between">
									<span>Indirect bili</span>
									<span class="font-semibold">{visit.bilirubin_indirect}</span>
								</div>
							{/if}
							{#if visit.bun != null}
								<div class="flex justify-between">
									<span>BUN</span>
									<span class="font-semibold">{visit.bun}</span>
								</div>
							{/if}
							{#if visit.serum_creatinine != null}
								<div class="flex justify-between">
									<span>Creatinine</span>
									<span class="font-semibold">{visit.serum_creatinine}</span>
								</div>
							{/if}
							{#if visit.total_cholesterol != null}
								<div class="flex justify-between">
									<span>Total chol</span>
									<span class="font-semibold">{visit.total_cholesterol}</span>
								</div>
							{/if}
							{#if visit.hdl != null}
								<div class="flex justify-between">
									<span>HDL</span>
									<span class="font-semibold">{visit.hdl}</span>
								</div>
							{/if}
							{#if visit.ldl != null}
								<div class="flex justify-between">
									<span>LDL</span>
									<span class="font-semibold">{visit.ldl}</span>
								</div>
							{/if}
							{#if visit.triglycerides != null}
								<div class="flex justify-between">
									<span>TGs</span>
									<span class="font-semibold">{visit.triglycerides}</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</section>

			<!-- Visit 6 conclusion -->
			<section in:fly={{ y: 20, delay: 310, duration: 600 }}>
				{#if visit.visit_date}
					<div
						class="bg-emerald-50/80 rounded-2xl border border-emerald-200 p-4 flex items-center gap-3"
					>
						<div class="bg-emerald-100 text-emerald-700 p-2 rounded-full">
							<CheckCircle2 class="w-5 h-5" />
						</div>
						<div class="flex flex-col">
							<span class="text-xs font-bold text-slate-500 uppercase tracking-wide">
								Visit 6 status
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
						class="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3"
					>
						<div class="flex items-center gap-2">
							<CheckCircle2 class="w-4 h-4 text-slate-700" />
							<h3 class="text-xs font-bold uppercase tracking-widest text-slate-500">
								Visit 6 conclusion
							</h3>
						</div>

						<p class="text-xs text-slate-500">
							On clicking the button, Visit 6 will be marked as completed using today’s date.
						</p>

						<button
							type="submit"
							class="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-950 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-500 active:scale-[0.98] transition-all"
						>
							<CircleCheck class="w-4 h-4" />
							<span>Mark Visit 6 Completed</span>
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
