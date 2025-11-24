<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import type { ActionData } from './$types';

	export let form: ActionData;
</script>

<div class="min-h-screen flex items-center justify-center bg-slate-50">
	<div class="w-full max-w-md bg-white shadow-md rounded-xl p-6 border border-slate-200">
		<h1 class="text-xl font-semibold text-slate-900 mb-4">Sign in</h1>
		<p class="text-sm text-slate-600 mb-6">
			Use the email and password given to you by the study admin.
		</p>

		{#if form?.error}
			<div class="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
				{form.error}
			</div>
		{/if}

		<form method="POST" class="space-y-4">
			<div class="space-y-1">
				<label for="email" class="block text-sm font-medium text-slate-700">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					class="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
					value={form?.email ?? ''}
				/>
			</div>

			<div class="space-y-1">
				<label for="password" class="block text-sm font-medium text-slate-700">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					class="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
				/>
			</div>

			<button
				type="submit"
				class="w-full mt-2 inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
			>
				Sign in
			</button>
		</form>
	</div>
</div>
