<script lang="ts">
	const functions = [
		"Карта с WebGL и списком",
		"Два фильтра: гости и цена",
		"Расчёт стоимости по ночам",
		"Бронь и отмена",
		"localStorage и восстановление",
		"Клавиатура и мобильная вёрстка"
	];
</script>

<footer id="about" class="site-footer">
	<div class="container footer-grid">
		<div class="footer-main">
			<p class="eyebrow">О демо</p>
			<h2>Карта, которая помнит бронь</h2>
			<p>
				Это учебный проект по практическому заданию 4: интерактивная карта и живой интерфейс
				бронирования. Пользователь выбирает ночлег на пергаментной карте Доминиона Флатрия,
				задаёт число гостей и ночей, видит итоговую сумму и подтверждает запись.
			</p>
			<p>
				Карта и WebGL-рендерер взяты из проекта gloat-svelte и адаптированы под бронирование:
				остались зум, перетаскивание, подсветка объектов и векторный слой. Бронирования
				хранятся только в <code>localStorage</code> этого браузера. Реальная бронь, оплата и
				сервер отсутствуют.
			</p>
			<p class="ai-note">
				Создано с помощью <strong>DeepSeek</strong>. Стек: SvelteKit, TypeScript,
				<code>adapter-static</code>, WebGL2, localStorage.
			</p>
		</div>

		<div class="footer-side">
			<h3>Что реализовано</h3>
			<ul class="feature-list">
				{#each functions as item (item)}
					<li>{item}</li>
				{/each}
			</ul>
			<div class="footer-links">
				<a href="https://github.com/Ixniyevonn/practice4" target="_blank" rel="noopener noreferrer">
					Репозиторий practice4
				</a>
				<a href="#top">Наверх ↑</a>
			</div>
		</div>
	</div>

	<div class="container footer-bottom">
		<p>Ночлег во Флатрии · учебная работа · 2026</p>
		<p>Карта: Доминион Флатрия. Демо-топонимы не являются каноном.</p>
	</div>
</footer>

<style>
	.site-footer {
		margin-block-start: clamp(3rem, 7vw, 6rem);
		padding-block: clamp(2.2rem, 5vw, 4rem) 1.2rem;
		background:
			linear-gradient(180deg, transparent, rgba(228, 180, 114, 0.035) 35%, transparent),
			var(--bg-deep);
		border-block-start: 1px solid var(--line);
	}

	.footer-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
		gap: clamp(1.5rem, 5vw, 4rem);
	}

	.footer-main h2 {
		margin-block: 0.25rem 0.8rem;
		font-size: clamp(1.7rem, 3.4vw, 2.5rem);
	}

	.footer-main p {
		max-inline-size: 68ch;
		margin-block-end: 0.7rem;
		font-size: 0.88rem;
		line-height: 1.6;
		color: var(--muted);
	}

	.footer-main code {
		font-family: var(--f-mono);
		font-size: 0.82em;
		color: var(--gold);
	}

	.ai-note {
		padding-block-start: 0.7rem;
		border-block-start: 1px solid var(--line);
	}

	.ai-note strong {
		color: var(--gold);
		font-weight: 400;
	}

	.footer-side h3 {
		margin-block-end: 0.6rem;
		font-size: 1.2rem;
	}

	.feature-list {
		display: grid;
		gap: 0.3rem;
		margin: 0 0 1rem;
		padding: 0;
		list-style: none;
	}

	.feature-list li {
		position: relative;
		padding-inline-start: 1rem;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.feature-list li::before {
		content: "◆";
		position: absolute;
		inset-inline-start: 0;
		font-size: 0.48rem;
		line-height: 1.9;
		color: var(--gold-dim);
	}

	.footer-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		font-family: var(--f-mono);
		font-size: 0.66rem;
		letter-spacing: 0.03em;
	}

	.footer-bottom {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-block-start: clamp(1.8rem, 4vw, 3rem);
		padding-block-start: 0.9rem;
		font-family: var(--f-mono);
		font-size: 0.58rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--faint);
		border-block-start: 1px solid var(--line);
	}

	@media (max-width: 760px) {
		.footer-grid {
			grid-template-columns: 1fr;
		}

		.footer-bottom {
			flex-direction: column;
			gap: 0.35rem;
		}
	}
</style>
