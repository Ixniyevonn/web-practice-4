<script lang="ts">
	import type { LodgingKind } from "$lib/booking/types";

	let { kind, size = 20 }: { kind: LodgingKind; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if kind === "inn"}
		<path d="M3 10.5 12 4l9 6.5" />
		<path d="M5 9.5V20h14V9.5" />
		<path d="M9.5 20v-5.5h5V20" />
		<path d="M8 12.5h1M15 12.5h1" />
	{:else if kind === "cabin"}
		<path d="M3.5 11 12 4l8.5 7" />
		<path d="M5 10v10h14V10" />
		<path d="M9 20v-4.5h6V20" />
		<path d="M16.5 6.5V3.5h2v5" />
	{:else if kind === "tower"}
		<path d="M7 21V8h10v13" />
		<path d="M5 8h14" />
		<path d="M8 8V5h2v3M14 8V5h2v3" />
		<path d="M10 21v-5h4v5" />
		<path d="M10.5 11.5h3" />
	{:else}
		<path d="M12 3 3.5 20h17L12 3Z" />
		<path d="M12 3v17" />
		<path d="m6.5 15 5.5 0M12 15l5.5 0" />
	{/if}
</svg>
