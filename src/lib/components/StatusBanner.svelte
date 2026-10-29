<script lang="ts">
	type Tone = "ok" | "info" | "error";

	type Props = {
		tone?: Tone;
		text: string;
		onClose?: () => void;
	};

	let { tone = "info", text, onClose }: Props = $props();
</script>

<div class="status-banner" class:ok={tone === "ok"} class:error={tone === "error"} role={tone === "error" ? "alert" : "status"}>
	<span class="status-mark" aria-hidden="true">{tone === "ok" ? "✓" : tone === "error" ? "!" : "i"}</span>
	<p>{text}</p>
	{#if onClose}
		<button type="button" class="status-close" aria-label="Закрыть сообщение" onclick={onClose}>×</button>
	{/if}
</div>

<style>
	.status-banner {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: start;
		gap: 0.55rem;
		padding: 0.6rem 0.7rem;
		font-size: 0.82rem;
		line-height: 1.45;
		color: var(--ink);
		background: rgba(228, 180, 114, 0.08);
		border: 1px solid var(--line-strong);
	}

	.status-banner.ok {
		color: var(--ok);
		background: var(--ok-bg);
		border-color: rgba(169, 201, 154, 0.4);
	}

	.status-banner.error {
		color: #f0b0a8;
		background: var(--error-bg);
		border-color: rgba(232, 137, 127, 0.45);
	}

	.status-mark {
		display: grid;
		place-items: center;
		inline-size: 1.15rem;
		block-size: 1.15rem;
		margin-block-start: 0.05rem;
		font-family: var(--f-mono);
		font-size: 0.68rem;
		color: #15100a;
		background: var(--gold);
		border-radius: 50%;
	}

	.status-banner.ok .status-mark {
		background: var(--ok);
	}

	.status-banner.error .status-mark {
		background: var(--error);
	}

	.status-banner p {
		margin: 0;
	}

	.status-close {
		display: grid;
		place-items: center;
		inline-size: 1.4rem;
		block-size: 1.4rem;
		padding: 0;
		font-size: 1rem;
		line-height: 1;
		color: currentColor;
		background: transparent;
		border: 0;
		cursor: pointer;
		opacity: 0.75;
	}

	.status-close:hover {
		opacity: 1;
	}
</style>
