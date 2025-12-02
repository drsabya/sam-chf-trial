<!-- src/routes/files/+page.svelte -->
<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import type { FileItem } from './+page.server';
	import { Trash2, Link2, AlertTriangle } from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData | null } = $props();

	const files: FileItem[] = (data.files ?? []) as FileItem[];

	function confirmAndSubmit(event: MouseEvent) {
		event.preventDefault();
		const target = event.currentTarget as HTMLElement | null;
		const formEl = target?.closest('form') as HTMLFormElement | null;

		if (!formEl) return;

		if (confirm('Are you sure you want to permanently delete this file?')) {
			formEl.submit();
		}
	}

	function humanizeFieldName(field: string) {
		// ecg_src -> ECG
		// prescription_src -> Prescription
		return field
			.replace(/_src$/, '')
			.replace(/_/g, ' ')
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}
</script>

<div class="min-h-screen bg-slate-50 px-4 py-8">
	<div class="mx-auto max-w-6xl space-y-6">
		<header class="flex items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight text-slate-900">Files</h1>
				<p class="mt-1 text-sm text-slate-500">
					All uploaded files across visits. Deleting a file will remove it from R2 and clear the
					corresponding field in the visit record.
				</p>
			</div>
		</header>

		{#if form}
			<div
				class="rounded-2xl border px-4 py-3 text-sm flex items-center gap-2
          {form.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}"
			>
				<AlertTriangle class="h-4 w-4 shrink-0" />
				<span>{form.message ?? (form.ok ? 'Operation completed.' : 'Something went wrong.')}</span>
			</div>
		{/if}

		{#if files.length === 0}
			<div
				class="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500"
			>
				No files found across visits yet.
			</div>
		{:else}
			<div
				class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-100"
			>
				<div class="max-h-[70vh] overflow-auto">
					<table class="min-w-full text-left text-sm">
						<thead class="sticky top-0 bg-slate-50/95 backdrop-blur">
							<tr class="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
								<th class="px-4 py-3">Visit</th>
								<th class="px-4 py-3">Participant</th>
								<th class="px-4 py-3">Type</th>
								<th class="px-4 py-3">Link</th>
								<th class="px-4 py-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each files as file}
								<tr class="hover:bg-slate-50/60">
									<td class="px-4 py-3 align-middle text-slate-800">
										<div class="flex flex-col">
											<span class="font-medium">
												Visit {file.visitNumber ?? '—'}
											</span>
											<span class="text-xs text-slate-500">
												ID: {file.visitId}
											</span>
										</div>
									</td>

									<td class="px-4 py-3 align-middle text-slate-800">
										{#if file.participantId}
											<span class="font-mono text-xs text-slate-700">
												{file.participantId}
											</span>
										{:else}
											<span class="text-xs text-slate-400">
												Not set
											</span>
										{/if}
									</td>

									<td class="px-4 py-3 align-middle text-slate-800">
										<div class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
											{humanizeFieldName(file.field)}
										</div>
										<p class="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
											{file.field}
										</p>
									</td>

									<td class="px-4 py-3 align-middle">
										<a
											href={file.url}
											target="_blank"
											rel="noreferrer"
											class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
										>
											<Link2 class="h-3 w-3" />
											<span class="truncate max-w-[260px]">{file.url}</span>
										</a>
									</td>

									<td class="px-4 py-3 align-middle text-right">
										<form method="POST" action="?/delete" class="inline-block">
											<input type="hidden" name="src" value={file.url} />
											<input type="hidden" name="visitId" value={file.visitId} />
											<input type="hidden" name="field" value={file.field} />

											<button
												type="submit"
												on:click={confirmAndSubmit}
												class="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 hover:text-rose-900"
											>
												<Trash2 class="h-3 w-3" />
												Delete
											</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 flex justify-between items-center">
					<span>Total files: {files.length}</span>
					<span>Deleting a file is irreversible.</span>
				</div>
			</div>
		{/if}
	</div>
</div>
