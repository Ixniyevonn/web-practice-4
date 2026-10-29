import type { MapLayer } from "$lib/map/types";

export const MAP_LAYER_ACTIVE_KEY = "map-layer-active";

/**
 * Gets the configured default layers.
 *
 * @param layers - The ordered map layers from bottom to top.
 * @returns The compatible default layer ids in their configured order.
 */
export function mapLayerDefaultIds(layers: MapLayer[]): string[] {
	const defaults = layers
		.filter((layer) => layer.enabledDefault !== false)
		.map((layer) => layer.id);
	return mapLayerActiveNormalize(
		defaults.length > 0 ? defaults : [layers.at(-1)?.id ?? ""],
		layers,
	);
}

/**
 * Gets all valid incompatibility links for one layer.
 *
 * A link on either layer makes the relationship symmetric.
 *
 * @param layerId - The layer to examine.
 * @param layers - The current map layers.
 * @returns The ids of layers that cannot be active with the selected layer.
 */
export function mapLayerIncompatibleIds(layerId: string, layers: MapLayer[]): string[] {
	const idsValid = new Set(layers.map((layer) => layer.id));
	const ids = new Set<string>();
	for (const layer of layers) {
		if (layer.id === layerId) {
			for (const id of layer.incompatibleLayerIds ?? []) {
				if (id !== layerId && idsValid.has(id)) ids.add(id);
			}
		} else if (layer.incompatibleLayerIds?.includes(layerId)) {
			ids.add(layer.id);
		}
	}
	return layers.map((layer) => layer.id).filter((id) => ids.has(id));
}

/**
 * Makes all layer incompatibility links symmetric.
 *
 * @param layers - The map layers to normalize.
 * @returns New layer records with valid symmetric links.
 */
export function mapLayerIncompatibilitiesNormalize(layers: MapLayer[]): MapLayer[] {
	return layers.map((layer) => {
		const incompatibleLayerIds = mapLayerIncompatibleIds(layer.id, layers);
		const { incompatibleLayerIds: _incompatibleLayerIds, ...layerBase } = layer;
		return {
			...layerBase,
			...(incompatibleLayerIds.length > 0 ? { incompatibleLayerIds } : {}),
		};
	});
}

/**
 * Removes invalid and incompatible active layers.
 *
 * A later id has priority when two selected layers are incompatible.
 *
 * @param layerIds - The requested active layer ids in activation order.
 * @param layers - The current map layers.
 * @returns The compatible active layer ids in activation order.
 */
export function mapLayerActiveNormalize(layerIds: string[], layers: MapLayer[]): string[] {
	const idsValid = new Set(layers.map((layer) => layer.id));
	const active: string[] = [];
	for (const layerId of layerIds) {
		if (!layerId || !idsValid.has(layerId)) continue;
		const incompatible = new Set(mapLayerIncompatibleIds(layerId, layers));
		for (let index = active.length - 1; index >= 0; index -= 1) {
			if (incompatible.has(active[index] ?? "")) active.splice(index, 1);
		}
		const previous = active.indexOf(layerId);
		if (previous >= 0) active.splice(previous, 1);
		active.push(layerId);
	}
	return active;
}

/**
 * Reads active layers from browser storage.
 *
 * The reader accepts the old single-layer value for backward compatibility.
 *
 * @param raw - The stored JSON string, or `null` when no value exists.
 * @param layers - The current map layers.
 * @returns Valid compatible active layer ids.
 */
export function mapLayerActiveRead(raw: string | null, layers: MapLayer[]): string[] {
	if (raw) {
		try {
			const parsed: unknown = JSON.parse(raw);
			if (Array.isArray(parsed) && parsed.length === 0) return [];
			const requested =
				typeof parsed === "string"
					? [parsed]
					: Array.isArray(parsed)
						? parsed.filter((id): id is string => typeof id === "string")
						: [];
			const active = mapLayerActiveNormalize(requested, layers);
			if (active.length > 0) return active;
		} catch {
			return mapLayerDefaultIds(layers);
		}
	}
	return mapLayerDefaultIds(layers);
}

/**
 * Serializes active layers for browser storage.
 *
 * @param layerIds - The active layer ids in activation order.
 * @returns The JSON string to store.
 */
export function mapLayerActiveStringify(layerIds: string[]): string {
	return JSON.stringify(layerIds);
}
