<script lang="ts">
	import { formatBookingDate, formatCrowns, nightsWord } from "$lib/booking/logic";
	import type { Booking } from "$lib/booking/types";

	type Props = {
		bookings: Booking[];
		loaded: boolean;
		onCancel: (id: string) => void;
		onReset: () => void;
	};

	let { bookings, loaded, onCancel, onReset }: Props = $props();
</script>

<section id="bookings" class="bookings panel" aria-labelledby="bookings-title">
	<div class="bookings-head">
		<div>
			<p class="eyebrow">Личный реестр</p>
			<h2 id="bookings-title">Мои брони</h2>
		</div>
		<p class="bookings-count" aria-live="polite">
			{bookings.length}
			{bookings.length === 1 ? " запись" : bookings.length >= 2 && bookings.length <= 4 ? " записи" : " записей"}
		</p>
	</div>

	{#if !loaded}
		<p class="loading" role="status">Читаем сохранённые брони в этом браузере…</p>
	{:else if bookings.length === 0}
		<div class="empty">
			<span class="empty-mark" aria-hidden="true">✧</span>
			<strong>Пока ни одной брони</strong>
			<p>
				Выберите место на карте, укажите гостей и ночи, затем подтвердите бронь. Запись появится
				здесь и переживёт обновление страницы.
			</p>
			<a class="btn btn-small" href="#map">Перейти к карте</a>
		</div>
	{:else}
		<ul class="booking-grid">
			{#each bookings as booking (booking.id)}
				<li class="booking-card">
					<div class="card-top">
						<span class="number">{booking.number}</span>
						<time datetime={booking.createdAt}>{formatBookingDate(booking.createdAt)}</time>
					</div>
					<h3>{booking.lodgingName}</h3>
					<dl class="card-stats">
						<div>
							<dt>Гости</dt>
							<dd>{booking.guests}</dd>
						</div>
						<div>
							<dt>Ночи</dt>
							<dd>{booking.nights} {nightsWord(booking.nights)}</dd>
						</div>
						<div class="card-total">
							<dt>Сумма</dt>
							<dd>{formatCrowns(booking.total)}</dd>
						</div>
					</dl>
					<button
						type="button"
						class="btn btn-small cancel"
						aria-label={`Отменить бронь ${booking.number} — ${booking.lodgingName}`}
						onclick={() => onCancel(booking.id)}
					>
						Отменить бронь
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="bookings-foot">
		<p>
			<strong>Учебное демо.</strong> Бронирования сохраняются только в этом браузере, реальная бронь
			и оплата не оформляются.
		</p>
		<button type="button" class="btn btn-small" disabled={!loaded} onclick={onReset}>
			Сбросить демо
		</button>
	</div>
</section>

<style>
	.bookings {
		padding: 1.15rem;
	}

	.bookings-head {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin-block-end: 0.9rem;
	}

	.bookings-head h2 {
		margin-block-start: 0.2rem;
		font-size: clamp(1.6rem, 3vw, 2.1rem);
	}

	.bookings-count {
		font-family: var(--f-mono);
		font-size: 0.7rem;
		color: var(--muted);
		white-space: nowrap;
	}

	.loading {
		padding: 0.8rem 0;
		font-size: 0.84rem;
		color: var(--muted);
	}

	.empty {
		display: grid;
		justify-items: start;
		gap: 0.4rem;
		padding: 0.5rem 0 0.9rem;
	}

	.empty-mark {
		font-size: 1.8rem;
		line-height: 1;
		color: var(--gold-dim);
	}

	.empty strong {
		font-family: var(--f-serif);
		font-size: 1.2rem;
		font-weight: 400;
		color: var(--ink-strong);
	}

	.empty p {
		max-inline-size: 62ch;
		font-size: 0.86rem;
		line-height: 1.5;
		color: var(--muted);
	}

	.empty .btn {
		margin-block-start: 0.35rem;
	}

	.booking-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
		gap: 0.7rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.booking-card {
		display: grid;
		gap: 0.45rem;
		align-content: start;
		padding: 0.8rem;
		background:
			linear-gradient(145deg, rgba(228, 180, 114, 0.06), transparent 42%),
			var(--bg-deep);
		border: 1px solid var(--line);
	}

	.card-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.number {
		font-family: var(--f-mono);
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		color: var(--gold);
	}

	.card-top time {
		font-family: var(--f-mono);
		font-size: 0.6rem;
		color: var(--faint);
	}

	.booking-card h3 {
		font-size: 1.2rem;
	}

	.card-stats {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		gap: 0.55rem;
		margin: 0.1rem 0 0.2rem;
		padding-block: 0.45rem;
		border-block: 1px solid var(--line);
	}

	.card-stats div {
		display: grid;
		gap: 0.05rem;
	}

	.card-stats dt {
		font-family: var(--f-mono);
		font-size: 0.55rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--faint);
	}

	.card-stats dd {
		margin: 0;
		font-size: 0.78rem;
		color: var(--ink);
	}

	.card-total {
		justify-items: end;
		text-align: end;
	}

	.card-total dd {
		font-family: var(--f-serif);
		font-size: 1rem;
		color: var(--gold-bright);
	}

	.cancel {
		justify-self: start;
		margin-block-start: 0.15rem;
		color: var(--error);
		border-color: rgba(232, 137, 127, 0.38);
	}

	.cancel:hover {
		color: #ffd8d3;
		background: var(--error-bg);
		border-color: var(--error);
	}

	.bookings-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-block-start: 0.9rem;
		padding-block-start: 0.75rem;
		border-top: 1px solid var(--line);
	}

	.bookings-foot p {
		max-inline-size: 72ch;
		font-size: 0.72rem;
		line-height: 1.4;
		color: var(--faint);
	}

	.bookings-foot strong {
		color: var(--muted);
		font-weight: 400;
	}

	@media (max-width: 640px) {
		.bookings-foot {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
