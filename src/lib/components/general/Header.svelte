<!-- src/lib/components/general/Header.svelte -->
<script lang="ts">
	import { Menu, LogOut } from '@lucide/svelte';
	import { navigating } from '$app/stores';

	let { user } = $props();
	let isNavOpen = $state(false);

	const links = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/participants', label: 'Participants' },
		{ href: '/visits', label: 'Visits' }
	];
</script>

{#if user}
	<header class="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
		<div class="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6">
			<div class="flex h-14 items-center justify-between">
				<!-- Brand -->
				<a href="/" class="text-base sm:text-lg font-semibold text-slate-900">SAM-CHF</a>

				<!-- Desktop menu -->
				<nav class="hidden md:flex items-center gap-4 text-sm">
					{#each links as link}
						<a
							href={link.href}
							class="rounded-full px-3 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
						>
							{link.label}
						</a>
					{/each}

					<!-- Logout -->
					<a
						href="/logout"
						class="rounded-full px-3 py-1 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-1"
					>
						<LogOut class="w-4 h-4" />
						Logout
					</a>
				</nav>

				<!-- Mobile hamburger (no border) -->
				<button
					type="button"
					class="md:hidden rounded-full p-1.5 text-slate-700 hover:bg-slate-100"
					onclick={() => (isNavOpen = !isNavOpen)}
				>
					<Menu class="w-5 h-5" />
				</button>
			</div>

			<!-- Mobile unified dropdown -->
			{#if isNavOpen}
				<nav class="md:hidden py-2 space-y-1 text-sm">
					{#each links as link}
						<a
							href={link.href}
							class="block rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
							onclick={() => (isNavOpen = false)}
						>
							{link.label}
						</a>
					{/each}

					<!-- Logout -->
					<a
						href="/logout"
						class="flex items-center gap-2 rounded-lg px-3 py-2 text-red-600 hover:bg-red-50"
						onclick={() => (isNavOpen = false)}
					>
						<LogOut class="w-4 h-4" />
						Logout
					</a>
				</nav>
			{/if}
		</div>

		<!-- Emerald animated bottom loader while navigating -->
		{#if $navigating}
			<div class="relative h-0.5 overflow-hidden">
				<div class="absolute inset-y-0 left-0 w-1/3 bg-emerald-500 animate-nav-loader" />
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
			transform: translateX(100%);
		}
		100% {
			transform: translateX(-100%);
		}
	}

	.animate-nav-loader {
		animation: nav-loader 1.1s ease-in-out infinite;
	}
</style>
