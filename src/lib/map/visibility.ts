import { mapPointInPolygon } from "$lib/map/name-arc";
import type {
	MapDisplayFeatures,
	MapElement,
	MapElementRegion,
	MapPoint,
	MapVisibilityZone,
} from "$lib/map/types";

/**
 * Gets the fill, label, and border rules for a region.
 * @param composite - Whether the region has direct children.
 * @param focused - Whether this region has focus.
 * @param mode - The focus mode, or undefined for automatic child focus.
 * @returns The visual rules for the region.
 */
export function mapRegionFocusDisplay(
	composite: boolean,
	focused: boolean,
	mode?: MapDisplayFeatures["regionFocusMode"],
) {
	const multilayer = focused && mode === "multilayer";
	const expanded = focused && composite && mode !== "region" && mode !== "multilayer";
	return {
		fillVisible: !multilayer && !expanded,
		labelVisible: !multilayer && !expanded,
		borderScale: multilayer ? 2 : 1,
		checkered: composite && !expanded,
	};
}

/**
 * Selects the global objects and the focused region branch.
 * @param elements - All map elements with stable identifiers.
 * @param focusedRegionId - The focused region identifier, or null.
 * @param revealChildren - Whether the direct children can draw.
 * @returns Visible elements in their source order.
 */
export function mapElementsFocusVisible(
	elements: MapElement[],
	focusedRegionId: string | null,
	revealChildren = true,
): MapElement[] {
	const elementById = new Map(elements.map((element) => [element.id, element]));
	const ancestors = new Set<string>();
	let parentId = focusedRegionId ? elementById.get(focusedRegionId)?.parentRegionId : undefined;
	while (parentId && !ancestors.has(parentId)) {
		ancestors.add(parentId);
		parentId = elementById.get(parentId)?.parentRegionId;
	}
	return elements.filter(
		(element) =>
			!element.parentRegionId ||
			element.id === focusedRegionId ||
			ancestors.has(element.id) ||
			(revealChildren && element.parentRegionId === focusedRegionId),
	);
}

/**
 * Gets the parent-region identifiers for one map element.
 *
 * @param element - The element whose scope starts the search.
 * @param elements - All elements in the map config.
 * @returns Parent identifiers from the direct parent through the root.
 */
export function mapElementRegionAncestors(element: MapElement, elements: MapElement[]): string[] {
	const elementById = new Map(elements.map((entry) => [entry.id, entry]));
	const ancestors: string[] = [];
	let parentId = element.parentRegionId;
	while (parentId && !ancestors.includes(parentId)) {
		ancestors.push(parentId);
		parentId = elementById.get(parentId)?.parentRegionId;
	}
	return ancestors;
}

/**
 * Finds the nearest focus ancestor at a clicked point.
 *
 * @param region - The region that currently has focus.
 * @param elements - All map elements.
 * @param point - The clicked map point.
 * @param preferredId - The clicked region identifier, when picking found one.
 * @returns The clicked ancestor, the nearest containing ancestor, or `null`.
 */
export function mapElementRegionFocusAncestor(
	region: MapElementRegion,
	elements: MapElement[],
	point: MapPoint,
	preferredId: string | null = null,
): MapElementRegion | null {
	const ancestorIds = mapElementRegionAncestors(region, elements);
	const preferred = elements.find(
		(entry): entry is MapElementRegion =>
			entry.id === preferredId && entry.type === "region" && ancestorIds.includes(entry.id),
	);
	if (preferred) return preferred;
	for (const ancestorId of ancestorIds) {
		const ancestor = elements.find(
			(entry): entry is MapElementRegion =>
				entry.id === ancestorId && entry.type === "region",
		);
		if (ancestor && mapPointInPolygon(point, ancestor.points)) return ancestor;
	}
	return null;
}

/**
 * Tests whether an element can draw for the current region focus.
 *
 * @param element - The candidate element.
 * @param elements - All elements in the map config.
 * @param focusedRegionId - The focused region identifier, or `null`.
 * @returns `true` for global elements, focus ancestors, and direct children.
 */
export function mapElementFocusVisible(
	element: MapElement,
	elements: MapElement[],
	focusedRegionId: string | null,
): boolean {
	if (!element.parentRegionId) return true;
	if (!focusedRegionId) return false;
	if (element.id === focusedRegionId) return true;
	const focused = elements.find((entry) => entry.id === focusedRegionId);
	if (focused && mapElementRegionAncestors(focused, elements).includes(element.id)) return true;
	return element.parentRegionId === focusedRegionId;
}

/**
 * Gets the opacity multiplier for one visible element during region focus.
 *
 * @param element - The visible element.
 * @param elements - All elements in the map config.
 * @param focusedRegionId - The focused region identifier, or `null`.
 * @returns Full opacity for the focus branch and low opacity for other elements.
 */
export function mapElementFocusOpacity(
	element: MapElement,
	elements: MapElement[],
	focusedRegionId: string | null,
): number {
	if (!focusedRegionId) return 1;
	if (element.id === focusedRegionId) return 1;
	return mapElementRegionAncestors(element, elements).includes(focusedRegionId) ? 1 : 0.08;
}

/**
 * Gets the ordered parent identifiers for one zone.
 *
 * @param zoneId - The child zone identifier.
 * @param zones - The complete validated zone tree.
 * @returns Parent identifiers from the direct parent through the root.
 */
export function mapVisibilityZoneAncestors(zoneId: string, zones: MapVisibilityZone[]): string[] {
	const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
	const ancestors: string[] = [];
	let parentId = zoneById.get(zoneId)?.parentZoneId;
	while (parentId) {
		ancestors.push(parentId);
		parentId = zoneById.get(parentId)?.parentZoneId;
	}
	return ancestors;
}

/**
 * Tests whether a zone and all its parents are expanded.
 *
 * @param zoneId - The zone identifier.
 * @param zones - The complete validated zone tree.
 * @param expandedIds - The expanded zone identifiers.
 * @returns `true` when the zone and all parents are expanded.
 */
export function mapVisibilityZoneIsExpanded(
	zoneId: string,
	zones: MapVisibilityZone[],
	expandedIds: ReadonlySet<string>,
): boolean {
	return (
		expandedIds.has(zoneId) &&
		mapVisibilityZoneAncestors(zoneId, zones).every((id) => expandedIds.has(id))
	);
}

/**
 * Finds the deepest zone that contains a point.
 *
 * @param point - The point in map coordinates.
 * @param zones - The complete validated zone tree.
 * @param availableIds - Optional zone identifiers that the caller can use.
 * @returns The deepest containing zone identifier, or `null` for global scope.
 */
export function mapVisibilityZoneForPoint(
	point: MapPoint,
	zones: MapVisibilityZone[],
	availableIds?: ReadonlySet<string>,
): string | null {
	let match: { id: string; depth: number } | null = null;
	for (const zone of zones) {
		if (availableIds && !availableIds.has(zone.id)) continue;
		if (!mapPointInPolygon(point, zone.points)) continue;
		const depth = mapVisibilityZoneAncestors(zone.id, zones).length;
		if (!match || depth > match.depth) match = { id: zone.id, depth };
	}
	return match?.id ?? null;
}

/**
 * Gets the browser key for expanded zones in one config revision.
 *
 * @param revision - The active map revision.
 * @returns A versioned local-storage key.
 */
export function mapVisibilityStorageKey(revision: string): string {
	return `map:visibility-zones:v2:${revision}`;
}
