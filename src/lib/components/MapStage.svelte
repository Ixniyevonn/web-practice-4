<script lang="ts">
	import { untrack } from "svelte";
	import { base } from "$app/paths";
	import { FLATRIA_REGION } from "$lib/content";
	import { buildLodgingScene } from "$lib/booking/map-scene";
	import type { Lodging, LodgingKind } from "$lib/booking/types";
	import type { MapBounds, MapDisplayFeatures, MapPoint } from "$lib/map/types";
	import type { MapLightweightRenderer } from "$lib/map/lightweight-renderer";

	const SYMBOL_STATES = ["free", "hover", "selected", "occupied"] as const;
	const SYMBOL_KINDS: LodgingKind[] = ["inn", "cabin", "tower", "camp"];
	const SYMBOL_SOURCES = Object.fromEntries(
		SYMBOL_STATES.flatMap((state) =>
			SYMBOL_KINDS.map((kind) => [
				`${state}-${kind}`,
				`${base}/assets/map/symbols/${state}-${kind}.svg`
			])
		)
	);

	type Props = {
		lodgings: Lodging[];
		selectedId: string | null;
		occupiedIds: ReadonlySet<string>;
		imageSrc: string;
		imageWidth: number;
		imageHeight: number;
		imageAlt: string;
		bounds: MapBounds;
		onSelect: (id: string) => void;
	};

	let {
		lodgings,
		selectedId,
		occupiedIds,
		imageSrc,
		imageWidth,
		imageHeight,
		imageAlt,
		bounds,
		onSelect
	}: Props = $props();

	const MAP_FEATURES: MapDisplayFeatures = {
		objectRendering: true,
		objectPicking: true,
		// Hover glow forces an extra pick frame and two blur passes per pointer move.
		// The map stays interactive without it, which keeps the camera at a stable FPS.
		objectHover: "none",
		objectPopups: false,
		interactionEnabled: true,
		cameraNavigation: true,
		imageDetail: "source",
		grid: false,
		visibilityZones: false,
		heroMarkers: false
	};

	let viewport: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let imageBootstrap: HTMLImageElement;
	let renderer = $state<MapLightweightRenderer | null>(null);
	let rendererFailed = $state(false);
	let rendererRevision = $state(0);
	let status = $state("");
	let imagePresented = $state(false);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let center = $state<MapPoint>(
		untrack(() => ({
			x: (bounds.minX + bounds.maxX) / 2,
			y: (bounds.minY + bounds.maxY) / 2
		}))
	);
	let zoom = $state(1);
	let drag = $state<{ x: number; y: number; center: MapPoint; moved: boolean } | null>(null);
	let highlightId = $state<string | null>(null);
	let hoveredId = $state<string | null>(null);
	let focusKey = "";
	let cameraFrame = 0;
	let cameraLast = 0;
	let targetCenter = untrack(() => ({ x: center.x, y: center.y }));
	let targetZoom = 1;
	const touchPoints = new Map<number, { clientX: number; clientY: number }>();
	let pinch = $state<{ distance: number; zoom: number; anchor: MapPoint } | null>(null);

	const boundsWidth = $derived(bounds.maxX - bounds.minX);
	const boundsHeight = $derived(bounds.maxY - bounds.minY);
	const scaleFit = $derived(
		Math.min(
			viewportWidth / Math.max(1, boundsWidth),
			viewportHeight / Math.max(1, boundsHeight)
		)
	);
	const zoomMinimum = 1;
	const zoomMaximum = 4;
	const scale = $derived(Math.max(Number.EPSILON, scaleFit * zoom));
	const viewWidth = $derived(viewportWidth / scale);
	const viewHeight = $derived(viewportHeight / scale);
	const viewMinX = $derived(center.x - viewWidth / 2);
	const viewMinY = $derived(center.y - viewHeight / 2);
	const occupiedKey = $derived([...occupiedIds].sort().join("|"));
	const scene = $derived(
		buildLodgingScene({
			lodgings,
			occupiedIds,
			selectedId,
			hoveredId,
			imageSrc,
			imageWidth,
			imageHeight,
			imageAlt,
			bounds,
			region: FLATRIA_REGION,
			symbolSources: SYMBOL_SOURCES,
			revision: `${selectedId ?? "none"}:${hoveredId ?? "none"}:${occupiedKey}:${lodgings.map((lodging) => lodging.id).join(",")}`
		})
	);
	$effect(() => {
		if (!viewport) return;
		const observer = new ResizeObserver(([entry]) => {
			if (!entry) return;
			viewportWidth = Math.max(1, entry.contentRect.width);
			viewportHeight = Math.max(1, entry.contentRect.height);
			untrack(clampCamera);
		});
		observer.observe(viewport);
		return () => observer.disconnect();
	});

	$effect(() => {
		if (!canvas || !imageBootstrap) return;
		let active = true;
		rendererFailed = false;
		status = "";
		void import("$lib/map/lightweight-renderer")
			.then(({ MapLightweightRenderer }) => {
				if (!active) return;
				try {
					renderer = new MapLightweightRenderer(
						canvas,
						() => {
							rendererRevision += 1;
						},
						imageBootstrap,
						MAP_FEATURES
					);
				} catch (cause) {
					rendererFailed = true;
					status =
						cause instanceof Error
							? `WebGL недоступен: ${cause.message} Показана статичная карта.`
							: "WebGL недоступен. Показана статичная карта.";
				}
			})
			.catch(() => {
				if (!active) return;
				rendererFailed = true;
				status = "Не удалось загрузить рендерер карты. Показана статичная карта.";
			});
		return () => {
			active = false;
			renderer?.destroy();
			renderer = null;
		};
	});

	$effect(() => {
		if (!renderer) return;
		renderer.setScene(scene);
		renderer.setFocusedRegion(scene.focusedRegionId ?? null);
		renderer.setHighlight(highlightId);
		void scene;
		void highlightId;
		void rendererRevision;
		void viewportWidth;
		void viewportHeight;
		untrack(() => drawCurrent());
	});

	$effect(() => {
		return () => {
			cancelAnimationFrame(cameraFrame);
			cameraFrame = 0;
		};
	});

	$effect(() => {
		const id = selectedId;
		if (!id) {
			focusKey = "";
			return;
		}
		if (viewportWidth < 2 || viewportHeight < 2) return;
		const lodging = lodgings.find((candidate) => candidate.id === id);
		if (!lodging) return;
		const key = `${id}:${viewportWidth}:${viewportHeight}`;
		if (focusKey === key) return;
		focusKey = key;
		moveCamera(lodging.x, lodging.y, Math.max(targetZoom, 1.7));
	});

	function clampCenter(x: number, y: number, targetZoom: number): MapPoint {
		const targetScale = Math.max(Number.EPSILON, scaleFit * targetZoom);
		const halfWidth = viewportWidth / targetScale / 2;
		const halfHeight = viewportHeight / targetScale / 2;
		return {
			x:
				halfWidth >= boundsWidth / 2
					? (bounds.minX + bounds.maxX) / 2
					: Math.min(bounds.maxX - halfWidth, Math.max(bounds.minX + halfWidth, x)),
			y:
				halfHeight >= boundsHeight / 2
					? (bounds.minY + bounds.maxY) / 2
					: Math.min(bounds.maxY - halfHeight, Math.max(bounds.minY + halfHeight, y))
		};
	}

	function clampCameraValue(
		x: number,
		y: number,
		value: number
	): { center: MapPoint; zoom: number } {
		const nextZoom = Math.min(zoomMaximum, Math.max(zoomMinimum, value));
		return {
			center: clampCenter(x, y, nextZoom),
			zoom: nextZoom
		};
	}

	function clampTarget(): void {
		if (viewportWidth < 2 || viewportHeight < 2) return;
		const target = clampCameraValue(targetCenter.x, targetCenter.y, targetZoom);
		targetCenter = target.center;
		targetZoom = target.zoom;
	}

	function clampCamera(): void {
		if (viewportWidth < 2 || viewportHeight < 2) return;
		const current = clampCameraValue(center.x, center.y, zoom);
		center = current.center;
		zoom = current.zoom;
		const target = clampCameraValue(targetCenter.x, targetCenter.y, targetZoom);
		targetCenter = target.center;
		targetZoom = target.zoom;
	}

	/**
	 * Moves the camera toward a target with a short exponential ease.
	 *
	 * The map stays responsive during dragging because every pointer move only
	 * updates the target; the render loop catches up over a few frames.
	 */
	function drawCurrent(): void {
		const currentRenderer = renderer;
		if (!currentRenderer || viewportWidth < 2 || viewportHeight < 2) return;
		const result = currentRenderer.draw({
			width: viewportWidth,
			height: viewportHeight,
			panX: -viewMinX * scale,
			panY: -viewMinY * scale,
			zoom: scale
		});
		if (result.ready) imagePresented = true;
	}

	function startCameraEase(): void {
		if (cameraFrame) return;
		const reduced =
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduced) {
			center = { ...targetCenter };
			zoom = targetZoom;
			drawCurrent();
			return;
		}
		cameraLast = performance.now();
		const step = (now: number) => {
			const elapsed = Math.max(0, Math.min(64, now - cameraLast));
			cameraLast = now;
			const ease = 1 - Math.exp(-elapsed / 45);
			center = {
				x: center.x + (targetCenter.x - center.x) * ease,
				y: center.y + (targetCenter.y - center.y) * ease
			};
			zoom += (targetZoom - zoom) * ease;
			const settled =
				Math.abs(targetCenter.x - center.x) < 0.04 &&
				Math.abs(targetCenter.y - center.y) < 0.04 &&
				Math.abs(targetZoom - zoom) < 0.0005;
			if (settled) {
				center = { ...targetCenter };
				zoom = targetZoom;
				drawCurrent();
				cameraFrame = 0;
				return;
			}
			drawCurrent();
			cameraFrame = requestAnimationFrame(step);
		};
		cameraFrame = requestAnimationFrame(step);
	}

	function moveCamera(x: number, y: number, value: number): void {
		targetCenter = { x, y };
		targetZoom = value;
		clampTarget();
		startCameraEase();
	}

	function clientPoint(event: Pick<PointerEvent, "clientX" | "clientY">): MapPoint {
		if (!viewport) return { x: 0, y: 0 };
		const rect = viewport.getBoundingClientRect();
		return {
			x: viewMinX + ((event.clientX - rect.left) / Math.max(1, rect.width)) * viewWidth,
			y: viewMinY + ((event.clientY - rect.top) / Math.max(1, rect.height)) * viewHeight
		};
	}

	function pickAt(event: Pick<PointerEvent, "clientX" | "clientY">): string | null {
		const hit = renderer?.pick(clientPoint(event));
		if (hit?.kind !== "element") return null;
		const id = hit.entry.element.id;
		return id.endsWith("-symbol") ? id.slice(0, -"-symbol".length) : id;
	}

	/**
	 * Finds the hovered lodging with a cheap distance test instead of a WebGL
	 * pick frame. The result changes only when the pointer enters or leaves a
	 * point, so the map scene is rebuilt only on those transitions.
	 */
	function updateHover(event: Pick<PointerEvent, "clientX" | "clientY">): void {
		if (drag || pinch) return;
		const point = clientPoint(event);
		const radius = 34;
		let next: string | null = null;
		let nearest = radius;
		for (const lodging of lodgings) {
			const distance = Math.hypot(lodging.x - point.x, lodging.y - point.y);
			if (distance < nearest) {
				nearest = distance;
				next = lodging.id;
			}
		}
		if (next !== hoveredId) hoveredId = next;
	}

	function onPointerDown(event: PointerEvent): void {
		if (event.button !== 0) return;
		if (event.target instanceof Element && event.target.closest("button")) return;
		targetCenter = { ...center };
		targetZoom = zoom;
		viewport.setPointerCapture(event.pointerId);
		if (event.pointerType === "touch") {
			touchPoints.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
			if (touchPoints.size === 2) {
				const [first, second] = [...touchPoints.values()];
				if (first && second) {
					pinch = {
						distance: Math.hypot(
							second.clientX - first.clientX,
							second.clientY - first.clientY
						),
						zoom,
						anchor: clientPoint({
							clientX: (first.clientX + second.clientX) / 2,
							clientY: (first.clientY + second.clientY) / 2
						})
					};
					drag = null;
					return;
				}
			}
		}
		drag = {
			x: event.clientX,
			y: event.clientY,
			center: { ...center },
			moved: false
		};
	}

	function onPointerMove(event: PointerEvent): void {
		if (event.pointerType === "touch" && touchPoints.has(event.pointerId)) {
			touchPoints.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
		}
		if (pinch && touchPoints.size === 2) {
			const [first, second] = [...touchPoints.values()];
			if (!first || !second || !viewport) return;
			const rect = viewport.getBoundingClientRect();
			const midpointX = (first.clientX + second.clientX) / 2;
			const midpointY = (first.clientY + second.clientY) / 2;
			const distance = Math.hypot(
				second.clientX - first.clientX,
				second.clientY - first.clientY
			);
			const nextZoom = Math.min(
				zoomMaximum,
				Math.max(zoomMinimum, pinch.zoom * (distance / Math.max(1, pinch.distance)))
			);
			const nextScale = Math.max(Number.EPSILON, scaleFit * nextZoom);
			const nextWidth = viewportWidth / nextScale;
			const nextHeight = viewportHeight / nextScale;
			targetCenter = {
				x: pinch.anchor.x + (0.5 - (midpointX - rect.left) / rect.width) * nextWidth,
				y: pinch.anchor.y + (0.5 - (midpointY - rect.top) / rect.height) * nextHeight
			};
			targetZoom = nextZoom;
			clampTarget();
			startCameraEase();
			return;
		}
		if (drag) {
			const deltaX = event.clientX - drag.x;
			const deltaY = event.clientY - drag.y;
			if (Math.hypot(deltaX, deltaY) > 4) drag.moved = true;
			targetCenter = {
				x: drag.center.x - deltaX / scale,
				y: drag.center.y - deltaY / scale
			};
			clampTarget();
			startCameraEase();
			return;
		}
		updateHover(event);
	}

	function onPointerUp(event: PointerEvent): void {
		if (event.button !== 0) return;
		if (event.pointerType === "touch") {
			touchPoints.delete(event.pointerId);
			if (pinch) {
				if (touchPoints.size < 2) pinch = null;
				drag = null;
				return;
			}
		}
		const wasDrag = drag?.moved ?? false;
		drag = null;
		if (wasDrag) return;
		const id = pickAt(event);
		if (id) onSelect(id);
	}

	function onWheel(event: WheelEvent): void {
		event.preventDefault();
		const point = clientPoint({ clientX: event.clientX, clientY: event.clientY });
		const nextZoom = Math.min(
			zoomMaximum,
			Math.max(zoomMinimum, targetZoom * Math.exp(-event.deltaY * 0.0012))
		);
		const ratio = targetZoom / nextZoom;
		targetCenter = {
			x: point.x + (targetCenter.x - point.x) * ratio,
			y: point.y + (targetCenter.y - point.y) * ratio
		};
		targetZoom = nextZoom;
		clampTarget();
		startCameraEase();
	}

	function onKeyDown(event: KeyboardEvent): void {
		const step = 56 / Math.max(Number.EPSILON, scaleFit * targetZoom);
		if (event.key === "ArrowLeft") targetCenter = { ...targetCenter, x: targetCenter.x - step };
		else if (event.key === "ArrowRight")
			targetCenter = { ...targetCenter, x: targetCenter.x + step };
		else if (event.key === "ArrowUp") targetCenter = { ...targetCenter, y: targetCenter.y - step };
		else if (event.key === "ArrowDown")
			targetCenter = { ...targetCenter, y: targetCenter.y + step };
		else if (event.key === "+" || event.key === "=")
			targetZoom = Math.min(zoomMaximum, targetZoom * 1.2);
		else if (event.key === "-" || event.key === "_")
			targetZoom = Math.max(zoomMinimum, targetZoom / 1.2);
		else if (event.key === "0") resetView();
		else return;
		event.preventDefault();
		clampTarget();
		startCameraEase();
	}

	function resetView(): void {
		moveCamera(
			(bounds.minX + bounds.maxX) / 2,
			(bounds.minY + bounds.maxY) / 2,
			zoomMinimum
		);
	}

	function zoomBy(factor: number): void {
		targetZoom = Math.min(zoomMaximum, Math.max(zoomMinimum, targetZoom * factor));
		clampTarget();
		startCameraEase();
	}
</script>

<div class="map-stage">
	<div class="map-heading">
		<div>
			<p class="map-kicker">Карта Доминиона Флатрия</p>
			<h2>Выберите ночлег</h2>
		</div>
		<p class="map-hint">Тяните карту, колесо — масштаб. Список ниже делает то же самое с клавиатуры.</p>
	</div>

	<div class="map-frame">
		<div class="map-corners" aria-hidden="true">
			<span></span><span></span><span></span><span></span>
		</div>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="map-viewport"
			bind:this={viewport}
			role="application"
			aria-roledescription="интерактивная карта"
			aria-label="Карта ночлегов. Используйте стрелки для перемещения, плюс и минус для масштаба, ноль для сброса. Объекты также доступны в списке."
			tabindex="0"
			class:dragging={Boolean(drag?.moved || pinch)}
			class:has-hover={Boolean(hoveredId)}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={() => {
				drag = null;
				pinch = null;
				touchPoints.clear();
			}}
			onpointerleave={() => {
				if (!drag) {
					highlightId = null;
					hoveredId = null;
				}
			}}
			onwheel={onWheel}
			onkeydown={onKeyDown}
		>
			<img
				class="map-image-bootstrap"
				bind:this={imageBootstrap}
				src={imageSrc}
				alt=""
				width={imageWidth}
				height={imageHeight}
				decoding="async"
				loading="eager"
				fetchpriority="high"
				draggable="false"
			/>
			{#if rendererFailed}
				<img
					class="map-image-fallback"
					src={imageSrc}
					alt={imageAlt}
					width={imageWidth}
					height={imageHeight}
					decoding="async"
					draggable="false"
					style:transform={`translate(${-viewMinX * scale}px, ${-viewMinY * scale}px) scale(${scale})`}
				/>
			{/if}
			<canvas class="map-canvas" class:ready={imagePresented && !rendererFailed} bind:this={canvas}></canvas>

			{#if lodgings.length === 0}
				<div class="map-empty" role="status">
					<strong>Под фильтры ничего не подошло</strong>
					<span>Измените число гостей или максимальную цену — карта обновится вместе со списком.</span>
				</div>
			{/if}

			<div
				class="map-controls"
				role="group"
				aria-label="Управление картой"
				onpointerdown={(event) => event.stopPropagation()}
				onpointerup={(event) => event.stopPropagation()}
			>
				<button type="button" onclick={() => zoomBy(1.35)} aria-label="Приблизить карту">+</button>
				<button type="button" onclick={() => zoomBy(1 / 1.35)} aria-label="Отдалить карту">−</button>
				<button type="button" onclick={resetView} aria-label="Сбросить вид карты">⌂</button>
			</div>

			<div class="map-legend" aria-label="Обозначения на карте">
				<span><i class="legend-dot free"></i>Свободно</span>
				<span><i class="legend-dot selected">✓</i>Выбрано</span>
				<span><i class="legend-dot occupied">×</i>Занято</span>
			</div>

			{#if status}
				<p class="map-status" role="status">{status}</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.map-stage {
		display: grid;
		gap: 0.85rem;
	}

	.map-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}

	.map-kicker {
		font-family: var(--f-mono);
		font-size: 0.64rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--gold);
	}

	.map-heading h2 {
		margin-block-start: 0.25rem;
		font-size: clamp(1.5rem, 2.6vw, 2.1rem);
	}

	.map-hint {
		max-width: 27ch;
		font-size: 0.82rem;
		line-height: 1.45;
		color: var(--muted);
		text-align: end;
	}

	.map-frame {
		position: relative;
		padding: 0.65rem;
		background:
			linear-gradient(135deg, rgba(228, 180, 114, 0.06), transparent 28%),
			var(--panel);
		border: 1px solid var(--line-strong);
		box-shadow: var(--shadow);
	}

	.map-corners {
		position: absolute;
		inset: 0.25rem;
		z-index: 6;
		pointer-events: none;
	}

	.map-corners span {
		position: absolute;
		inline-size: 1.25rem;
		block-size: 1.25rem;
		border-color: var(--gold);
		border-style: solid;
		opacity: 0.75;
	}

	.map-corners span:nth-child(1) {
		inset-block-start: 0;
		inset-inline-start: 0;
		border-width: 1px 0 0 1px;
	}

	.map-corners span:nth-child(2) {
		inset-block-start: 0;
		inset-inline-end: 0;
		border-width: 1px 1px 0 0;
	}

	.map-corners span:nth-child(3) {
		inset-block-end: 0;
		inset-inline-start: 0;
		border-width: 0 0 1px 1px;
	}

	.map-corners span:nth-child(4) {
		inset-block-end: 0;
		inset-inline-end: 0;
		border-width: 0 1px 1px 0;
	}

	.map-viewport {
		position: relative;
		block-size: clamp(24rem, 58vh, 42rem);
		overflow: hidden;
		touch-action: none;
		cursor: grab;
		background: #0a0806;
		contain: layout paint;
	}

	.map-viewport.dragging {
		cursor: grabbing;
	}

	.map-viewport.has-hover:not(.dragging) {
		cursor: pointer;
	}

	.map-viewport:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: -3px;
	}

	.map-canvas {
		position: absolute;
		inset: 0;
		display: block;
		inline-size: 100%;
		block-size: 100%;
	}

	.map-image-bootstrap {
		display: none;
	}

	.map-image-fallback {
		position: absolute;
		inset: 0;
		display: block;
		inline-size: auto;
		block-size: auto;
		max-width: none;
		max-height: none;
		transform-origin: 0 0;
		pointer-events: none;
	}

	.map-canvas {
		z-index: 1;
		pointer-events: none;
		visibility: hidden;
	}

	.map-canvas.ready {
		visibility: visible;
	}

	.map-controls {
		position: absolute;
		inset-block-start: 0.65rem;
		inset-inline-end: 0.65rem;
		z-index: 7;
		display: grid;
		gap: 0.25rem;
	}

	.map-controls button {
		display: grid;
		place-items: center;
		inline-size: 2rem;
		block-size: 2rem;
		padding: 0;
		font-family: var(--f-mono);
		font-size: 0.95rem;
		color: var(--ink);
		background: rgba(10, 8, 6, 0.8);
		border: 1px solid var(--line-strong);
		cursor: pointer;
	}

	.map-controls button:hover {
		color: var(--gold-bright);
		border-color: var(--gold);
	}

	.map-legend {
		position: absolute;
		inset-block-end: 0.65rem;
		inset-inline-start: 0.65rem;
		z-index: 7;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.8rem;
		padding: 0.4rem 0.55rem;
		font-family: var(--f-mono);
		font-size: 0.6rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
		background: rgba(10, 8, 6, 0.84);
		border: 1px solid var(--line);
	}

	.map-legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.legend-dot {
		display: inline-grid;
		place-items: center;
		inline-size: 0.85rem;
		block-size: 0.85rem;
		font-style: normal;
		font-size: 0.58rem;
		line-height: 1;
		border: 1px solid currentColor;
		border-radius: 50%;
	}

	.legend-dot.free {
		color: var(--ok);
		border-color: var(--ok);
	}

	.legend-dot.selected {
		color: #171006;
		background: var(--gold);
		border-color: var(--gold);
	}

	.legend-dot.occupied {
		color: var(--error);
		border-color: var(--error);
	}

	.map-empty,
	.map-status {
		position: absolute;
		z-index: 9;
		padding: 0.65rem 0.8rem;
		font-size: 0.82rem;
		line-height: 1.4;
		background: rgba(10, 8, 6, 0.94);
		border: 1px solid var(--line-strong);
	}

	.map-empty {
		inset: 50% auto auto 50%;
		display: grid;
		gap: 0.2rem;
		inline-size: min(24rem, calc(100% - 2rem));
		text-align: center;
		transform: translate(-50%, -50%);
	}

	.map-empty strong {
		font-family: var(--f-serif);
		font-size: 1.15rem;
		font-weight: 400;
		color: var(--ink-strong);
	}

	.map-empty span {
		color: var(--muted);
	}

	.map-status {
		inset: auto 0.65rem 0.65rem auto;
		max-inline-size: min(24rem, calc(100% - 1.3rem));
		color: var(--error);
	}

	@media (max-width: 720px) {
		.map-heading {
			align-items: start;
		}

		.map-hint {
			display: none;
		}

		.map-viewport {
			block-size: clamp(20rem, 56vh, 27rem);
		}

		.map-legend {
			gap: 0.35rem 0.55rem;
		}
	}
</style>
