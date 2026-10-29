<script lang="ts">
	import {
		FILTER_MAX_GUESTS,
		FILTER_MAX_PRICE,
		FILTER_MIN_GUESTS,
		FILTER_MIN_PRICE
	} from "$lib/content";
	import type { LodgingFilters } from "$lib/booking/types";

	type Props = {
		filters: LodgingFilters;
		resultCount: number;
		totalCount: number;
		onChange: (next: LodgingFilters) => void;
		onReset: () => void;
	};

	let { filters, resultCount, totalCount, onChange, onReset }: Props = $props();

	const guestOptions = Array.from(
		{ length: FILTER_MAX_GUESTS - FILTER_MIN_GUESTS + 1 },
		(_, index) => FILTER_MIN_GUESTS + index
	);

	const isDefault = $derived(
		filters.guests === FILTER_MIN_GUESTS && filters.maxPrice === FILTER_MAX_PRICE
	);
</script>

<section class="filters panel" aria-labelledby="filters-title">
	<div class="filters-title-group">
		<p class="eyebrow">Отбор</p>
		<h2 id="filters-title">Фильтры</h2>
	</div>

	<div class="field compact-guests">
		<label for="filter-guests">Гостей</label>
		<select
			id="filter-guests"
			value={filters.guests}
			onchange={(event) =>
				onChange({ ...filters, guests: Number(event.currentTarget.value) })}
		>
			{#each guestOptions as guests (guests)}
				<option value={guests}>{guests}</option>
			{/each}
		</select>
	</div>

	<div class="field compact-price">
		<div class="price-head">
			<label for="filter-price">Цена за ночь</label>
			<output for="filter-price">до {filters.maxPrice} крон</output>
		</div>
		<input
			id="filter-price"
			type="range"
			min={FILTER_MIN_PRICE}
			max={FILTER_MAX_PRICE}
			step="1"
			value={filters.maxPrice}
			aria-valuetext={`до ${filters.maxPrice} крон`}
			oninput={(event) =>
				onChange({ ...filters, maxPrice: Number(event.currentTarget.value) })}
		/>
	</div>

	<p class="filters-count" aria-live="polite">
		<strong>{resultCount}</strong> из {totalCount}
	</p>

	<button type="button" class="btn btn-small" disabled={isDefault} onclick={onReset}>
		Сбросить
	</button>
</section>

<style>
	.filters {
		display: flex;
		align-items: start;
		flex-wrap: wrap;
		gap: 0.75rem 1.1rem;
		padding: 0.7rem 0.85rem;
	}

	.filters-title-group {
		display: grid;
		align-content: start;
		min-inline-size: 6.2rem;
	}

	.filters-title-group h2 {
		margin-block-start: 0.12rem;
		font-size: 1.2rem;
		line-height: 1;
	}

	.filters-title-group .eyebrow {
		font-size: 0.58rem;
	}

	.compact-guests {
		inline-size: 5.4rem;
	}

	.compact-guests select {
		min-block-size: 2.2rem;
		padding: 0.35rem 0.55rem;
	}

	.compact-price {
		flex: 1 1 16rem;
		min-inline-size: 13rem;
	}

	.price-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.price-head label {
		font-family: var(--f-mono);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
		line-height: 1.6;
	}

	.price-head output {
		font-family: var(--f-mono);
		font-size: 0.64rem;
		color: var(--gold-bright);
		white-space: nowrap;
	}

	input[type="range"] {
		inline-size: 100%;
		block-size: 2.2rem;
		margin: 0;
		accent-color: var(--gold);
		cursor: pointer;
	}

	.filters-count {
		align-self: end;
		margin-inline-start: auto;
		padding-block-end: 0.55rem;
		font-family: var(--f-mono);
		font-size: 0.68rem;
		color: var(--muted);
		white-space: nowrap;
	}

	.filters > .btn {
		align-self: end;
	}

	.filters-count strong {
		font-size: 1rem;
		font-weight: 400;
		color: var(--gold);
	}

	@media (max-width: 700px) {
		.filters {
			display: grid;
			grid-template-columns: 5.4rem minmax(0, 1fr);
			align-items: start;
			gap: 0.55rem 0.7rem;
		}

		.filters-title-group {
			grid-column: 1 / -1;
		}

		.compact-price {
			min-inline-size: 0;
		}

		.filters-count {
			grid-column: 1;
			align-self: center;
			margin-inline-start: 0;
			padding-block-end: 0;
		}

		.filters > .btn {
			grid-column: 2;
			justify-self: end;
			padding-inline: 0.6rem;
		}
	}
</style>
