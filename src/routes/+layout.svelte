<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/general/Header.svelte';

	let { children, data } = $props();
	// data.user, data.role, data.session are coming from +layout.server.ts
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Optional: global header that reacts to auth -->
<Header user={data?.user} />

{@render children()}
