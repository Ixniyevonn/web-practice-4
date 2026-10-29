<script lang="ts">
	import "../app.css";

	let { children } = $props();
</script>

<svelte:head>
	<title>Ночлег во Флатрии — учебная карта бронирования</title>
	<meta
		name="description"
		content="Интерактивная карта ночлегов Доминиона Флатрия: выберите место, число гостей и ночей, рассчитайте стоимость и сохраните учебную бронь в браузере."
	/>
	<meta name="author" content="Савва Крупницкий" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="ru_RU" />
	<meta property="og:site_name" content="Ночлег во Флатрии" />
	<meta property="og:title" content="Ночлег во Флатрии — учебная карта бронирования" />
	<meta
		property="og:description"
		content="Интерактивная карта ночлегов Доминиона Флатрия: выберите место, число гостей и ночей, рассчитайте стоимость и сохраните учебную бронь в браузере."
	/>
	<meta property="og:url" content="https://ixniyevonn.github.io/practice4/" />
	<meta name="twitter:card" content="summary" />
	<link rel="canonical" href="https://ixniyevonn.github.io/practice4/" />
</svelte:head>

{@render children()}
