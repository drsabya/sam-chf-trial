<script lang="ts">
	// Expecting visit with visit_number (or visitNumber) on it
	interface Visit {
		visit_number?: number | null;
		visitNumber?: number | null;
	}

	let { visit }: { visit: Visit } = $props();

	type VialTypeKey = 'purple' | 'yellow';

	type VialConfig = {
		type: VialTypeKey;
		label: string;
	};

	// Colors for each vial type
	const vialStyles: Record<
		VialTypeKey,
		{ color: string; liquidColor: string; capColor: string }
	> = {
		purple: {
			color: '#8b5cf6', // Violet-500
			liquidColor: '#7c3aed', // Violet-600
			capColor: '#6d28d9' // Violet-700
		},
		yellow: {
			color: '#fbbf24', // Amber-400
			liquidColor: '#f59e0b', // Amber-500
			capColor: '#d97706' // Amber-600
		}
	};

	const visitNumber = $derived(
		visit?.visit_number ?? visit?.visitNumber ?? null
	);

	/**
	 * Map visit number -> required vials
	 *
	 * Updates:
	 * - "1–2 ml" is displayed as "2 ml"
	 * - "8 ml" = TWO yellow tubes of 4 ml each (2 × 4 ml)
	 */
	function getVialsForVisit(vn: number | null): VialConfig[] {
		switch (vn) {
			case 1:
			case 5:
				// Routine labs only: 2 ml + 5 ml
				return [
					{ type: 'purple', label: '2 ml' },
					{ type: 'yellow', label: '5 ml' }
				];

			case 2:
			case 3:
				// Cytokine / SAMe panel: 2 ml + (2 × 4 ml = 8 ml)
				return [
					{ type: 'purple', label: '2 ml' }, // instead of 1–2 ml
					{ type: 'yellow', label: '4 ml' },
					{ type: 'yellow', label: '4 ml' } // second tube for total 8 ml
				];

			case 6:
			case 8:
				// Routine + cytokine/SAMe panel:
				// 2 ml + 5 ml + 2 ml + (2 × 4 ml = 8 ml)
				return [
					// Routine
					{ type: 'purple', label: '2 ml' },
					{ type: 'yellow', label: '5 ml' },
					// Cytokine/SAMe
					{ type: 'purple', label: '2 ml' }, // instead of 1–2 ml
					{ type: 'yellow', label: '4 ml' },
					{ type: 'yellow', label: '4 ml' }
				];

			default:
				return [];
		}
	}

	const vials = $derived(getVialsForVisit(visitNumber));
</script>

<div
	class="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden max-w-sm mx-auto font-sans"
>
	<header class="px-6 py-5 border-b border-slate-100 flex justify-center items-center">
		<h3 class="text-lg font-semibold text-slate-800 tracking-tight">
			Blood collection
		</h3>
	</header>

	{#if vials.length === 0}
		<div class="p-8 flex items-center justify-center bg-gradient-to-b from-white to-slate-50/50">
			<p class="text-sm text-slate-500 text-center">
				No blood collection scheduled for this visit.
			</p>
		</div>
	{:else}
		<div
			class="p-8 flex justify-center gap-8 flex-wrap bg-gradient-to-b from-white to-slate-50/50"
		>
			{#each vials as vial, index}
				<div
					class="flex flex-col items-center gap-3 transition-transform duration-200 hover:-translate-y-1"
				>
					<div class="drop-shadow-md">
						<!-- Vial SVG -->
						<svg
							viewBox="0 0 60 160"
							width="60"
							height="160"
							xmlns="http://www.w3.org/2000/svg"
						>
							<defs>
								<!-- Glass Reflection Gradient -->
								<linearGradient
									id={"glass-shine-" + vial.type + '-' + index}
									x1="0%"
									y1="0%"
									x2="100%"
									y2="0%"
								>
									<stop offset="0%" stop-color="white" stop-opacity="0.1" />
									<stop offset="50%" stop-color="white" stop-opacity="0.4" />
									<stop offset="100%" stop-color="white" stop-opacity="0.1" />
								</linearGradient>

								<!-- Liquid Gradient -->
								<linearGradient
									id={"liquid-" + vial.type + '-' + index}
									x1="0%"
									y1="0%"
									x2="0%"
									y2="100%"
								>
									<stop
										offset="0%"
										stop-color={vialStyles[vial.type].color}
									/>
									<stop
										offset="100%"
										stop-color={vialStyles[vial.type].liquidColor}
									/>
								</linearGradient>

								<!-- Drop Shadow for depth -->
								<filter
									id={"shadow-" + vial.type + '-' + index}
									x="-20%"
									y="-10%"
									width="140%"
									height="120%"
								>
									<feGaussianBlur in="SourceAlpha" stdDeviation="2" />
									<feOffset dx="0" dy="2" result="offsetblur" />
									<feComponentTransfer>
										<feFuncA type="linear" slope="0.3" />
									</feComponentTransfer>
									<feMerge>
										<feMergeNode />
										<feMergeNode in="SourceGraphic" />
									</feMerge>
								</filter>
							</defs>

							<!-- Vial Shadow Group -->
							<g filter={"url(#shadow-" + vial.type + '-' + index + ')'}>
								<!-- Main Tube Body (Glass) -->
								<rect
									x="10"
									y="20"
									width="40"
									height="130"
									rx="20"
									ry="20"
									fill="#f8fafc"
									stroke="#cbd5e1"
									stroke-width="1"
								/>

								<!-- Liquid Content -->
								<path
									d="M11 50 H49 V130 A19 19 0 0 1 11 130 Z"
									fill={"url(#liquid-" + vial.type + '-' + index + ')'}
									opacity="0.9"
								/>

								<!-- Label Area -->
								<rect
									x="11"
									y="60"
									width="38"
									height="40"
									fill="white"
									opacity="0.9"
                                />
								<line
									x1="15"
									y1="70"
									x2="45"
									y2="70"
									stroke="#94a3b8"
									stroke-width="2"
								/>
								<line
									x1="15"
									y1="80"
									x2="35"
									y2="80"
									stroke="#cbd5e1"
									stroke-width="2"
								/>
								<line
									x1="15"
									y1="90"
									x2="40"
									y2="90"
									stroke="#cbd5e1"
									stroke-width="2"
								/>

								<!-- Glass Shine Overlay -->
								<rect
									x="10"
									y="20"
									width="40"
									height="130"
									rx="20"
									ry="20"
									fill={"url(#glass-shine-" + vial.type + '-' + index + ')'}
									pointer-events="none"
								/>

								<!-- Cap -->
								<rect
									x="8"
									y="5"
									width="44"
									height="25"
									rx="4"
									ry="4"
									fill={vialStyles[vial.type].capColor}
								/>
								<rect
									x="8"
									y="5"
									width="44"
									height="10"
									rx="4"
									ry="4"
									fill="white"
									fill-opacity="0.2"
								/>

								<!-- Cap ridges -->
								<line
									x1="8"
									y1="12"
									x2="52"
									y2="12"
									stroke="rgba(0,0,0,0.1)"
									stroke-width="1"
								/>
								<line
									x1="8"
									y1="18"
									x2="52"
									y2="18"
									stroke="rgba(0,0,0,0.1)"
									stroke-width="1"
								/>
							</g>
						</svg>
					</div>
					<div class="text-center flex flex-col">
						<span class="font-bold text-slate-700 text-sm">
							{vial.label}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- <footer class="px-6 py-4 bg-slate-50 border-t border-slate-100">
		<div class="flex items-center justify-center gap-2 text-slate-500 text-sm font-medium">
			<svg
				class="w-5 h-5 text-slate-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span></span>
		</div>
	</footer> -->
</div>
