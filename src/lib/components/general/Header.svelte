<script lang="ts">
	import { navigating } from '$app/stores';
	import { LogOut, Menu, Search, Calendar, Table } from '@lucide/svelte';

	let { user } = $props();
	let isNavOpen = $state(false);

	function toggleMenu() {
		isNavOpen = !isNavOpen;
	}

	function closeMenu() {
		isNavOpen = false;
	}
</script>

{#if user}
	<header class="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
		<div class="mx-auto px-3 sm:px-4 lg:px-6">
			<div class="flex h-14 items-center justify-between">
				<!-- Brand -->
				<a href="/" class="text-base font-mono text-slate-900">SAM-CHF</a>

				<!-- Right side: Icons -->
				<div class="flex items-center gap-2">
					<!-- Calendar icon that navigates to / -->
					<a
						href="/"
						class="inline-flex items-center justify-center rounded-full p-1.5 text-slate-700 hover:bg-slate-100 transition-colors"
						aria-label="Home"
					>
						<Calendar class="w-5 h-5" />
					</a>

					

					<!-- Masterchart icon that navigates to /masterchart -->
					<a
						href="/masterchart"
						class="inline-flex items-center justify-center rounded-full p-1.5 text-slate-700 hover:bg-slate-100 transition-colors"
						aria-label="Master chart"
					>
						<!-- You can replace this with an appropriate icon for Masterchart -->
						<Table class="w-5 h-5" />
					</a>
					<!-- Search icon that navigates to /participants -->
					<a
						href="/participants"
						class="inline-flex items-center justify-center rounded-full p-1.5 text-slate-700 hover:bg-slate-100 transition-colors"
						aria-label="Search participants"
					>
						<Search class="w-5 h-5" />
					</a>
					<!-- Menu icon that opens dropdown with only Logout -->
					<button
						type="button"
						class="rounded-full p-1.5 text-slate-700 hover:bg-slate-100 transition-colors"
						onclick={toggleMenu}
						aria-label="Menu"
					>
						<Menu class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Unified dropdown (desktop + mobile): only Logout -->
			{#if isNavOpen}
				<nav class="py-2 text-sm">
					<a
						href="/logout"
						class="flex items-center gap-2 rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 transition-colors"
						onclick={closeMenu}
					>
						<LogOut class="w-4 h-4" />
						<span>Logout</span>
					</a>
				</nav>
			{/if}
		</div>

		<!-- Emerald animated bottom loader while navigating -->
		{#if $navigating}
			<div class="relative h-0.5 overflow-hidden w-full">
				<div class="absolute inset-y-0 left-0 w-1/3 bg-emerald-500 animate-nav-loader"></div>
			</div>
		{/if}
	</header>
{/if}

<style>
	@keyframes nav-loader {
		0% {
			transform: translateX(-100%);
		}
		50% {
			transform: translateX(400%);
		}
		100% {
			transform: translateX(-100%);
		}
	}

	.animate-nav-loader {
		animation: nav-loader 2s ease-in-out infinite;
	}
</style>
