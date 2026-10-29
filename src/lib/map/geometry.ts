import type { MapBounds, MapElement, MapPoint } from "$lib/map/types";

export type { MapBounds } from "$lib/map/types";

/**
 * Limits a number to an inclusive range.
 *
 * @param value - The number to limit.
 * @param minimum - The smallest result.
 * @param maximum - The largest result.
 * @returns The limited number.
 */
export function clampMapNumber(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Collects water-edge indexes between consecutive selected points.
 *
 * @param selected - Selected point indexes.
 * @param pointCount - The number of points in the path.
 * @param closed - Whether the last point connects to the first point.
 * @returns Start indexes of edges that join two selected points.
 */
export function mapWaterEdgesBetweenPoints(
	selected: number[],
	pointCount: number,
	closed: boolean,
): number[] {
	if (pointCount < 2 || selected.length < 2) return [];
	const chosen = new Set(selected.filter((index) => index >= 0 && index < pointCount));
	const edges: number[] = [];
	for (const index of chosen) {
		const next = (index + 1) % pointCount;
		if (!closed && index === pointCount - 1) continue;
		if (chosen.has(next)) edges.push(index);
	}
	return edges.sort((left, right) => left - right);
}

/**
 * Adds or removes a group of water-edge indexes.
 *
 * @param current - The stored water-edge indexes.
 * @param next - The indexes that the user selected.
 * @returns The next stored water-edge indexes.
 */
export function toggleMapWaterEdges(current: number[], next: number[]): number[] {
	if (next.length === 0) return [...new Set(current)].sort((left, right) => left - right);
	const edges = new Set(current);
	const allOn = next.every((index) => edges.has(index));
	for (const index of next) {
		if (allOn) edges.delete(index);
		else edges.add(index);
	}
	return [...edges].sort((left, right) => left - right);
}

/**
 * Shifts water-edge indexes after a point insert.
 *
 * If the insert splits a water edge, the new point is also a water-edge start.
 *
 * @param edges - The stored water-edge indexes.
 * @param insertIndex - The index of the new point.
 * @returns The shifted water-edge indexes.
 */
export function remapMapWaterEdgesAfterInsert(edges: number[], insertIndex: number): number[] {
	const previous = insertIndex - 1;
	const splitWater = previous >= 0 && edges.includes(previous);
	const shifted = edges.map((start) => (start >= insertIndex ? start + 1 : start));
	if (splitWater) shifted.push(insertIndex);
	return [...new Set(shifted)].sort((left, right) => left - right);
}

/**
 * Shifts water-edge indexes after a point delete.
 *
 * @param edges - The stored water-edge indexes.
 * @param removeIndex - The index of the removed point.
 * @returns The shifted water-edge indexes.
 */
export function remapMapWaterEdgesAfterRemove(edges: number[], removeIndex: number): number[] {
	return edges
		.filter((start) => start !== removeIndex)
		.map((start) => (start > removeIndex ? start - 1 : start));
}

/**
 * Finds the axis-aligned bounds of a point list.
 *
 * @param points - The points to measure.
 * @returns The minimum and maximum coordinates.
 */
export function mapPointsBounds(points: MapPoint[]): MapBounds {
	const first = points[0] ?? { x: 0, y: 0 };
	let minX = first.x;
	let minY = first.y;
	let maxX = first.x;
	let maxY = first.y;
	for (const point of points) {
		minX = Math.min(minX, point.x);
		minY = Math.min(minY, point.y);
		maxX = Math.max(maxX, point.x);
		maxY = Math.max(maxY, point.y);
	}
	return { minX, minY, maxX, maxY };
}

/**
 * Finds the axis-aligned bounds of a circle.
 *
 * @param center - The circle center.
 * @param radius - The circle radius.
 * @returns The minimum and maximum coordinates.
 */
export function mapCircleBounds(center: MapPoint, radius: number): MapBounds {
	return {
		minX: center.x - radius,
		minY: center.y - radius,
		maxX: center.x + radius,
		maxY: center.y + radius,
	};
}

/**
 * Calculates a linear-gradient line across a bounding box.
 *
 * Angle 0 points to the right. Angle 90 points down.
 *
 * @param bounds - The fill bounds in map coordinates.
 * @param angle - The gradient angle in degrees.
 * @returns The gradient line in map coordinates.
 */
export function mapGradientLine(
	bounds: MapBounds,
	angle: number,
): { x1: number; y1: number; x2: number; y2: number } {
	const width = bounds.maxX - bounds.minX;
	const height = bounds.maxY - bounds.minY;
	const centerX = (bounds.minX + bounds.maxX) / 2;
	const centerY = (bounds.minY + bounds.maxY) / 2;
	const radius = Math.max(Math.hypot(width, height) / 2, 1);
	const radians = ((angle % 360) * Math.PI) / 180;
	const deltaX = Math.cos(radians) * radius;
	const deltaY = Math.sin(radians) * radius;
	return {
		x1: centerX - deltaX,
		y1: centerY - deltaY,
		x2: centerX + deltaX,
		y2: centerY + deltaY,
	};
}

/**
 * Calculates the midpoint of two map points.
 *
 * @param start - The first point.
 * @param end - The second point.
 * @returns The point halfway between the input points.
 */
export function mapPointMidpoint(start: MapPoint, end: MapPoint): MapPoint {
	return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

/**
 * Calculates a scaled distance between two map points.
 *
 * @param start - The first point.
 * @param end - The second point.
 * @param scaleX - The horizontal distance for one map pixel.
 * @param scaleY - The vertical distance for one map pixel.
 * @returns The distance in configured map units.
 */
export function mapPointDistance(
	start: MapPoint,
	end: MapPoint,
	scaleX: number,
	scaleY: number,
): number {
	return Math.hypot((end.x - start.x) * scaleX, (end.y - start.y) * scaleY);
}

/**
 * Calculates the scaled length of a map path.
 *
 * @param points - The path points in order.
 * @param scaleX - The horizontal distance for one map pixel.
 * @param scaleY - The vertical distance for one map pixel.
 * @returns The sum of all segment lengths in configured map units.
 */
export function mapPathDistance(points: MapPoint[], scaleX: number, scaleY: number): number {
	let distance = 0;
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		if (start && end) distance += mapPointDistance(start, end, scaleX, scaleY);
	}
	return distance;
}

/**
 * Tests whether an element has popup content beyond its name.
 *
 * @param element - The map element to test.
 * @returns True when the description, author name, or URL has text.
 */
export function mapElementHasMetadata(element: MapElement): boolean {
	const metadata = element.metadata;
	return Boolean(
		metadata?.description?.trim() ||
			metadata?.author?.name.trim() ||
			metadata?.url?.trim() ||
			element.locationMetadata?.url?.trim(),
	);
}

/** Gets the standard title with support for an old map name.
 * @param element - The map element.
 * @returns The old map name when it has text, or the standard title.
 */
export function mapElementLabelName(element: MapElement): string {
	return element.labelName?.trim() || element.metadata?.title?.trim() || "";
}

/**
 * Sorts elements by their highest active layer position.
 *
 * @param elements - The elements to sort.
 * @param layerIds - The layer identifiers from bottom to top.
 * @param activeLayerIds - The layer identifiers that currently affect paint order.
 * @returns A new element array in paint order.
 */
export function sortMapElements(
	elements: MapElement[],
	layerIds: string[],
	activeLayerIds: Iterable<string> = layerIds,
): MapElement[] {
	const active = new Set(activeLayerIds);
	return elements
		.map((element, index) => ({
			element,
			index,
			layerIndex: mapElementLayerPosition(element, layerIds, active),
		}))
		.sort((left, right) => left.layerIndex - right.layerIndex || left.index - right.index)
		.map(({ element }) => element);
}

/** Gets the layer position that controls an element's paint order.
 * @param element - The element to examine.
 * @param layerIds - Layer identifiers from bottom to top.
 * @param active - The active layer identifiers.
 * @returns The highest active position, -1 for no layer, or -2 for a grid.
 */
export function mapElementLayerPosition(
	element: MapElement,
	layerIds: string[],
	active: ReadonlySet<string>,
): number {
	return element.type === "grid"
		? -2
		: layerIds.findLastIndex((id) => active.has(id) && element.layerIds.includes(id));
}

/** Moves one element within its current paint layer.
 * @param elements - The saved elements in paint order.
 * @param id - The element identifier.
 * @param move - The relative step or layer edge.
 * @param layerIds - Layer identifiers from bottom to top.
 * @param activeLayerIds - The active layer identifiers.
 * @returns A reordered copy that preserves other layers and element data.
 */
export function mapElementsReorder(
	elements: MapElement[],
	id: string,
	move: "forward" | "backward" | "front" | "back",
	layerIds: string[],
	activeLayerIds: Iterable<string>,
): MapElement[] {
	const selected = elements.find((element) => element.id === id);
	if (!selected) return elements;
	const active = new Set(activeLayerIds);
	const layer = mapElementLayerPosition(selected, layerIds, active);
	const indices = elements.flatMap((element, index) =>
		mapElementLayerPosition(element, layerIds, active) === layer ? [index] : [],
	);
	const members = indices.map((index) => elements[index]);
	const source = members.findIndex((element) => element.id === id);
	const target =
		move === "front"
			? members.length - 1
			: move === "back"
				? 0
				: clampMapNumber(source + (move === "forward" ? 1 : -1), 0, members.length - 1);
	if (source === target) return elements;
	members.splice(source, 1);
	members.splice(target, 0, selected);
	const result = [...elements];
	indices.forEach((index, position) => {
		result[index] = members[position];
	});
	return result;
}

/**
 * Formats a map distance for the viewer.
 *
 * @param value - The distance in configured map units.
 * @returns A short localized number.
 */
export function formatMapDistance(value: number): string {
	return new Intl.NumberFormat("ru-RU", {
		maximumFractionDigits: value < 10 ? 2 : value < 100 ? 1 : 0,
	}).format(value);
}

/**
 * Selects a useful horizontal scale-bar size.
 *
 * @param zoom - The current map zoom.
 * @param scaleX - The horizontal distance for one map pixel.
 * @param minimumPixels - The smallest screen width for the scale bar.
 * @param maximumPixels - The largest screen width for the scale bar.
 * @returns The screen width and map distance for the scale bar.
 */
export function mapScaleBar(
	zoom: number,
	scaleX: number,
	minimumPixels = 70,
	maximumPixels = 150,
): { pixels: number; distance: number } {
	const safeZoom = Math.max(zoom, 0.0001);
	const safeScale = Math.max(scaleX, 0.0001);
	const targetDistance = (110 / safeZoom) * safeScale;
	const power = 10 ** Math.floor(Math.log10(targetDistance));
	const normalized = targetDistance / power;
	const step = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
	let distance = step * power;
	let pixels = (distance / safeScale) * safeZoom;
	if (pixels < minimumPixels) {
		distance *= 2;
		pixels = (distance / safeScale) * safeZoom;
	}
	if (pixels > maximumPixels) {
		distance /= 2;
		pixels = (distance / safeScale) * safeZoom;
	}
	return { pixels, distance };
}
