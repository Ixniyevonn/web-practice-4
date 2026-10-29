import {
	MAP_MILITARY_CONFIG_DEFAULT,
	mapTacticalCatalogItem,
	parseMapTacticalParameters,
} from "$lib/map/tactical-catalog";
import type {
	MapElement,
	MapElementTactical,
	MapMilitaryConfig,
	MapTacticalKind,
} from "$lib/map/types";

/** Converts a stored tactical object to its geometry family.
 * @param element - The stored object.
 * @returns The object with shared region, path, or symbol geometry.
 */
export function mapElementFamilyNormalize(element: MapElement): MapElement {
	if (element.type !== "tactical") return element;
	const { type, kind, points, smoothing, stylePresetId, parameters, ...base } = element;
	if (kind === "unit") {
		const { size = 56, rotation = 0, ...parametersUnit } = parameters;
		return {
			...base,
			type: "symbol",
			subtype: "unit",
			assetUid: "unit",
			center: points[0] ?? { x: 0, y: 0 },
			width: Number(size),
			height: Number(size) * 0.68,
			rotation: Number(rotation),
			parameters: parametersUnit,
		};
	}
	if (kind === "kill-zone")
		return { ...base, type: "region", subtype: kind, points, smoothing, parameters };
	return {
		...base,
		type: "path",
		subtype: kind === "boundary" ? kind : "arrow",
		points,
		smoothing,
		parameters,
	};
}

/** Checks subtype parameters and supplies their defaults.
 * @param element - The map object to check.
 * @param military - The available unit roles and echelons.
 * @returns A normalized object with complete subtype parameters.
 * @throws An error when a parameter is not valid.
 */
export function mapElementParametersNormalize(
	element: MapElement,
	military: MapMilitaryConfig,
): MapElement {
	const source = mapElementFamilyNormalize(element);
	const recipe = mapElementTacticalRecipe(source);
	if (!recipe) return source;
	const parameters = "parameters" in source ? { ...source.parameters } : {};
	if (recipe.kind === "unit") {
		delete parameters.size;
		delete parameters.rotation;
	}
	const normalized = parseMapTacticalParameters(recipe.kind, parameters, military);
	if (recipe.kind === "unit") {
		delete normalized.size;
		delete normalized.rotation;
	}
	return { ...source, parameters: normalized } as MapElement;
}

/** Gets the decoration recipe for shared object geometry.
 * @param element - The object with shared geometry.
 * @returns A recipe input, or null for an undecorated object.
 */
export function mapElementTacticalRecipe(element: MapElement): MapElementTactical | null {
	if (element.type === "tactical") return element;
	if (!("subtype" in element) || !element.subtype || element.subtype === "default") return null;
	const kind = element.subtype;
	return {
		id: element.id,
		layerIds: element.layerIds,
		type: "tactical",
		kind,
		points: element.type === "symbol" ? [element.center] : element.points,
		smoothing: element.type === "symbol" ? 0 : element.smoothing,
		style: element.style ?? {
			borderColor: "#e4b472",
			borderOpacity: 1,
			borderWidth: 2,
			fillColor: "#14191f",
			fillOpacity: 1,
		},
		stylePresetId: mapTacticalCatalogItem(kind)?.stylePresetId ?? "tactical-unit",
		parameters:
			element.type === "symbol"
				? {
						...element.parameters,
						size: element.width,
						height: element.height,
						rotation: element.rotation,
					}
				: { ...element.parameters },
	};
}

/** Changes a subtype without changing its geometry or identity.
 * @param element - The source object.
 * @param subtype - A subtype in the same geometry family.
 * @param military - The available unit roles and echelons.
 * @returns A copy with subtype defaults, or the source for an incompatible subtype.
 */
export function mapElementSubtypeChange(
	element: MapElement,
	subtype: string,
	military: MapMilitaryConfig = MAP_MILITARY_CONFIG_DEFAULT,
): MapElement {
	const source = mapElementFamilyNormalize(element);
	const allowed =
		source.type === "region"
			? ["default", "kill-zone"]
			: source.type === "path"
				? ["default", "boundary", "arrow"]
				: source.type === "symbol"
					? ["default", "unit"]
					: [];
	if (!allowed.includes(subtype)) return source;
	const parameters =
		subtype === "default"
			? undefined
			: parseMapTacticalParameters(
					subtype as MapTacticalKind,
					subtype === "unit"
						? {
								role: military.roles[0]?.id ?? "infantry",
								echelon: military.echelons[0]?.id ?? "company",
							}
						: {},
					military,
				);
	if (parameters && subtype === "unit") {
		delete parameters.size;
		delete parameters.rotation;
	}
	return { ...source, subtype, parameters } as MapElement;
}

/** Applies copied settings without moving or renaming the target.
 * @param target - The object that receives the settings.
 * @param source - The object with the copied settings.
 * @returns An independent object with the target identity and geometry.
 */
export function mapElementParametersApply(target: MapElement, source: MapElement): MapElement {
	const result = structuredClone(mapElementFamilyNormalize(target));
	const settings = structuredClone(mapElementFamilyNormalize(source));
	result.layerIds = settings.layerIds;
	if (settings.style) result.style = settings.style;
	if (result.type === settings.type && "subtype" in result) {
		Object.assign(result, {
			subtype: "subtype" in settings ? settings.subtype : "default",
			parameters: "parameters" in settings ? settings.parameters : undefined,
		});
	} else if (result.type === settings.type && "subtype" in settings) {
		Object.assign(result, { subtype: settings.subtype, parameters: settings.parameters });
	}
	if (
		(result.type === "region" || result.type === "path") &&
		(settings.type === "region" || settings.type === "path")
	)
		result.smoothing = settings.smoothing;
	if (
		(result.type === "region" || result.type === "area") &&
		(settings.type === "region" || settings.type === "area")
	) {
		const anchor = result.nameArc?.anchor;
		result.nameArc = settings.nameArc;
		if (result.type === "region" && result.nameArc?.anchor) {
			const xs = result.points.map((point) => point.x);
			const ys = result.points.map((point) => point.y);
			result.nameArc.anchor = anchor ?? {
				x: (Math.min(...xs) + Math.max(...xs)) / 2,
				y: (Math.min(...ys) + Math.max(...ys)) / 2,
			};
		}
	}
	if (result.type === "region" && settings.type === "region")
		result.focusChildren = settings.focusChildren;
	if (result.type === "path" && settings.type === "path") result.label = settings.label;
	if (result.type === "area" && settings.type === "area") result.radius = settings.radius;
	if (result.type === "symbol" && settings.type === "symbol") {
		result.assetUid = settings.assetUid;
		result.shape = settings.shape;
		result.label = settings.label;
	}
	if (
		(result.type === "symbol" && settings.type === "symbol") ||
		(result.type === "grid" && settings.type === "grid")
	) {
		result.width = settings.width;
		result.height = settings.height;
		result.rotation = settings.rotation;
	}
	if (result.type === "grid" && settings.type === "grid") {
		result.columnCount = settings.columnCount;
		result.rowCount = settings.rowCount;
		result.subdivisionCount = settings.subdivisionCount;
	}
	return result;
}
