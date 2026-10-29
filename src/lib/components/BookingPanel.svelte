<script lang="ts">
	import { KIND_META, NIGHTS_MAX, NIGHTS_MIN } from "$lib/content";
	import { formatCrowns, nightsWord } from "$lib/booking/logic";
	import type { BookingDraft, BookingErrors, Lodging } from "$lib/booking/types";
	import LodgingGlyph from "$lib/components/LodgingGlyph.svelte";

	type Props = {
		lodging: Lodging | null;
		draft: BookingDraft;
		errors: BookingErrors;
		submitting: boolean;
		onDraftChange: (next: BookingDraft) => void;
		onConfirm: () => void;
		onClear: () => void;
	};

	let { lodging, draft, errors, submitting, onDraftChange, onConfirm, onClear }: Props =
		$props();

	const nights = $derived(Number.isInteger(draft.nights) ? draft.nights : 0);
	const total = $derived(lodging && nights > 0 ? lodging.pricePerNight * nights : 0);

	function updateGuests(value: string): void {
		onDraftChange({
			...draft,
			guests: value === "" ? Number.NaN : Number(value)
		});
	}

	function updateNights(value: string): void {
		onDraftChange({
			...draft,
			nights: value === "" ? Number.NaN : Number(value)
		});
	}
</script>

<section class="booking panel" aria-labelledby="booking-title">
	<div class="booking-head">
		<div>
			<p class="eyebrow">Карточка места</p>
			<h2 id="booking-title">{lodging ? lodging.name : "Место не выбрано"}</h2>
		</div>
		{#if lodging}
			<button type="button" class="btn btn-small" onclick={onClear}>Сбросить выбор</button>
		{/if}
	</div>

	{#if !lodging}
		<div class="empty">
			<span class="empty-glyph" aria-hidden="true">◇</span>
			<strong>Выберите ночлег</strong>
			<p>
				Нажмите метку на карте или строку в реестре. Справа появится описание, форма срока и
				итоговая стоимость.
			</p>
			<p class="empty-hint">Выбор работает и с клавиатуры: список — обычные кнопки.</p>
		</div>
	{:else}
		<div class="selected-summary">
			<span class="summary-glyph" aria-hidden="true">
				<LodgingGlyph kind={lodging.kind} size={26} />
			</span>
			<div>
				<p class="summary-kind">{KIND_META[lodging.kind].label} · {lodging.region}</p>
				<p class="summary-price">{formatCrowns(lodging.pricePerNight)} <small>/ ночь</small></p>
			</div>
		</div>

		<p class="description">{lodging.description}</p>

		<dl class="specs">
			<div>
				<dt>Вместимость</dt>
				<dd>до {lodging.capacity} гостей</dd>
			</div>
			<div>
				<dt>Регион</dt>
				<dd>{lodging.region}</dd>
			</div>
			<div>
				<dt>Внутри</dt>
				<dd>{lodging.amenities.join(" · ")}</dd>
			</div>
		</dl>

		<form
			class="booking-form"
			novalidate
			onsubmit={(event) => {
				event.preventDefault();
				onConfirm();
			}}
		>
			<div class="form-grid">
				<div class="field" class:has-error={Boolean(errors.guests)}>
					<label for="booking-guests">Гостей</label>
					<input
						id="booking-guests"
						type="number"
						inputmode="numeric"
						min="1"
						max={lodging.capacity}
						step="1"
						value={Number.isInteger(draft.guests) ? draft.guests : ""}
						aria-invalid={Boolean(errors.guests)}
						aria-describedby={errors.guests ? "booking-guests-error" : "booking-guests-hint"}
						oninput={(event) => updateGuests(event.currentTarget.value)}
					/>
					{#if errors.guests}
						<p class="field-error" id="booking-guests-error" role="alert">{errors.guests}</p>
					{:else}
						<p class="hint" id="booking-guests-hint">от 1 до {lodging.capacity}</p>
					{/if}
				</div>

				<div class="field" class:has-error={Boolean(errors.nights)}>
					<label for="booking-nights">Ночей</label>
					<input
						id="booking-nights"
						type="number"
						inputmode="numeric"
						min={NIGHTS_MIN}
						max={NIGHTS_MAX}
						step="1"
						value={Number.isInteger(draft.nights) ? draft.nights : ""}
						aria-invalid={Boolean(errors.nights)}
						aria-describedby={errors.nights ? "booking-nights-error" : "booking-nights-hint"}
						oninput={(event) => updateNights(event.currentTarget.value)}
					/>
					{#if errors.nights}
						<p class="field-error" id="booking-nights-error" role="alert">{errors.nights}</p>
					{:else}
						<p class="hint" id="booking-nights-hint">от {NIGHTS_MIN} до {NIGHTS_MAX}</p>
					{/if}
				</div>
			</div>

			<div class="total" aria-live="polite">
				<div>
					<p class="total-label">Итого</p>
					<p class="total-formula">
						{#if nights > 0}
							{formatCrowns(lodging.pricePerNight)} × {nights} {nightsWord(nights)}
						{:else}
							Укажите число ночей
						{/if}
					</p>
				</div>
				<p class="total-value">{nights > 0 ? formatCrowns(total) : "—"}</p>
			</div>

			{#if errors.form}
				<p class="field-error form-error" role="alert">{errors.form}</p>
			{/if}

			<button type="submit" class="btn btn-primary confirm" disabled={submitting}>
				{submitting ? "Сохраняем бронь…" : "Подтвердить бронь"}
			</button>
			<p class="form-note">
				Бронь займёт место до отмены. Оплата не проводится, это учебная запись в браузере.
			</p>
		</form>
	{/if}
</section>

<style>
	.booking {
		padding: 1rem;
	}

	.booking-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.8rem;
		margin-block-end: 0.8rem;
	}

	.booking-head h2 {
		margin-block-start: 0.2rem;
		font-size: clamp(1.45rem, 2.4vw, 1.9rem);
	}

	.empty {
		display: grid;
		justify-items: start;
		gap: 0.4rem;
		padding: 0.5rem 0 0.8rem;
	}

	.empty-glyph {
		font-size: 2rem;
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
		font-size: 0.86rem;
		line-height: 1.5;
		color: var(--muted);
	}

	.empty-hint {
		padding-inline-start: 0.8rem;
		border-inline-start: 1px solid var(--line-strong);
		font-family: var(--f-mono);
		font-size: 0.68rem !important;
		letter-spacing: 0.02em;
		color: var(--faint) !important;
	}

	.selected-summary {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.65rem;
		margin-block-end: 0.7rem;
		background: var(--gold-soft);
		border: 1px solid var(--line);
	}

	.summary-glyph {
		display: grid;
		place-items: center;
		inline-size: 2.6rem;
		block-size: 2.6rem;
		color: var(--gold-bright);
		border: 1px solid var(--line-strong);
	}

	.summary-kind {
		font-family: var(--f-mono);
		font-size: 0.64rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.summary-price {
		font-family: var(--f-serif);
		font-size: 1.2rem;
		color: var(--gold-bright);
	}

	.summary-price small {
		font-family: var(--f-mono);
		font-size: 0.6rem;
		color: var(--faint);
	}

	.description {
		margin-block-end: 0.8rem;
		font-size: 0.9rem;
		line-height: 1.55;
		color: var(--ink);
	}

	.specs {
		display: grid;
		gap: 0.35rem;
		margin: 0 0 1rem;
		padding: 0.7rem 0;
		border-block: 1px solid var(--line);
	}

	.specs div {
		display: grid;
		grid-template-columns: 6.2rem minmax(0, 1fr);
		gap: 0.6rem;
		font-size: 0.78rem;
	}

	.specs dt {
		font-family: var(--f-mono);
		font-size: 0.6rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--faint);
	}

	.specs dd {
		margin: 0;
		color: var(--muted);
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
	}

	.hint {
		font-family: var(--f-mono);
		font-size: 0.6rem;
		color: var(--faint);
	}

	.field.has-error input {
		border-color: var(--error);
	}

	.total {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 0.75rem;
		margin-block: 0.9rem;
		padding: 0.7rem;
		background: var(--bg-deep);
		border: 1px solid var(--line);
	}

	.total-label {
		font-family: var(--f-mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold);
	}

	.total-formula {
		font-size: 0.72rem;
		color: var(--faint);
	}

	.total-value {
		font-family: var(--f-serif);
		font-size: clamp(1.35rem, 2.6vw, 1.8rem);
		line-height: 1.1;
		color: var(--gold-bright);
		white-space: nowrap;
	}

	.form-error {
		margin-block-end: 0.6rem;
	}

	.confirm {
		inline-size: 100%;
	}

	.form-note {
		margin-block-start: 0.55rem;
		font-size: 0.68rem;
		line-height: 1.4;
		color: var(--faint);
		text-align: center;
	}

	@media (max-width: 420px) {
		.form-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
