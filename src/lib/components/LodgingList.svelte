<script lang="ts">
	import { KIND_META } from "$lib/content";
	import { formatCrowns } from "$lib/booking/logic";
	import type { Lodging } from "$lib/booking/types";
	import LodgingGlyph from "$lib/components/LodgingGlyph.svelte";

	type Props = {
		lodgings: Lodging[];
		totalCount: number;
		selectedId: string | null;
		occupiedIds: ReadonlySet<string>;
		onSelect: (id: string) => void;
		onReset: () => void;
	};

	let { lodgings, totalCount, selectedId, occupiedIds, onSelect, onReset }: Props = $props();
</script>

<section class="lodging-list panel" aria-labelledby="lodging-title">
	<div class="list-head">
		<div>
			<p class="eyebrow">Реестр</p>
			<h2 id="lodging-title">Места на карте</h2>
		</div>
		<p class="list-count" aria-live="polite">{lodgings.length} из {totalCount}</p>
	</div>

	{#if lodgings.length === 0}
		<div class="empty" role="status">
			<span class="empty-mark" aria-hidden="true">⌕</span>
			<strong>Ничего не найдено</strong>
			<p>Под эти фильтры не подходит ни одно место. Уменьшите число гостей или поднимите верхнюю цену.</p>
			<button type="button" class="btn btn-small" onclick={onReset}>Сбросить фильтры</button>
		</div>
	{:else}
		<ul class="list">
			{#each lodgings as lodging (lodging.id)}
				{@const occupied = occupiedIds.has(lodging.id)}
				{@const selected = lodging.id === selectedId}
				<li>
					<button
						type="button"
						class="row"
						class:selected
						class:occupied
						aria-pressed={selected}
						aria-disabled={occupied}
						onclick={() => onSelect(lodging.id)}
					>
						<span class="glyph" aria-hidden="true">
							<LodgingGlyph kind={lodging.kind} size={22} />
						</span>
						<span class="row-main">
							<span class="row-title">
								<strong>{lodging.name}</strong>
								<span class="badge" class:badge-occupied={occupied} class:badge-selected={selected && !occupied} class:badge-free={!occupied && !selected}>
									{occupied ? "Занято" : selected ? "Выбрано" : "Свободно"}
								</span>
							</span>
							<span class="row-sub">{KIND_META[lodging.kind].label} · {lodging.region}</span>
							<span class="row-meta">
								<span>до {lodging.capacity} гостей</span>
								<span class="price">{formatCrowns(lodging.pricePerNight)} <small>/ ночь</small></span>
							</span>
							<span class="amenities" aria-hidden="true">
								{#each lodging.amenities as amenity (amenity)}
									<span>{amenity}</span>
								{/each}
							</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.lodging-list {
		padding: 1rem;
	}

	.list-head {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin-block-end: 0.8rem;
	}

	.list-head h2 {
		margin-block-start: 0.2rem;
		font-size: 1.45rem;
	}

	.list-count {
		font-family: var(--f-mono);
		font-size: 0.7rem;
		color: var(--muted);
		white-space: nowrap;
	}

	.list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
		gap: 0.55rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.7rem;
		inline-size: 100%;
		padding: 0.65rem;
		text-align: start;
		color: inherit;
		background: transparent;
		border: 1px solid transparent;
		cursor: pointer;
		transition:
			background-color var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}

	.row:hover {
		background: rgba(228, 180, 114, 0.05);
		border-color: var(--line);
	}

	.row.selected {
		background: var(--gold-soft);
		border-color: var(--gold);
	}

	.row.occupied {
		opacity: 0.62;
		cursor: not-allowed;
	}

	.row.occupied:hover {
		background: rgba(232, 137, 127, 0.05);
		border-color: rgba(232, 137, 127, 0.35);
	}

	.glyph {
		display: grid;
		place-items: center;
		inline-size: 2.35rem;
		block-size: 2.35rem;
		color: var(--gold);
		background: var(--bg-deep);
		border: 1px solid var(--line);
	}

	.row.selected .glyph {
		color: #1b1106;
		background: var(--gold);
		border-color: var(--gold-bright);
	}

	.row.occupied .glyph {
		color: var(--faint);
		border-color: rgba(110, 99, 87, 0.5);
	}

	.row-main {
		display: grid;
		gap: 0.15rem;
		min-inline-size: 0;
	}

	.row-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.row-title strong {
		overflow: hidden;
		font-family: var(--f-serif);
		font-size: 1.02rem;
		font-weight: 400;
		color: var(--ink-strong);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-sub {
		overflow: hidden;
		font-size: 0.72rem;
		color: var(--muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-meta {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		font-family: var(--f-mono);
		font-size: 0.66rem;
		color: var(--faint);
	}

	.price {
		color: var(--gold-bright);
		white-space: nowrap;
	}

	.price small {
		font-size: 0.58rem;
		color: var(--faint);
	}

	.amenities {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.35rem;
		font-size: 0.62rem;
		color: var(--faint);
	}

	.amenities span::after {
		content: "·";
		margin-inline-start: 0.35rem;
		color: var(--line-strong);
	}

	.amenities span:last-child::after {
		content: "";
	}

	.empty {
		display: grid;
		justify-items: start;
		gap: 0.4rem;
		padding: 1.2rem 0.4rem 0.6rem;
	}

	.empty-mark {
		font-size: 1.6rem;
		color: var(--gold-dim);
	}

	.empty strong {
		font-family: var(--f-serif);
		font-size: 1.15rem;
		font-weight: 400;
		color: var(--ink-strong);
	}

	.empty p {
		font-size: 0.82rem;
		line-height: 1.45;
		color: var(--muted);
	}

	.empty .btn {
		margin-block-start: 0.4rem;
	}
</style>
