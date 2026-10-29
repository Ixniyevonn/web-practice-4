<script lang="ts">
	type Props = {
		bookingCount: number;
	};

	let { bookingCount }: Props = $props();
</script>

<header class="site-header">
	<div class="container header-inner">
		<a class="brand" href="#top" aria-label="Ночлег во Флатрии — наверх">
			<span class="brand-mark" aria-hidden="true">
				<svg width="28" height="28" viewBox="0 0 32 32" fill="none">
					<circle cx="16" cy="16" r="13" stroke="currentColor" stroke-width="1" opacity=".55" />
					<path d="M16 4v4M16 24v4M4 16h4M24 16h4" stroke="currentColor" stroke-width="1" opacity=".45" />
					<path d="M16 8.5 19 16l-3 7.5L13 16z" fill="currentColor" />
					<circle cx="16" cy="16" r="2.2" fill="#0b0907" />
				</svg>
			</span>
			<span class="brand-text">
				<strong>Ночлег во Флатрии</strong>
				<small>учебная карта бронирования</small>
			</span>
		</a>

		<nav class="nav" aria-label="Основная навигация">
			<a href="#map">Карта</a>
			<a href="#bookings">
				Мои брони
				{#if bookingCount > 0}
					<span class="nav-count" aria-label={`${bookingCount} записей`}>{bookingCount}</span>
				{/if}
			</a>
			<a href="#about">О демо</a>
		</nav>

		<p class="demo-badge">
			<span aria-hidden="true"></span>
			Учебное демо
		</p>
	</div>
</header>

<style>
	.site-header {
		position: sticky;
		inset-block-start: 0;
		z-index: 30;
		background: rgba(11, 9, 7, 0.9);
		border-block-end: 1px solid var(--line);
		backdrop-filter: blur(14px);
	}

	.header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-block-size: 4.4rem;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		color: var(--ink-strong);
		text-decoration: none;
	}

	.brand:hover {
		color: var(--gold-bright);
	}

	.brand-mark {
		display: grid;
		place-items: center;
		inline-size: 2.7rem;
		block-size: 2.7rem;
		color: var(--gold);
		border: 1px solid var(--line-strong);
	}

	.brand-text {
		display: grid;
		line-height: 1.1;
	}

	.brand-text strong {
		font-family: var(--f-serif);
		font-size: 1.15rem;
		font-weight: 400;
	}

	.brand-text small {
		font-family: var(--f-mono);
		font-size: 0.55rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--faint);
	}

	.nav {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.nav a {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 0.65rem;
		font-family: var(--f-sans);
		font-size: 0.78rem;
		color: var(--muted);
		text-decoration: none;
		border: 1px solid transparent;
	}

	.nav a:hover {
		color: var(--gold-bright);
		border-color: var(--line);
	}

	.nav-count {
		display: inline-grid;
		place-items: center;
		min-inline-size: 1.25rem;
		block-size: 1.25rem;
		padding-inline: 0.25rem;
		font-family: var(--f-mono);
		font-size: 0.6rem;
		color: #171006;
		background: var(--gold);
		border-radius: 999px;
	}

	.demo-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.55rem;
		font-family: var(--f-mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--gold);
		border: 1px solid var(--line);
		white-space: nowrap;
	}

	.demo-badge span {
		inline-size: 0.38rem;
		block-size: 0.38rem;
		background: var(--gold);
		border-radius: 50%;
	}

	@media (max-width: 760px) {
		.header-inner {
			min-block-size: 3.9rem;
		}

		.brand-text small {
			display: none;
		}

		.nav a {
			padding: 0.45rem 0.4rem;
			font-size: 0.72rem;
		}

		.demo-badge {
			display: none;
		}
	}

	@media (max-width: 430px) {
		.brand-text strong {
			font-size: 1rem;
		}

		.nav a[href="#about"] {
			display: none;
		}
	}
</style>
