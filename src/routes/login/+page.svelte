<script lang="ts">
	import type { ActionData } from './$types';

	export let form: ActionData;
</script>

<div class="relative min-h-screen flex flex-col items-center justify-center bg-slate-50 overflow-hidden">
    
    <div class="absolute inset-0 z-0">
        <div class="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-emerald-100/40 blur-3xl"></div>
        <div class="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-50/50 blur-3xl"></div>
    </div>

	<div class="relative z-10 w-full max-w-[400px] px-4">
        
        <div class="mb-8 text-center">
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08v0c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.18 1.1L12 5Z"/></svg>
            </div>
            <h1 class="text-lg font-bold tracking-tight text-slate-900">SAM-CHF</h1>
            <p class="text-sm font-medium text-slate-500">Trial Dashboard</p>
        </div>

        <div class="bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl border border-white/20 p-8">
            <div class="mb-6">
                <h2 class="text-xl font-semibold text-slate-800">Welcome back</h2>
                <p class="text-sm text-slate-500 mt-1">Please enter your credentials to access the study data.</p>
            </div>

			{#if form?.error}
				<div class="mb-6 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                    <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
					{form.error}
				</div>
			{/if}

			<form method="POST" class="space-y-5">
				<div class="space-y-1.5">
					<label for="email" class="block text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Email</label>
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                        </div>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            placeholder="investigator@hospital.com"
                            class="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:outline-none"
                            value={form?.email ?? ''}
                        />
                    </div>
				</div>

				<div class="space-y-1.5">
					<label for="password" class="block text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Password</label>
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            placeholder="••••••••"
                            class="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:outline-none"
                        />
                    </div>
				</div>

				<button
					type="submit"
					class="w-full mt-2 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-[0.98]"
				>
					Sign In to Dashboard
				</button>
			</form>
		</div>

        <p class="mt-8 text-center text-xs text-slate-400">
            &copy; 2025 SAM-CHF Study Group. All rights reserved. <br>
            Secure Clinical Data Environment.
        </p>
	</div>
</div>