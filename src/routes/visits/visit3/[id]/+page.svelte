<!-- src/routes/visits/visit3/[id]/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';
	import { fly } from 'svelte/transition';
	import VisitHeader from '$lib/components/visits/VisitHeader.svelte';
	import VisitConclusion from '$lib/components/visits/VisitConclusion.svelte';
	import VisitScheduling from '$lib/components/visits/VisitScheduling.svelte';
	import VisitEfficacyLabs from '$lib/components/visits/VisitEfficacyLabs.svelte';
	import VisitBloodCollection from '$lib/components/visits/VisitBloodCollection.svelte';
	import VisitPrescription from '$lib/components/visits/VisitPrescription.svelte';

	let { data }: PageProps = $props();
	let visit = $state(data.visit);
	let participant = $state(data.participant);
</script>
<div class="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
	<div
		class="fixed top-0 left-0 right-0 h-64 bg-gradient-to-b from-white to-slate-50 -z-10 pointer-events-none"
	></div>

	<div class="max-w-2xl mx-auto pt-10 px-6">
		<VisitHeader {participant} {visit} />

		<div class="space-y-8">
			<!-- OPD Scheduling (Visit 2) -->
			<section in:fly={{ y: 20, delay: 100, duration: 600 }}>
				<VisitScheduling {visit}/>
			</section>
			<section in:fly={{ y: 20, delay: 100, duration: 600 }}>
				<VisitBloodCollection {visit} />
			</section>
			<section in:fly={{ y: 20, delay: 100, duration: 600 }}>
				<VisitPrescription {visit} {participant} />
			</section>
			<section in:fly={{ y: 20, delay: 210, duration: 600 }}>
				<VisitEfficacyLabs
					bind:visit
					{participant}
					sectionSubtitle="GSH,TNF ALPHA, IL6, SAM-e, SAH, 5-MC, Homocysteine"
				/>
			</section>

			<!-- VISIT CONCLUSION FOR VISIT 2 (reusable component) -->
			<section in:fly={{ y: 20, delay: 260, duration: 600 }}>
				<VisitConclusion
					bind:visit
					labelVisit="Visit 3"
					nextVisitNumber={4}
					description="By default, Visit 3 will be marked completed with today’s date. You may optionally override the visit date below. Completing this visit will also create Visit 4 as per protocol."
				/>
			</section>
		</div>
	</div>

</div>