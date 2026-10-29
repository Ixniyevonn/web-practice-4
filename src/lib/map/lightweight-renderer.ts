import { mapCircleNameArcLayout, mapNameArcLayout } from "$lib/map/name-arc";
import { sortMapElements, mapElementLabelName } from "$lib/map/geometry";
import {
	mapPresetScenePrune,
	type MapPresetScene,
	type MapPresetSceneElement,
} from "$lib/map/preset-scene";
import type {
	MapRenderImageTile,
	MapRenderOverlay,
	MapRenderResult,
	MapRenderScene,
	MapRenderView,
} from "$lib/map/render-scene";
import type {
	MapConfig,
	MapDisplayFeatures,
	MapElement,
	MapElementRegion,
	MapElementSymbol,
	MapHeroPlacement,
	MapImageVariantManifest,
	MapPoint,
} from "$lib/map/types";
import {
	mapElementFocusOpacity,
	mapElementsFocusVisible,
	mapVisibilityZoneIsExpanded,
} from "$lib/map/visibility";
import { MapWebglRenderer } from "$lib/map/webgl-renderer";

export type MapLightweightView = Omit<MapRenderView, "colorCache">;

export type MapLightweightHit =
	| { kind: "element"; entry: MapPresetSceneElement }
	| { kind: "hero"; placement: MapHeroPlacement }
	| { kind: "selected-position" };

type MapLightweightBase = {
	elements: MapElement[];
	elementsAll: MapElement[];
	symbolSources: Map<string, string>;
	nameLayouts: MapRenderScene["nameLayouts"];
	focusedRenderId: string | null;
	highlightRenderId: string | null;
	layerId: string;
};

const OVERLAY_EMPTY: MapRenderOverlay = {
	rulerPaths: [],
	rulerActivePoints: [],
	rulerPreviewPoints: [],
	rulerSelectedId: null,
	rulerHoverId: null,
	rulerFinishHovered: false,
	draftPoints: [],
	draftPreviewPoints: [],
	draftType: null,
	editingElementId: null,
	elementHoverId: null,
	elementActiveId: null,
	editHoverKey: null,
	selectedPointIndexes: [],
};

/**
 * Selects the image tiles that match the current screen resolution and map view.
 *
 * @param manifest - The generated image levels for the active map.
 * @param view - The current map-to-screen transform.
 * @param pixelRatio - The number of drawing pixels in one CSS pixel.
 * @returns The visible tiles in original map coordinates.
 */
export function mapLightweightImageTiles(
	manifest: MapImageVariantManifest | null,
	view: MapLightweightView,
	pixelRatio = 1,
): MapRenderImageTile[] {
	if (!manifest || manifest.levels.length === 0 || view.zoom <= 0) return [];
	const resolution = Math.min(1, view.zoom * Math.max(1, pixelRatio));
	const levels = [...manifest.levels].sort((left, right) => left.scale - right.scale);
	const level = levels.find((candidate) => candidate.scale >= resolution) ?? levels.at(-1);
	if (!level) return [];
	const minX = -view.panX / view.zoom;
	const minY = -view.panY / view.zoom;
	const maxX = minX + view.width / view.zoom;
	const maxY = minY + view.height / view.zoom;
	const margin = manifest.tileSize / level.scale;
	return level.tiles.flatMap((tile) => {
		const x = tile.x / level.scale;
		const y = tile.y / level.scale;
		const width = tile.width / level.scale;
		const height = tile.height / level.scale;
		if (
			x + width < minX - margin ||
			x > maxX + margin ||
			y + height < minY - margin ||
			y > maxY + margin
		)
			return [];
		return [{ source: tile.src, x, y, width, height }];
	});
}

/**
 * Creates a stable internal identifier for one bounded scene entry.
 *
 * @param entry - The source scene entry.
 * @param index - The entry position in the immutable preset scene.
 * @returns An identifier that cannot collide across zone files.
 */
function mapLightweightEntryId(entry: MapPresetSceneElement, index: number): string {
	return `embedded:${entry.zoneId ?? "global"}:${index}:${entry.element.id}`;
}

/**
 * Applies a focus opacity to an element without changing the source scene.
 *
 * @param element - The source map element.
 * @param opacity - The focus opacity multiplier.
 * @returns A render-only element copy.
 */
function mapLightweightElementOpacity(element: MapElement, opacity: number): MapElement {
	if (opacity === 1 || element.type === "symbol") return element;
	return {
		...element,
		style: {
			...element.style,
			borderOpacity: element.style.borderOpacity * opacity,
			fillOpacity: element.style.fillOpacity * opacity,
		},
	} as MapElement;
}

/**
 * Creates an empty overlay value for a static embedded render.
 *
 * @param highlightedId - The internal element identifier to highlight.
 * @returns A new overlay value for the full renderer.
 */
function mapLightweightOverlay(highlightedId: string | null): MapRenderOverlay {
	return { ...OVERLAY_EMPTY, elementHoverId: highlightedId };
}

/**
 * Calculates name layouts that the established renderer expects.
 *
 * @param elements - The visible render-only elements.
 * @returns Layouts keyed by internal element identifier.
 */
function mapLightweightNameLayouts(elements: MapElement[]): MapRenderScene["nameLayouts"] {
	const layouts: MapRenderScene["nameLayouts"] = new Map();
	for (const element of elements) {
		if (
			(element.type !== "region" && element.type !== "area") ||
			!element.nameArc ||
			element.nameArc.enabled === false
		)
			continue;
		const title = mapElementLabelName(element);
		if (!title) continue;
		layouts.set(
			element.id,
			element.type === "area"
				? mapCircleNameArcLayout(
						element.center,
						element.radius,
						title,
						element.nameArc.fontSize,
					)
				: mapNameArcLayout(
						element.points,
						title,
						element.nameArc.fontSize,
						element.nameArc.anchor,
						element.nameArc.rotation,
					),
		);
	}
	return layouts;
}

/**
 * Creates a circular avatar element for an embedded map.
 *
 * @param id - The internal marker identifier.
 * @param position - The normalized map position.
 * @param image - The source map image dimensions.
 * @param layerId - The layer that receives the marker.
 * @param metadata - Optional marker metadata.
 * @returns A render-only circular symbol.
 */
function mapLightweightHeroElement(
	id: string,
	position: MapPoint,
	image: MapPresetScene["image"],
	layerId: string,
	metadata?: MapElementSymbol["metadata"],
): MapElementSymbol {
	return {
		id,
		type: "symbol",
		assetUid: id,
		center: { x: position.x * image.width, y: position.y * image.height },
		width: 72,
		height: 72,
		rotation: 0,
		shape: "circle",
		style: {
			borderColor: "#efbd57",
			borderOpacity: 1,
			borderWidth: 6,
			fillColor: "#21170d",
			fillOpacity: 1,
		},
		layerIds: [layerId],
		metadata,
	};
}

/**
 * Creates a filled map-pin element for a position picker.
 *
 * @param id - The internal marker identifier.
 * @param position - The normalized map position at the pin tip.
 * @param image - The source map image dimensions.
 * @param layerId - The layer that receives the marker.
 * @returns A render-only map pin.
 */
function mapLightweightPositionElement(
	id: string,
	position: MapPoint,
	image: MapPresetScene["image"],
	layerId: string,
): MapElementRegion {
	const tip = { x: position.x * image.width, y: position.y * image.height };
	return {
		id,
		type: "region",
		points: [
			{ x: tip.x - 27, y: tip.y - 43 },
			{ x: tip.x - 20, y: tip.y - 61 },
			{ x: tip.x, y: tip.y - 70 },
			{ x: tip.x + 20, y: tip.y - 61 },
			{ x: tip.x + 27, y: tip.y - 43 },
			{ x: tip.x + 22, y: tip.y - 24 },
			{ x: tip.x, y: tip.y },
			{ x: tip.x - 22, y: tip.y - 24 },
		],
		smoothing: 18,
		style: {
			borderColor: "#21170d",
			borderOpacity: 1,
			borderWidth: 6,
			fillColor: "#efbd57",
			fillOpacity: 1,
		},
		layerIds: [layerId],
	};
}

/**
 * Provides the established WebGL renderer through a static-scene interface.
 *
 * The adapter keeps one retained scene, supplies no editing overlays, and rebuilds only when
 * embedded visibility, focus, or marker state changes.
 */
export class MapLightweightRenderer {
	private readonly renderer: MapWebglRenderer;
	private readonly features: MapDisplayFeatures;
	private readonly imageElement: HTMLImageElement;
	private scene: MapPresetScene | null = null;
	private view: MapLightweightView | null = null;
	private expandedZoneIds = new Set<string>();
	private highlightedId: string | null = null;
	private focusedRegionId: string | null = null;
	private heroMarkersEnabled = false;
	private selectedPosition: MapPoint | null = null;
	private selectedAvatarUrl: string | null = null;
	private sceneRevision = 0;
	private highlightRevision = 0;
	private namesCached = new WeakMap<MapElement, MapRenderScene["nameLayouts"]>();
	private sceneSource: MapPresetScene | null = null;
	private markerRevision = 0;
	private renderBaseCached: MapLightweightBase | null = null;
	private renderBaseCachedRevision = -1;
	private renderSceneCached: MapRenderScene | null = null;
	private renderSceneCachedRevision = "";
	private imageTiles: MapRenderImageTile[] = [];
	private imageTilesRevision = "";
	private entryByRenderId = new Map<string, MapPresetSceneElement>();
	private heroByRenderId = new Map<string, MapHeroPlacement>();
	private selectedRenderId: string | null = null;

	/**
	 * Creates a retained renderer for an embedded map.
	 *
	 * @param canvas - The only visual surface used by the embedded map.
	 * @param invalidate - The callback to request a redraw after media loads.
	 * @param imageElement - The native bootstrap image that supplies the background texture.
	 * @param features - The rendering and interaction capabilities to retain.
	 * @throws When WebGL 2 is unavailable.
	 */
	constructor(
		canvas: HTMLCanvasElement,
		invalidate: () => void,
		imageElement: HTMLImageElement,
		features: MapDisplayFeatures = {},
	) {
		this.features = features;
		this.imageElement = imageElement;
		this.renderer = new MapWebglRenderer(canvas, invalidate, console.error, {
			geometryWorkerEnabled: features.objectRendering !== false,
			pickingEnabled:
				features.interactionEnabled !== false &&
				(features.objectPicking !== false || features.objectHover === "border"),
			interactionEnabled:
				features.interactionEnabled !== false && features.objectHover === "border",
			editorOverlayEnabled: false,
			labelsEnabled: features.objectRendering !== false,
		});
	}

	/**
	 * Replaces the immutable preset scene.
	 *
	 * @param scene - The bounded map scene.
	 * @returns Nothing.
	 */
	setScene(scene: MapPresetScene): void {
		if (this.sceneSource === scene) return;
		this.sceneSource = scene;
		this.scene =
			this.features.objectRendering === false
				? {
						...scene,
						preset: {
							...scene.preset,
							layerIds: [],
							zoneIds: [],
							gridEnabled: false,
							publicHeroesEnabled: false,
						},
						layers: [],
						military: { roles: [], echelons: [] },
						elements: [],
						visibilityZones: [],
						grid: null,
						heroPlacements: [],
						symbolSources: {},
					}
				: mapPresetScenePrune(scene);
		this.sceneRevision += 1;
	}

	/**
	 * Changes visibility-zone expansion.
	 *
	 * @param zoneIds - The expanded zone identifiers.
	 * @returns Nothing.
	 */
	setExpandedZones(zoneIds: Iterable<string>): void {
		const next = new Set(zoneIds);
		if (
			next.size === this.expandedZoneIds.size &&
			[...next].every((id) => this.expandedZoneIds.has(id))
		)
			return;
		this.expandedZoneIds = next;
		this.sceneRevision += 1;
	}

	/**
	 * Changes the element that uses the standard interaction highlight.
	 *
	 * @param elementId - The source element identifier, or `null`.
	 * @returns Nothing.
	 */
	setHighlight(elementId: string | null): void {
		if (this.highlightedId === elementId) return;
		this.highlightedId = elementId;
		this.highlightRevision += 1;
	}

	/**
	 * Changes the active region focus.
	 *
	 * @param regionId - The source region identifier, or `null`.
	 * @returns Nothing.
	 */
	setFocusedRegion(regionId: string | null): void {
		if (this.focusedRegionId === regionId) return;
		this.focusedRegionId = regionId;
		this.sceneRevision += 1;
	}

	/**
	 * Changes public heroes and the editable hero marker.
	 *
	 * @param enabled - Whether public hero markers can draw.
	 * @param selectedPosition - The normalized editable position, or `null`.
	 * @param selectedAvatarUrl - The editable hero avatar URL, or `null` for the fallback.
	 * @returns Nothing.
	 */
	setHeroMarkers(
		enabled: boolean,
		selectedPosition: MapPoint | null,
		selectedAvatarUrl: string | null = null,
	): void {
		const positionChanged =
			this.selectedPosition?.x !== selectedPosition?.x ||
			this.selectedPosition?.y !== selectedPosition?.y;
		const enabledChanged = this.heroMarkersEnabled !== enabled;
		const avatarChanged = this.selectedAvatarUrl !== selectedAvatarUrl;
		if (!enabledChanged && !positionChanged && !avatarChanged) return;
		this.heroMarkersEnabled = enabled;
		this.selectedPosition = selectedPosition ? { ...selectedPosition } : null;
		this.selectedAvatarUrl = selectedAvatarUrl;
		if (enabledChanged) this.sceneRevision += 1;
		if (positionChanged || avatarChanged) this.markerRevision += 1;
	}

	/**
	 * Draws the current retained scene with one camera transform.
	 *
	 * @param view - The embedded viewport transform.
	 * @returns The background presentation and renderer readiness state.
	 */
	draw(view: MapLightweightView): MapRenderResult {
		this.view = view;
		const imageTiles =
			this.features.imageDetail === "tiles" || this.features.imageDetail === undefined
				? mapLightweightImageTiles(
						this.scene?.imageVariants ?? null,
						view,
						window.devicePixelRatio || 1,
					)
				: [];
		const imageTilesRevision = imageTiles.map((tile) => tile.source).join("\u0000");
		if (imageTilesRevision !== this.imageTilesRevision) {
			this.imageTiles = imageTiles;
			this.imageTilesRevision = imageTilesRevision;
			this.renderSceneCachedRevision = "";
		}
		const renderScene = this.renderScene();
		if (!renderScene) return { imagePresented: false, ready: false };
		return this.renderer.draw(renderScene, {
			...view,
			colorCache: this.features.cameraNavigation === false,
		});
	}

	/**
	 * Returns the top visible object at one map point.
	 *
	 * @param point - The map-space pointer position.
	 * @returns The source scene hit, hero hit, selected marker, or `null`.
	 */
	pick(point: MapPoint): MapLightweightHit | null {
		if (!this.view) return null;
		const hit = this.renderer.pick(
			point.x * this.view.zoom + this.view.panX,
			point.y * this.view.zoom + this.view.panY,
		);
		if (hit?.kind !== "element") return null;
		if (hit.elementId === this.selectedRenderId) return { kind: "selected-position" };
		const hero = this.heroByRenderId.get(hit.elementId);
		if (hero) return { kind: "hero", placement: hero };
		const entry = this.entryByRenderId.get(hit.elementId);
		return entry ? { kind: "element", entry } : null;
	}

	/**
	 * Releases the shared renderer resources.
	 *
	 * @returns Nothing.
	 */
	destroy(): void {
		this.renderer.destroy();
		this.renderSceneCached = null;
		this.renderBaseCached = null;
	}

	/**
	 * Tests zone and region visibility for one source entry.
	 *
	 * @param entry - The source scene entry.
	 * @param elements - All source map elements.
	 * @returns `true` when the entry can render and receive pointer hits.
	 */
	private entryVisible(entry: MapPresetSceneElement, elements: MapElement[]): boolean {
		if (!this.scene) return false;
		if (!entry.zoneId) return true;
		if (this.scene.preset.zoneIds?.includes(entry.zoneId)) return true;
		return mapVisibilityZoneIsExpanded(
			entry.zoneId,
			this.scene.visibilityZones,
			this.expandedZoneIds,
		);
	}

	/**
	 * Builds the static portion of an embedded scene.
	 *
	 * @param scene - The pruned preset scene.
	 * @returns Static elements, resources, labels, and translated interaction identifiers.
	 */
	private renderBase(scene: MapPresetScene): MapLightweightBase {
		if (this.renderBaseCachedRevision === this.sceneRevision && this.renderBaseCached) {
			return this.renderBaseCached;
		}
		const entries = this.features.objectRendering === false ? [] : scene.elements;
		const elementsSource = entries.map((entry) => entry.element);
		const mode =
			this.focusedRegionId === scene.focusedRegionId
				? (this.features.regionFocusMode ?? scene.focusedRegionMode)
				: undefined;
		const visibleIds = new Set(
			mapElementsFocusVisible(
				elementsSource,
				this.focusedRegionId,
				mode === undefined || mode === "composite",
			).map((element) => element.id),
		);
		const entryByKey = new Map(
			entries.map((entry) => [`${entry.zoneId ?? ""}:${entry.element.id}`, entry]),
		);
		const idByEntry = new Map<MapPresetSceneElement, string>();
		for (const [index, entry] of entries.entries()) {
			idByEntry.set(entry, mapLightweightEntryId(entry, index));
		}
		const entryParent = (entry: MapPresetSceneElement) =>
			entryByKey.get(`${entry.zoneId ?? ""}:${entry.element.parentRegionId}`) ??
			entryByKey.get(`:${entry.element.parentRegionId}`);
		this.entryByRenderId.clear();
		this.heroByRenderId.clear();
		const elements: MapElement[] = [];
		const elementsAll: MapElement[] = [];
		const nameLayouts: MapRenderScene["nameLayouts"] = new Map();
		let focusedRenderId: string | null = null;
		for (const entry of entries) {
			const id = idByEntry.get(entry);
			if (!id) continue;
			const elementOpacity = entry.element;
			const parent = entryParent(entry);
			const element = {
				...elementOpacity,
				id,
				...(parent && idByEntry.get(parent)
					? { parentRegionId: idByEntry.get(parent) }
					: { parentRegionId: undefined }),
			} as MapElement;
			elementsAll.push(element);
			if (!visibleIds.has(entry.element.id) || !this.entryVisible(entry, elementsSource))
				continue;
			let names = this.namesCached.get(entry.element);
			if (!names) {
				names = mapLightweightNameLayouts([entry.element]);
				this.namesCached.set(entry.element, names);
			}
			const layout = names.get(entry.element.id);
			if (layout) nameLayouts.set(id, layout);
			elements.push(element);
			this.entryByRenderId.set(id, entry);
			if (entry.element.id === this.focusedRegionId && entry.element.type === "region") {
				focusedRenderId = id;
			}
		}
		const layerId = scene.preset.layerIds.at(-1) ?? scene.layers.at(-1)?.id ?? "embedded";
		const symbolSources = new Map(
			this.features.objectRendering === false ? [] : Object.entries(scene.symbolSources),
		);
		if (this.heroMarkersEnabled) {
			for (const [index, placement] of scene.heroPlacements.entries()) {
				if (
					placement.visibilityZoneId &&
					!scene.preset.zoneIds?.includes(placement.visibilityZoneId) &&
					!mapVisibilityZoneIsExpanded(
						placement.visibilityZoneId,
						scene.visibilityZones,
						this.expandedZoneIds,
					)
				)
					continue;
				const id = `embedded:hero:${index}:${placement.heroUid}`;
				elements.push(
					mapLightweightHeroElement(
						id,
						{ x: placement.positionX, y: placement.positionY },
						scene.image,
						layerId,
						{ title: placement.name, url: placement.profileUrl },
					),
				);
				symbolSources.set(id, placement.avatarUrl || "/assets/misc/question512.jpg");
				this.heroByRenderId.set(id, placement);
			}
		}
		const highlightRenderId = this.highlightedId
			? ([...this.entryByRenderId].find(
					([, entry]) => entry.element.id === this.highlightedId,
				)?.[0] ?? null)
			: null;
		const elementsSorted = sortMapElements(
			elements,
			scene.layers.map((layer) => layer.id),
			scene.preset.layerIds,
		);
		this.renderBaseCached = {
			elements: elementsSorted,
			symbolSources,
			nameLayouts,
			elementsAll,
			focusedRenderId,
			highlightRenderId,
			layerId,
		};
		this.renderBaseCachedRevision = this.sceneRevision;
		return this.renderBaseCached;
	}

	/**
	 * Builds a renderer scene from static preset data and dynamic visibility flags.
	 *
	 * @returns A complete render scene, or `null` before scene setup.
	 */
	private renderScene(): MapRenderScene | null {
		const renderRevision = `${this.sceneRevision}:${this.markerRevision}:${this.highlightRevision}:${this.imageTilesRevision}`;
		if (this.renderSceneCachedRevision === renderRevision) {
			return this.renderSceneCached;
		}
		const scene = this.scene;
		if (!scene) return null;
		const base = this.renderBase(scene);
		this.selectedRenderId = null;
		const elements = this.selectedPosition ? [...base.elements] : base.elements;
		const symbolSources = new Map(base.symbolSources);
		if (this.selectedPosition) {
			const id = "embedded:selected-position";
			if (this.features.positionMarker === "pin") {
				elements.push(
					mapLightweightPositionElement(
						id,
						this.selectedPosition,
						scene.image,
						base.layerId,
					),
				);
			} else {
				elements.push(
					mapLightweightHeroElement(id, this.selectedPosition, scene.image, base.layerId),
				);
				symbolSources.set(id, this.selectedAvatarUrl || "/assets/misc/question512.jpg");
			}
			this.selectedRenderId = id;
		}
		const config: MapConfig = {
			version: 2,
			image: scene.image,
			scale: scene.scale,
			layers: scene.layers,
			elements,
			military: scene.military,
			visibilityZones: this.features.visibilityZones ? scene.visibilityZones : [],
			grid: null,
			viewPresets: [scene.preset],
		};
		const revision = `${scene.revision}:${this.sceneRevision}:${base.focusedRenderId ?? ""}`;
		const highlightRenderId = this.highlightedId
			? ([...this.entryByRenderId].find(
					([, entry]) => entry.element.id === this.highlightedId,
				)?.[0] ?? null)
			: null;
		const overlay = mapLightweightOverlay(highlightRenderId);
		overlay.editingElementId = this.selectedRenderId;
		const renderScene: MapRenderScene = {
			contentRevision: revision,
			orderRevision: elements
				.filter((element) => element.id !== this.selectedRenderId)
				.map((element) => element.id)
				.join("\u0000"),
			editingRevision: `${revision}:marker:${this.markerRevision}`,
			visibilityRevision: `${revision}:${scene.preset.layerIds.join("\u0000")}`,
			rulerRevision: "embedded",
			overlayRevision: `${highlightRenderId ?? ""}:${revision}`,
			activeLayerIds: [...new Set([...scene.preset.layerIds, base.layerId])],
			config,
			elements,
			elementsAll: base.elementsAll,
			interactiveElementIds: new Set(
				elements
					.filter((element) => Boolean(mapElementLabelName(element)))
					.map((element) => element.id),
			),
			focusedRegionId: base.focusedRenderId,
			focusedRegionMode:
				this.focusedRegionId === scene.focusedRegionId
					? (this.features.regionFocusMode ?? scene.focusedRegionMode)
					: undefined,
			imageSource:
				this.features.imageDetail === "source"
					? scene.image.src
					: (scene.imageVariants?.overview.src ?? scene.image.src),
			imageElement: this.imageElement,
			imageTiles: this.imageTiles,
			symbolSources,
			nameLayouts: base.nameLayouts,
			overlay,
		};
		this.renderSceneCached = renderScene;
		this.renderSceneCachedRevision = renderRevision;
		return renderScene;
	}
}
