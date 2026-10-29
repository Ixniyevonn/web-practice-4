<script lang="ts">
	import { onMount } from "svelte";
	import { base } from "$app/paths";
	import {
		DEMO_NOTE,
		FILTER_MAX_PRICE,
		FILTER_MIN_GUESTS,
		FLATRIA_BOUNDS,
		LODGINGS,
		MAP_IMAGE
	} from "$lib/content";
	import {
		bookingNumber,
		filterLodgings,
		formatCrowns,
		isOccupied,
		parseInteger,
		nightsWord,
		validateDraft
	} from "$lib/booking/logic";
	import { clearBookings, loadBookings, saveBookings } from "$lib/booking/storage";
	import type {
		Booking,
		BookingDraft,
		BookingErrors,
		LodgingFilters
	} from "$lib/booking/types";
	import SiteHeader from "$lib/components/SiteHeader.svelte";
	import SiteFooter from "$lib/components/SiteFooter.svelte";
	import MapStage from "$lib/components/MapStage.svelte";
	import Filters from "$lib/components/Filters.svelte";
	import LodgingList from "$lib/components/LodgingList.svelte";
	import BookingPanel from "$lib/components/BookingPanel.svelte";
	import BookingsPanel from "$lib/components/BookingsPanel.svelte";
	import StatusBanner from "$lib/components/StatusBanner.svelte";

	const DEFAULT_FILTERS: LodgingFilters = {
		guests: FILTER_MIN_GUESTS,
		maxPrice: FILTER_MAX_PRICE
	};

	let bookings = $state<Booking[]>([]);
	let loaded = $state(false);
	let selectedId = $state<string | null>(null);
	let filters = $state<LodgingFilters>({ ...DEFAULT_FILTERS });
	let draft = $state<BookingDraft>({ guests: 2, nights: 2 });
	let errors = $state<BookingErrors>({});
	let submitting = $state(false);
	let storageNotice = $state<string | null>(null);
	let flash = $state<{ tone: "ok" | "info" | "error"; text: string } | null>(null);

	const filtered = $derived(filterLodgings(LODGINGS, filters));
	const occupiedIds = $derived(
		new Set(LODGINGS.filter((lodging) => isOccupied(lodging, bookings)).map((lodging) => lodging.id))
	);
	const selected = $derived(LODGINGS.find((lodging) => lodging.id === selectedId) ?? null);
	const freeCount = $derived(LODGINGS.length - occupiedIds.size);
	const imageSrc = $derived(`${base}${MAP_IMAGE.src}`);
	const bookingLabel = $derived(
		bookings.length === 1
			? "1 запись"
			: bookings.length >= 2 && bookings.length <= 4
				? `${bookings.length} записи`
				: `${bookings.length} записей`
	);

	onMount(() => {
		const result = loadBookings();
		const known = new Set(LODGINGS.map((lodging) => lodging.id));
		const seeded = new Set(
			LODGINGS.filter((lodging) => lodging.initiallyOccupied).map((lodging) => lodging.id)
		);
		const seen = new Set<string>();
		let skipped = 0;
		const valid = result.bookings.filter((booking) => {
			if (!known.has(booking.lodgingId) || seeded.has(booking.lodgingId) || seen.has(booking.lodgingId)) {
				skipped += 1;
				return false;
			}
			seen.add(booking.lodgingId);
			return true;
		});
		bookings = valid;
		storageNotice =
			result.error ??
			(skipped > 0
				? "Часть сохранённых броней ссылалась на занятые или неизвестные места и была пропущена."
				: null);
		loaded = true;
	});

	$effect(() => {
		if (!selectedId) return;
		if (!filtered.some((lodging) => lodging.id === selectedId)) {
			selectedId = null;
			flash = {
				tone: "info",
				text: "Выбранное место скрыто фильтром, поэтому выбор сброшен. Измените фильтры или выберите другое место."
			};
		}
	});

	$effect(() => {
		const id = selectedId;
		if (!id) return;
		const lodging = LODGINGS.find((candidate) => candidate.id === id);
		if (!lodging) return;
		draft = { guests: Math.min(2, lodging.capacity), nights: 2 };
		errors = {};
	});

	function selectLodging(id: string): void {
		const lodging = LODGINGS.find((candidate) => candidate.id === id);
		if (!lodging) return;
		if (isOccupied(lodging, bookings)) {
			flash = {
				tone: "error",
				text: `«${lodging.name}» занято. Отмените бронь в разделе «Мои брони» или выберите свободное место.`
			};
			return;
		}
		if (selectedId === id) {
			selectedId = null;
			return;
		}
		selectedId = id;
		flash = null;
	}

	function clearSelection(): void {
		selectedId = null;
		errors = {};
	}

	function changeFilters(next: LodgingFilters): void {
		filters = next;
	}

	function resetFilters(): void {
		filters = { ...DEFAULT_FILTERS };
	}

	function updateDraft(next: BookingDraft): void {
		draft = next;
		if (errors.guests || errors.nights || errors.form) errors = {};
	}

	function makeId(): string {
		try {
			return crypto.randomUUID();
		} catch {
			return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		}
	}

	function confirmBooking(): void {
		if (submitting) return;
		const lodging = selected;
		if (!lodging) {
			errors = { form: "Сначала выберите место на карте или в списке." };
			return;
		}
		if (isOccupied(lodging, bookings)) {
			errors = { form: "Это место уже занято. Выберите другое." };
			selectedId = null;
			return;
		}

		const guests = parseInteger(draft.guests);
		const nights = parseInteger(draft.nights);
		const nextErrors = validateDraft({ guests, nights }, lodging);
		if (Object.keys(nextErrors).length > 0) {
			errors = nextErrors;
			flash = { tone: "error", text: "Проверьте гостей и число ночей — бронь не создана." };
			return;
		}

		submitting = true;
		try {
			const total = lodging.pricePerNight * nights;
			const booking: Booking = {
				id: makeId(),
				number: bookingNumber(),
				lodgingId: lodging.id,
				lodgingName: lodging.name,
				guests,
				nights,
				total,
				createdAt: new Date().toISOString()
			};
			const next = [...bookings, booking];
			bookings = next;
			storageNotice = saveBookings(next);
			errors = {};
			selectedId = null;
			flash = {
				tone: "ok",
				text: `Бронь ${booking.number} создана: «${lodging.name}», ${nights} ${nightsWord(nights)}, ${formatCrowns(total)}. Запись сохранена в этом браузере.`
			};
		} finally {
			submitting = false;
		}
	}

	function cancelBooking(id: string): void {
		const booking = bookings.find((candidate) => candidate.id === id);
		if (!booking) return;
		bookings = bookings.filter((candidate) => candidate.id !== id);
		storageNotice = saveBookings(bookings);
		flash = {
			tone: "ok",
			text: `Бронь ${booking.number} отменена. «${booking.lodgingName}» снова свободно.`
		};
	}

	function resetDemo(): void {
		if (
			!window.confirm(
				"Сбросить все учебные брони? Освободятся места, которые вы бронировали. Два примера занятости останутся."
			)
		)
			return;
		bookings = [];
		selectedId = null;
		errors = {};
		filters = { ...DEFAULT_FILTERS };
		storageNotice = clearBookings();
		flash = { tone: "info", text: "Демо сброшено: брони удалены, фильтры вернулись к началу." };
	}
</script>

<svelte:head>
	<title>Ночлег во Флатрии — интерактивная карта бронирования</title>
</svelte:head>

<SiteHeader bookingCount={bookings.length} />

<main id="top">
	<section class="hero" aria-labelledby="hero-title">
		<div class="hero-grid container">
			<div class="hero-copy">
				<p class="eyebrow">Практика 4 · живой интерфейс</p>
				<h1 id="hero-title">Ночлег <em>во Флатрии</em></h1>
				<p class="lede">
					Выберите место на пергаментной карте Доминиона Флатрия, назначьте гостей и ночи —
					стоимость посчитается сразу, а бронь останется в браузере до отмены.
				</p>
				<div class="hero-actions">
					<a class="btn btn-primary" href="#map">Выбрать место</a>
					<a class="btn" href="#bookings">Мои брони · {bookingLabel}</a>
				</div>
				<p class="demo-note">
					<strong>Учебное демо:</strong> {DEMO_NOTE}
				</p>
			</div>

			<aside class="hero-card" aria-label="Сводка по карте">
				<p class="hero-card-kicker">Доминион Флатрия · реестр</p>
				<p class="hero-count">
					<strong>{freeCount}</strong>
					<span>свободных мест из {LODGINGS.length}</span>
				</p>
				<div class="hero-meter" aria-hidden="true">
					{#each LODGINGS as lodging (lodging.id)}
						<span class:occupied={occupiedIds.has(lodging.id)}></span>
					{/each}
				</div>
				<dl class="hero-stats">
					<div>
						<dt>Ночлег</dt>
						<dd>от {formatCrowns(Math.min(...LODGINGS.map((lodging) => lodging.pricePerNight)))}</dd>
					</div>
					<div>
						<dt>Гостей</dt>
						<dd>до {Math.max(...LODGINGS.map((lodging) => lodging.capacity))}</dd>
					</div>
					<div>
						<dt>Бронь</dt>
						<dd>в браузере</dd>
					</div>
				</dl>
				<p class="hero-card-note">
					Два места заняты примерами. Их нельзя выбрать, пока вы не отмените свою бронь или не
					сбросите демо.
				</p>
			</aside>
		</div>
	</section>

	<div class="filters-bar container">
		<Filters
			{filters}
			resultCount={filtered.length}
			totalCount={LODGINGS.length}
			onChange={changeFilters}
			onReset={resetFilters}
		/>
	</div>

	<section id="map" class="workspace container" aria-label="Карта и бронирование">
		<div class="map-column">
			<MapStage
				lodgings={filtered}
				{selectedId}
				{occupiedIds}
				{imageSrc}
				imageWidth={MAP_IMAGE.width}
				imageHeight={MAP_IMAGE.height}
				imageAlt={MAP_IMAGE.alt}
				bounds={FLATRIA_BOUNDS}
				onSelect={selectLodging}
			/>
		</div>

		<div class="side-column">
			<BookingPanel
				lodging={selected}
				{draft}
				{errors}
				{submitting}
				onDraftChange={updateDraft}
				onConfirm={confirmBooking}
				onClear={clearSelection}
			/>
		</div>
	</section>

	<section class="registry container" aria-label="Реестр мест">
		<LodgingList
			lodgings={filtered}
			totalCount={LODGINGS.length}
			{selectedId}
			{occupiedIds}
			onSelect={selectLodging}
			onReset={resetFilters}
		/>
	</section>

	<section class="container bookings-wrap" aria-label="Мои брони">
		{#if storageNotice}
			<div class="notice">
				<StatusBanner tone="info" text={storageNotice} onClose={() => (storageNotice = null)} />
			</div>
		{/if}
		<BookingsPanel
			{bookings}
			{loaded}
			onCancel={cancelBooking}
			onReset={resetDemo}
		/>
	</section>
</main>

<SiteFooter />

{#if flash}
	<div class="toast-region">
		<StatusBanner tone={flash.tone} text={flash.text} onClose={() => (flash = null)} />
	</div>
{/if}

<p class="sr-only" aria-live="polite">
	{selected ? `Выбрано: ${selected.name}. Карточка места обновлена.` : ""}
</p>

<style>
	.hero {
		position: relative;
		overflow: hidden;
		padding-block: clamp(2.5rem, 6vw, 5.2rem) clamp(2rem, 4vw, 3.2rem);
		border-block-end: 1px solid var(--line);
	}

	.hero::before {
		content: "";
		position: absolute;
		inset: 0;
		z-index: -1;
		background-image:
			linear-gradient(var(--line) 1px, transparent 1px),
			linear-gradient(90deg, var(--line) 1px, transparent 1px);
		background-size: 84px 84px;
		mask-image: radial-gradient(ellipse 70% 85% at 70% 15%, #000 0%, transparent 72%);
		opacity: 0.28;
	}

	.hero::after {
		content: "";
		position: absolute;
		inset-block-start: -12rem;
		inset-inline-end: -8rem;
		z-index: -1;
		inline-size: 34rem;
		block-size: 34rem;
		background: radial-gradient(circle, rgba(228, 180, 114, 0.12), transparent 62%);
		pointer-events: none;
	}

	.hero-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.55fr);
		gap: clamp(1.5rem, 5vw, 4rem);
		align-items: center;
	}

	.hero-copy h1 {
		margin-block: 0.4rem 0.8rem;
		font-size: clamp(3.1rem, 8.2vw, 6.4rem);
		letter-spacing: -0.035em;
		line-height: 0.92;
	}

	.hero-copy h1 em {
		display: block;
		font-style: italic;
		color: var(--gold);
	}

	.lede {
		max-inline-size: 52ch;
		font-size: clamp(0.95rem, 1.5vw, 1.08rem);
		line-height: 1.6;
		color: var(--muted);
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-block: 1.4rem 1rem;
	}

	.demo-note {
		max-inline-size: 62ch;
		padding: 0.55rem 0.7rem;
		font-size: 0.76rem;
		line-height: 1.45;
		color: var(--muted);
		background: rgba(228, 180, 114, 0.055);
		border-inline-start: 2px solid var(--gold-dim);
	}

	.demo-note strong {
		color: var(--gold);
		font-weight: 400;
	}

	.hero-card {
		position: relative;
		padding: 1.1rem;
		background:
			linear-gradient(155deg, rgba(228, 180, 114, 0.08), transparent 45%),
			var(--panel);
		border: 1px solid var(--line-strong);
		box-shadow: var(--shadow);
	}

	.hero-card::before,
	.hero-card::after {
		content: "";
		position: absolute;
		inline-size: 1.1rem;
		block-size: 1.1rem;
		border-color: var(--gold);
		border-style: solid;
		opacity: 0.65;
	}

	.hero-card::before {
		inset-block-start: 0.35rem;
		inset-inline-start: 0.35rem;
		border-width: 1px 0 0 1px;
	}

	.hero-card::after {
		inset-block-end: 0.35rem;
		inset-inline-end: 0.35rem;
		border-width: 0 1px 1px 0;
	}

	.hero-card-kicker {
		font-family: var(--f-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--gold);
	}

	.hero-count {
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
		margin-block: 0.45rem 0.6rem;
	}

	.hero-count strong {
		font-family: var(--f-serif);
		font-size: clamp(2.6rem, 5vw, 3.6rem);
		font-weight: 400;
		line-height: 1;
		color: var(--gold-bright);
	}

	.hero-count span {
		font-size: 0.78rem;
		line-height: 1.35;
		color: var(--muted);
	}

	.hero-meter {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		gap: 0.2rem;
		margin-block-end: 0.8rem;
	}

	.hero-meter span {
		block-size: 0.45rem;
		background: var(--gold);
		opacity: 0.85;
	}

	.hero-meter span.occupied {
		background: var(--faint);
		opacity: 0.45;
	}

	.hero-stats {
		display: grid;
		gap: 0.35rem;
		margin: 0 0 0.75rem;
		padding-block: 0.6rem;
		border-block: 1px solid var(--line);
	}

	.hero-stats div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.hero-stats dt {
		font-family: var(--f-mono);
		font-size: 0.58rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--faint);
	}

	.hero-stats dd {
		margin: 0;
		font-size: 0.8rem;
		color: var(--ink);
		text-align: end;
	}

	.hero-card-note {
		font-size: 0.7rem;
		line-height: 1.4;
		color: var(--faint);
	}

	.filters-bar {
		padding-block: clamp(1.6rem, 4vw, 3rem) 0;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.72fr);
		gap: clamp(1rem, 2.6vw, 1.8rem);
		align-items: start;
		padding-block: clamp(0.9rem, 2vw, 1.4rem) 0;
	}

	.map-column {
		min-inline-size: 0;
	}

	.side-column {
		display: grid;
		gap: 0.9rem;
		min-inline-size: 0;
	}

	.registry {
		padding-block: clamp(1rem, 2.5vw, 1.6rem) 0;
	}

	.bookings-wrap {
		display: grid;
		gap: 0.8rem;
		padding-block: 0.5rem clamp(1.5rem, 4vw, 3rem);
	}

	.notice {
		max-inline-size: 100%;
	}

	.toast-region {
		position: fixed;
		inset-block-end: 1rem;
		inset-inline-end: 1rem;
		z-index: 50;
		inline-size: min(28rem, calc(100vw - 2rem));
	}

	@media (max-width: 980px) {
		.hero-grid {
			grid-template-columns: 1fr;
		}

		.hero-card {
			max-inline-size: 34rem;
		}

		.workspace {
			grid-template-columns: 1fr;
		}

		.side-column {
			order: 2;
		}
	}

	@media (max-width: 560px) {
		.hero {
			padding-block-start: 2rem;
		}

		.hero-copy h1 {
			font-size: clamp(2.8rem, 15vw, 4.2rem);
		}

		.hero-card {
			max-inline-size: none;
		}

		.hero-meter {
			grid-template-columns: repeat(10, 1fr);
		}

		.toast-region {
			inset-inline: 0.5rem;
			inline-size: auto;
		}
	}
</style>
