import { mapWebglElementMeshes } from "$lib/map/webgl-geometry";
import { mapLayerActiveNormalize, mapLayerDefaultIds } from "$lib/map/layers";
import type {
	MapBounds,
	MapConfig,
	MapElement,
	MapGridConfig,
	MapHeroPlacement,
	MapImageVariantManifest,
	MapLayer,
	MapMilitaryConfig,
	MapViewPreset,
	MapVisibilityZone,
} from "$lib/map/types";

export type MapPresetSceneElement = {
	element: MapElement;
	zoneId: string | null;
	bounds: MapBounds;
};

export type MapPresetScene = {
	focusedRegionId?: string;
	focusedRegionMode?: "region" | "composite" | "multilayer";
	revision: string;
	preset: MapViewPreset;
	image: MapConfig["image"];
	scale: MapConfig["scale"];
	layers: MapLayer[];
	military: MapMilitaryConfig;
	elements: MapPresetSceneElement[];
	visibilityZones: MapVisibilityZone[];
	grid: MapGridConfig | null;
	heroPlacements: MapHeroPlacement[];
	symbolSources: Record<string, string>;
	imageVariants: MapImageVariantManifest | null;
};

/**
 * Tests whether two map bounds intersect.
 *
 * @param left - The first bounds.
 * @param right - The second bounds.
 * @returns `true` when the bounds share any area.
 */
export function mapBoundsIntersect(left: MapBounds, right: MapBounds): boolean {
	return !(
		left.maxX < right.minX ||
		left.minX > right.maxX ||
		left.maxY < right.minY ||
		left.minY > right.maxY
	);
}

/**
 * Resolves a configured preset or the full-map fallback.
 *
 * @param config - The current map config.
 * @param presetId - The requested stable preset identifier.
 * @returns The configured preset or a full-map compatible preset.
 */
export function mapViewPresetResolve(config: MapConfig, presetId: string): MapViewPreset {
	return (
		config.viewPresets.find((preset) => preset.id === presetId) ?? {
			id: presetId,
			name: presetId,
			layerIds: mapLayerDefaultIds(config.layers),
			bounds: { minX: 0, minY: 0, maxX: config.image.width, maxY: config.image.height },
			center: { x: config.image.width / 2, y: config.image.height / 2 },
			zoomInitial: 1,
			zoomMinimum: 0.25,
			zoomMaximum: 8,
			gridEnabled: Boolean(config.grid?.enabledDefault),
			publicHeroesEnabled: false,
		}
	);
}

/**
 * Filters elements by preset layers and bounds.
 *
 * @param elements - The candidate map elements.
 * @param preset - The selected map preset.
 * @param zoneId - The direct zone scope, or `null` for global scope.
 * @returns Bounded scene elements in their input order.
 */
export function mapPresetElementsFilter(
	elements: MapElement[],
	preset: MapViewPreset,
	zoneId: string | null,
): MapPresetSceneElement[] {
	const layerIds = new Set(preset.layerIds);
	return elements.flatMap((element) => {
		if (!element.layerIds.some((layerId) => layerIds.has(layerId))) return [];
		const bounds = mapWebglElementMeshes(element).pick.bounds;
		return mapBoundsIntersect(bounds, preset.bounds) ? [{ element, zoneId, bounds }] : [];
	});
}

/**
 * Removes scene data that the selected preset cannot render.
 *
 * @param scene - The preset scene to reduce.
 * @returns A scene with only selected layers, elements, zones, heroes, and SVG sources.
 */
export function mapPresetScenePrune(scene: MapPresetScene): MapPresetScene {
	const layerIdsRequested = new Set(mapLayerActiveNormalize(scene.preset.layerIds, scene.layers));
	const layers = scene.layers.filter((layer) => layerIdsRequested.has(layer.id));
	const layerIds = new Set(layers.map((layer) => layer.id));
	const elements = scene.elements.filter((entry) =>
		entry.element.layerIds.some((layerId) => layerIds.has(layerId)),
	);
	const visibilityZones = scene.visibilityZones.filter((zone) =>
		zone.layerIds.some((layerId) => layerIds.has(layerId)),
	);
	const symbolAssetUids = new Set<string>();
	const militaryRoleIds = new Set<string>();
	const militaryEchelonIds = new Set<string>();
	for (const { element } of elements) {
		if (element.type === "symbol") symbolAssetUids.add(element.assetUid);
		if (
			!(element.type === "tactical" && element.kind === "unit") &&
			!(element.type === "symbol" && element.subtype === "unit")
		)
			continue;
		militaryRoleIds.add(String(element.parameters?.role ?? ""));
		militaryEchelonIds.add(String(element.parameters?.echelon ?? ""));
		const role = scene.military.roles.find(
			(entry) => entry.id === String(element.parameters?.role ?? ""),
		);
		const echelon = scene.military.echelons.find(
			(entry) => entry.id === String(element.parameters?.echelon ?? ""),
		);
		if (role?.assetUid) symbolAssetUids.add(role.assetUid);
		if (echelon?.assetUid) symbolAssetUids.add(echelon.assetUid);
	}
	return {
		...scene,
		preset: { ...scene.preset, layerIds: [...layerIds] },
		layers,
		elements,
		visibilityZones,
		grid: null,
		military: {
			roles: scene.military.roles.filter((entry) => militaryRoleIds.has(entry.id)),
			echelons: scene.military.echelons.filter((entry) => militaryEchelonIds.has(entry.id)),
		},
		heroPlacements:
			scene.preset.publicHeroesEnabled && layers.some((layer) => layer.type === "user-heroes")
				? scene.heroPlacements
				: [],
		symbolSources: Object.fromEntries(
			Object.entries(scene.symbolSources).filter(([uid]) => symbolAssetUids.has(uid)),
		),
	};
}
