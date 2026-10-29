import earcut from "earcut";
import type { MapBounds, MapElementTactical, MapPoint } from "$lib/map/types";
import type { MapWebglElementMeshes, MapWebglMesh } from "$lib/map/webgl-geometry";

const PICK_WIDTH_MINIMUM = 16;

/**
 * Gets a finite number from a tactical parameter.
 *
 * @param element - The tactical element that owns the parameter.
 * @param key - The parameter name.
 * @param fallback - The result when the stored value is not a finite number.
 * @returns The stored finite number or the fallback.
 */
function mapTacticalNumber(element: MapElementTactical, key: string, fallback: number): number {
	const value = element.parameters[key];
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Calculates the bounds of a vertex array.
 *
 * @param vertices - Flat x and y vertex coordinates.
 * @returns The axis-aligned bounds of all vertices.
 */
function mapTacticalVertexBounds(vertices: number[]): MapBounds {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (let index = 0; index < vertices.length; index += 2) {
		const x = vertices[index] ?? 0;
		const y = vertices[index + 1] ?? 0;
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}
	if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
	return { minX, minY, maxX, maxY };
}

/**
 * Creates a mesh from flat triangle coordinates.
 *
 * @param vertices - Flat x and y triangle coordinates.
 * @returns The typed vertices and their bounds.
 */
function mapTacticalMesh(vertices: number[]): MapWebglMesh {
	return { vertices: new Float32Array(vertices), bounds: mapTacticalVertexBounds(vertices) };
}

/**
 * Adds one quad as two triangles.
 *
 * @param output - The target flat coordinate array.
 * @param leftStart - The left point at the segment start.
 * @param rightStart - The right point at the segment start.
 * @param leftEnd - The left point at the segment end.
 * @param rightEnd - The right point at the segment end.
 * @returns Nothing.
 * @sideEffects Adds twelve numbers to `output`.
 */
function mapTacticalAddQuad(
	output: number[],
	leftStart: MapPoint,
	rightStart: MapPoint,
	leftEnd: MapPoint,
	rightEnd: MapPoint,
): void {
	output.push(
		leftStart.x,
		leftStart.y,
		rightStart.x,
		rightStart.y,
		leftEnd.x,
		leftEnd.y,
		rightStart.x,
		rightStart.y,
		rightEnd.x,
		rightEnd.y,
		leftEnd.x,
		leftEnd.y,
	);
}

/**
 * Creates a ribbon for an ordered centerline.
 *
 * The joins use averaged normals with a limited miter. Sharp joins use the segment normal.
 *
 * @param points - The ordered centerline points.
 * @param widthStart - The ribbon width at the first point.
 * @param widthEnd - The ribbon width at the last point.
 * @returns A triangle mesh for the ribbon.
 */
export function mapTacticalRibbonMesh(
	points: MapPoint[],
	widthStart: number,
	widthEnd = widthStart,
): MapWebglMesh {
	if (points.length < 2) return mapTacticalMesh([]);
	const pairs: Array<{ left: MapPoint; right: MapPoint }> = [];
	const lengths = points.map((point, index) =>
		index === 0
			? 0
			: Math.hypot(point.x - points[index - 1]!.x, point.y - points[index - 1]!.y),
	);
	const distanceTotal = lengths.reduce((sum, length) => sum + length, 0) || 1;
	let distance = 0;
	for (let index = 0; index < points.length; index += 1) {
		const point = points[index] ?? { x: 0, y: 0 };
		const before = points[Math.max(0, index - 1)] ?? point;
		const after = points[Math.min(points.length - 1, index + 1)] ?? point;
		const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
		const normalX = -(after.y - before.y) / length;
		const normalY = (after.x - before.x) / length;
		distance += lengths[index] ?? 0;
		const progress = distance / distanceTotal;
		const halfWidth = (widthStart + (widthEnd - widthStart) * progress) / 2;
		pairs.push({
			left: { x: point.x + normalX * halfWidth, y: point.y + normalY * halfWidth },
			right: { x: point.x - normalX * halfWidth, y: point.y - normalY * halfWidth },
		});
	}
	const vertices: number[] = [];
	for (let index = 1; index < pairs.length; index += 1) {
		const start = pairs[index - 1];
		const end = pairs[index];
		if (start && end)
			mapTacticalAddQuad(vertices, start.left, start.right, end.left, end.right);
	}
	return mapTacticalMesh(vertices);
}

/**
 * Creates dashed ribbons along an ordered centerline.
 *
 * Each dash ends at a real interpolated point. This keeps the stored centerline compact and
 * makes the visible gaps independent from its control-point spacing.
 *
 * @param points - The ordered centerline points.
 * @param width - The visible ribbon width.
 * @param spacing - The distance from the start of one dash to the next.
 * @param widthEnd - The ribbon width at the last point.
 * @returns A triangle mesh that contains the visible dash segments.
 */
export function mapTacticalDashedRibbonMesh(
	points: MapPoint[],
	width: number,
	spacing: number,
	widthEnd = width,
): MapWebglMesh {
	if (points.length < 2) return mapTacticalMesh([]);
	const spacingSafe = Math.max(spacing, width * 1.5, 1);
	const dashLength = spacingSafe * 0.58;
	const meshes: MapWebglMesh[] = [];
	const distanceTotal =
		points.reduce(
			(sum, point, index) =>
				sum +
				(index === 0
					? 0
					: Math.hypot(point.x - points[index - 1]!.x, point.y - points[index - 1]!.y)),
			0,
		) || 1;
	let distancePath = 0;
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		if (!start || !end) continue;
		const length = Math.hypot(end.x - start.x, end.y - start.y);
		if (length === 0) continue;
		const distanceEndPath = distancePath + length;
		let distanceDash = Math.floor(distancePath / spacingSafe) * spacingSafe;
		while (distanceDash < distanceEndPath) {
			const distanceVisibleStart = Math.max(distancePath, distanceDash);
			const distanceVisibleEnd = Math.min(distanceEndPath, distanceDash + dashLength);
			if (distanceVisibleEnd > distanceVisibleStart) {
				const progressStart = (distanceVisibleStart - distancePath) / length;
				const progressEnd = (distanceVisibleEnd - distancePath) / length;
				meshes.push(
					mapTacticalRibbonMesh(
						[
							{
								x: start.x + (end.x - start.x) * progressStart,
								y: start.y + (end.y - start.y) * progressStart,
							},
							{
								x: start.x + (end.x - start.x) * progressEnd,
								y: start.y + (end.y - start.y) * progressEnd,
							},
						],
						width + ((widthEnd - width) * distanceVisibleStart) / distanceTotal,
						width + ((widthEnd - width) * distanceVisibleEnd) / distanceTotal,
					),
				);
			}
			distanceDash += spacingSafe;
		}
		distancePath += length;
	}
	return mapTacticalJoinMeshes(meshes);
}

/**
 * Removes a distance from the end of a polyline.
 *
 * @param points - The ordered path points.
 * @param distance - The distance to remove from the path end.
 * @returns A path that ends at the requested distance before the source end.
 */
function mapTacticalPathTrimEnd(points: MapPoint[], distance: number): MapPoint[] {
	if (points.length < 2 || distance <= 0) return points.map((point) => ({ ...point }));
	const result = points.map((point) => ({ ...point }));
	let remaining = distance;
	while (result.length > 1) {
		const end = result.at(-1);
		const before = result.at(-2);
		if (!end || !before) break;
		const length = Math.hypot(end.x - before.x, end.y - before.y);
		if (length > remaining) {
			const ratio = (length - remaining) / length;
			result[result.length - 1] = {
				x: before.x + (end.x - before.x) * ratio,
				y: before.y + (end.y - before.y) * ratio,
			};
			return result;
		}
		remaining -= length;
		result.pop();
	}
	return result;
}

/**
 * Gets the unit direction and left normal at the end of a path.
 *
 * @param points - The ordered path points.
 * @returns The terminal direction and normal.
 */
function mapTacticalPathEndFrame(points: MapPoint[]): {
	direction: MapPoint;
	normal: MapPoint;
} {
	const end = points.at(-1) ?? { x: 0, y: 0 };
	const before = points.at(-2) ?? { x: end.x - 1, y: end.y };
	const length = Math.hypot(end.x - before.x, end.y - before.y) || 1;
	const direction = { x: (end.x - before.x) / length, y: (end.y - before.y) / length };
	return { direction, normal: { x: -direction.y, y: direction.x } };
}

/** Shapes a branch along the parent path and moves its end to the branch tip.
 * @param points - The rendered parent path from the branch start to its end.
 * @param tip - The branch tip in map coordinates.
 * @param smoothing - The path smoothing percentage, from 0 through 100.
 * @returns The branch centerline with the same start as the parent path.
 */
export function mapTacticalBranchPath(
	points: MapPoint[],
	tip: MapPoint,
	smoothing: number,
): MapPoint[] {
	const start = points[0];
	const end = points.at(-1);
	if (!start || !end) return [];
	if (smoothing <= 0) return [start, tip];
	const lengths = points
		.slice(1)
		.map((point, index) => Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y));
	const total = lengths.reduce((sum, length) => sum + length, 0);
	if (!total) return [start, tip];
	const strength = Math.min(1, smoothing / 100);
	const result: MapPoint[] = [start];
	let distance = 0;
	for (let index = 1; index < points.length; index += 1) {
		const before = points[index - 1]!;
		const after = points[index]!;
		const length = lengths[index - 1]!;
		if (!length) continue;
		const count = Math.max(1, Math.ceil((length / total) * 32));
		for (let step = 1; step <= count; step += 1) {
			const fraction = step / count;
			const progress = (distance + length * fraction) / total;
			const offset = progress * progress * (3 - 2 * progress);
			const x = before.x + (after.x - before.x) * fraction + (tip.x - end.x) * offset;
			const y = before.y + (after.y - before.y) * fraction + (tip.y - end.y) * offset;
			result.push({
				x: (start.x + (tip.x - start.x) * progress) * (1 - strength) + x * strength,
				y: (start.y + (tip.y - start.y) * progress) * (1 - strength) + y * strength,
			});
		}
		distance += length;
	}
	return result;
}

/**
 * Creates triangular direction marks on the left side of a path.
 *
 * @param points - The ordered path points.
 * @param width - The line width.
 * @param spacing - The distance between marks.
 * @param sizeExtra - Extra mark size for an outline.
 * @param side - The side of the path that receives the marks.
 * @returns A mesh for the direction marks.
 */
function mapTacticalDirectionMarksMesh(
	points: MapPoint[],
	width: number,
	spacing: number,
	sizeExtra = 0,
	side = 1,
): MapWebglMesh {
	const vertices: number[] = [];
	const spacingSafe = Math.max(spacing, width * 2, 8);
	let distanceNext = spacingSafe * 0.5;
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		if (!start || !end) continue;
		const deltaX = end.x - start.x;
		const deltaY = end.y - start.y;
		const length = Math.hypot(deltaX, deltaY);
		if (length === 0) continue;
		const directionX = deltaX / length;
		const directionY = deltaY / length;
		const normalX = -directionY * side;
		const normalY = directionX * side;
		while (distanceNext <= length) {
			const center = {
				x: start.x + directionX * distanceNext,
				y: start.y + directionY * distanceNext,
			};
			const halfBase = Math.max(width * 0.65 + sizeExtra, 3);
			const height = Math.max(width * 1.65 + sizeExtra, 6);
			const edgeOffset = width / 2;
			vertices.push(
				center.x - directionX * halfBase + normalX * edgeOffset,
				center.y - directionY * halfBase + normalY * edgeOffset,
				center.x + directionX * halfBase + normalX * edgeOffset,
				center.y + directionY * halfBase + normalY * edgeOffset,
				center.x + normalX * (edgeOffset + height),
				center.y + normalY * (edgeOffset + height),
			);
			distanceNext += spacingSafe;
		}
		distanceNext -= length;
	}
	return mapTacticalMesh(vertices);
}

/**
 * Creates a triangular arrowhead at the end of a centerline.
 *
 * @param points - The ordered centerline points.
 * @param size - The arrowhead length and half-width.
 * @param shaft - The optional shaft that supplies the shared base and its normal.
 * @returns A triangle mesh for the arrowhead.
 */
export function mapTacticalArrowheadMesh(
	points: MapPoint[],
	size: number,
	shaft?: MapPoint[],
): MapWebglMesh {
	const end = points.at(-1);
	const before = points.at(-2);
	if (!end || !before) return mapTacticalMesh([]);
	const length = Math.hypot(end.x - before.x, end.y - before.y) || 1;
	const directionX = (end.x - before.x) / length;
	const directionY = (end.y - before.y) / length;
	const base = shaft?.at(-1) ?? { x: end.x - directionX * size, y: end.y - directionY * size };
	const normal =
		shaft && shaft.length > 1
			? mapTacticalPathEndFrame(shaft).normal
			: { x: -directionY, y: directionX };
	const normalX = normal.x * size * 0.62;
	const normalY = normal.y * size * 0.62;
	return mapTacticalMesh([
		end.x,
		end.y,
		base.x + normalX,
		base.y + normalY,
		base.x - normalX,
		base.y - normalY,
	]);
}

/** Places branch tips at equal angles on a forward arc.
 *
 * @param end - The center tip on the arc.
 * @param direction - The unit direction at the parent path end.
 * @param length - The distance from the arc center to its center tip.
 * @param spread - The arc length between the outer tips.
 * @param count - The number of tips, at least two.
 * @returns The tips in order across an arc of at most 180 degrees.
 */
export function mapTacticalBranchTips(
	end: MapPoint,
	direction: MapPoint,
	length: number,
	spread: number,
	count: number,
): MapPoint[] {
	const radius = Math.max(length, spread / Math.PI, 1);
	return Array.from({ length: count }, (_, index) => {
		const angle = ((index / (count - 1) - 0.5) * spread) / radius;
		const forward = radius * (Math.cos(angle) - 1);
		const lateral = radius * Math.sin(angle);
		return {
			x: end.x + direction.x * forward - direction.y * lateral,
			y: end.y + direction.y * forward + direction.x * lateral,
		};
	});
}

/**
 * Joins meshes into one mesh.
 *
 * @param meshes - The meshes to join in draw order.
 * @returns One mesh that contains all input triangles.
 */
function mapTacticalJoinMeshes(meshes: MapWebglMesh[]): MapWebglMesh {
	return mapTacticalMesh(meshes.flatMap((mesh) => [...mesh.vertices]));
}

/**
 * Creates a filled polygon mesh for a tactical area.
 *
 * @param points - The closed polygon control points.
 * @returns A triangulated fill mesh.
 */
function mapTacticalAreaMesh(points: MapPoint[]): MapWebglMesh {
	const coordinates = points.flatMap((point) => [point.x, point.y]);
	const indexes = earcut(coordinates);
	return mapTacticalMesh(indexes.flatMap((index) => coordinates.slice(index * 2, index * 2 + 2)));
}

/**
 * Tests whether a point is inside a tactical polygon.
 *
 * @param point - The point to test.
 * @param polygon - The polygon vertices in order.
 * @returns `true` when the polygon contains the point.
 */
function mapTacticalPointInPolygon(point: MapPoint, polygon: MapPoint[]): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const start = polygon[index];
		const end = polygon[previous];
		if (!start || !end) continue;
		const crosses =
			start.y > point.y !== end.y > point.y &&
			point.x <
				((end.x - start.x) * (point.y - start.y)) / (end.y - start.y || Number.EPSILON) +
					start.x;
		if (crosses) inside = !inside;
	}
	return inside;
}

/**
 * Creates directional hatching inside a kill-zone polygon.
 *
 * @param points - The visible polygon outline.
 * @param density - The normalized hatch density.
 * @param direction - The hatch direction in degrees.
 * @param width - The hatch width.
 * @returns A mesh of clipped directional hatch marks.
 */
function mapTacticalKillPatternMesh(
	points: MapPoint[],
	density: number,
	direction: number,
	width: number,
): MapWebglMesh {
	if (points.length < 3 || density <= 0) return mapTacticalMesh([]);
	const bounds = mapTacticalVertexBounds(points.flatMap((point) => [point.x, point.y]));
	const densitySafe = Math.min(1, Math.max(0, density));
	const densityScaled = densitySafe <= 0 ? 0 : Math.max(0, (Math.log10(densitySafe) + 4) / 4);
	const spacing = density > 1 ? 28 / Math.min(density, 2) : 360 - densityScaled * 332;
	const lengthHalf = spacing * 0.34;
	const radians = (direction * Math.PI) / 180;
	const vector = { x: Math.cos(radians) * lengthHalf, y: Math.sin(radians) * lengthHalf };
	const meshes: MapWebglMesh[] = [];
	for (let y = bounds.minY + spacing / 2; y < bounds.maxY; y += spacing) {
		for (let x = bounds.minX + spacing / 2; x < bounds.maxX; x += spacing) {
			const start = { x: x - vector.x, y: y - vector.y };
			const end = { x: x + vector.x, y: y + vector.y };
			if (
				!mapTacticalPointInPolygon(start, points) ||
				!mapTacticalPointInPolygon(end, points)
			) {
				continue;
			}
			meshes.push(mapTacticalRibbonMesh([start, end], width));
		}
	}
	return mapTacticalJoinMeshes(meshes);
}

/**
 * Creates an axis-aligned rectangle around a center point.
 *
 * @param center - The rectangle center.
 * @param widthHalf - Half of the rectangle width.
 * @param heightHalf - Half of the rectangle height.
 * @returns A two-triangle rectangle mesh.
 */
function mapTacticalRectangleMesh(
	center: MapPoint,
	widthHalf: number,
	heightHalf: number,
): MapWebglMesh {
	return mapTacticalMesh([
		center.x - widthHalf,
		center.y - heightHalf,
		center.x + widthHalf,
		center.y - heightHalf,
		center.x - widthHalf,
		center.y + heightHalf,
		center.x + widthHalf,
		center.y - heightHalf,
		center.x + widthHalf,
		center.y + heightHalf,
		center.x - widthHalf,
		center.y + heightHalf,
	]);
}

/**
 * Rotates a mesh around one map point.
 *
 * @param mesh - The source triangle mesh.
 * @param center - The rotation center.
 * @param degrees - The clockwise rotation in degrees.
 * @returns A rotated mesh.
 */
function mapTacticalRotateMesh(
	mesh: MapWebglMesh,
	center: MapPoint,
	degrees: number,
): MapWebglMesh {
	if (degrees === 0) return mesh;
	const radians = (degrees * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	const vertices = [...mesh.vertices];
	for (let index = 0; index < vertices.length; index += 2) {
		const x = (vertices[index] ?? center.x) - center.x;
		const y = (vertices[index + 1] ?? center.y) - center.y;
		vertices[index] = center.x + x * cosine - y * sine;
		vertices[index + 1] = center.y + x * sine + y * cosine;
	}
	return mapTacticalMesh(vertices);
}

/**
 * Creates the visible and pick meshes for one tactical element.
 *
 * @param element - The compact tactical element.
 * @param pointsRendered - The smoothed path points from shared geometry.
 * @param polygonMeshes - The shared polygon fill and connected outline.
 * @returns Stable geometry that both map renderers can use.
 */
export function mapTacticalElementMeshes(
	element: MapElementTactical,
	pointsRendered = element.points,
	polygonMeshes?: Pick<MapWebglElementMeshes, "fill" | "stroke">,
): MapWebglElementMeshes {
	const width = mapTacticalNumber(element, "width", element.style.borderWidth || 16);
	const headSize = mapTacticalNumber(element, "headSize", Math.max(width * 2.5, 24));
	const borderWidth = Math.max(0, element.style.borderWidth);
	const key = `${element.kind}|${element.points.map((point) => `${point.x},${point.y}`).join(";")}|${element.smoothing}|${JSON.stringify(element.parameters)}|${borderWidth}`;
	if (element.kind === "unit") {
		const center = element.points[0] ?? { x: 0, y: 0 };
		const size = mapTacticalNumber(element, "size", 56);
		const rotation = mapTacticalNumber(element, "rotation", 0);
		const halfWidth = size / 2;
		const halfHeight = mapTacticalNumber(element, "height", size * 0.68) / 2;
		const core = mapTacticalRectangleMesh(center, halfWidth, halfHeight);
		const stroke = mapTacticalRotateMesh(
			mapTacticalRectangleMesh(center, halfWidth + borderWidth, halfHeight + borderWidth),
			center,
			rotation,
		);
		const fill = mapTacticalRotateMesh(core, center, rotation);
		return { key, fill, stroke, pick: stroke };
	}
	if (element.kind === "kill-zone") {
		const pointFirst = pointsRendered[0];
		const pointLast = pointsRendered.at(-1);
		const outline =
			pointsRendered.length > 1 &&
			pointFirst?.x === pointLast?.x &&
			pointFirst?.y === pointLast?.y
				? pointsRendered.slice(0, -1)
				: pointsRendered;
		const fill = polygonMeshes?.fill ?? mapTacticalAreaMesh(outline);
		const border = polygonMeshes?.stroke;
		const stroke = mapTacticalJoinMeshes([
			...(border ? [border] : []),
			mapTacticalKillPatternMesh(
				outline,
				mapTacticalNumber(element, "density", 0.5),
				mapTacticalNumber(element, "direction", 45),
				Math.max(2, borderWidth * 0.55),
			),
		]);
		return { key, fill, stroke, pick: fill };
	}
	if (element.kind === "boundary") {
		const spacing = mapTacticalNumber(element, "markSpacing", 48);
		const side = element.parameters.reverse === true ? -1 : 1;
		const fill = mapTacticalJoinMeshes([
			mapTacticalRibbonMesh(pointsRendered, width),
			mapTacticalDirectionMarksMesh(pointsRendered, width, spacing, 0, side),
		]);
		const stroke = mapTacticalJoinMeshes([
			mapTacticalRibbonMesh(pointsRendered, width + borderWidth * 2),
			mapTacticalDirectionMarksMesh(pointsRendered, width, spacing, borderWidth, side),
		]);
		const pick = mapTacticalRibbonMesh(
			pointsRendered,
			Math.max(width + borderWidth * 2, PICK_WIDTH_MINIMUM),
		);
		return { key, fill, stroke, pick };
	}
	const tapered = element.parameters.tapered === true;
	const widthStart = mapTacticalNumber(element, "widthStart", tapered ? width * 0.58 : width);
	const widthEnd = mapTacticalNumber(element, "widthEnd", width);
	const headExtent = Math.max(headSize, widthEnd / 1.24);
	const dashed = element.parameters.dashed === true;
	const split = element.parameters.split === true;
	const end = pointsRendered.at(-1);
	const frame = mapTacticalPathEndFrame(pointsRendered);
	const splitLength = mapTacticalNumber(element, "splitLength", headSize * 1.45);
	const branchStartPath = split ? mapTacticalPathTrimEnd(pointsRendered, splitLength) : [];
	const branchStart = branchStartPath.at(-1);
	const branchTail = branchStart
		? [branchStart, ...pointsRendered.slice(Math.max(0, branchStartPath.length - 1))]
		: pointsRendered;
	const tips =
		split && end
			? mapTacticalBranchTips(
					end,
					frame.direction,
					splitLength,
					mapTacticalNumber(element, "splitSpread", headSize * 1.16),
					Math.round(mapTacticalNumber(element, "splitCount", 2)),
				)
			: end
				? [end]
				: [];
	const silhouette = (widthCurrent: number, headCurrent: number) => {
		const meshes: MapWebglMesh[] = [];
		if (branchStartPath.length > 1) {
			meshes.push(
				dashed
					? mapTacticalDashedRibbonMesh(
							branchStartPath,
							widthStart + widthCurrent - widthEnd,
							Math.max(widthCurrent * 2.8, 32),
							widthCurrent,
						)
					: mapTacticalRibbonMesh(
							branchStartPath,
							widthStart + widthCurrent - widthEnd,
							widthCurrent,
						),
			);
		}
		for (const tip of tips) {
			const branch = split
				? mapTacticalBranchPath(branchTail, tip, element.smoothing)
				: branchTail;
			const shaft = mapTacticalPathTrimEnd(branch, headExtent);
			if (shaft.length > 1) {
				meshes.push(
					dashed
						? mapTacticalDashedRibbonMesh(
								shaft,
								split ? widthCurrent : widthStart + widthCurrent - widthEnd,
								Math.max(widthCurrent * 2.8, 32),
								widthCurrent,
							)
						: mapTacticalRibbonMesh(
								shaft,
								split ? widthCurrent : widthStart + widthCurrent - widthEnd,
								widthCurrent,
							),
				);
			}
			meshes.push(mapTacticalArrowheadMesh(branch, headCurrent, shaft));
		}
		return mapTacticalJoinMeshes(meshes);
	};
	const fill = silhouette(widthEnd, headExtent);
	const stroke = silhouette(widthEnd + borderWidth * 2, headExtent + borderWidth * 1.4);
	const pick = mapTacticalJoinMeshes([
		stroke,
		mapTacticalRibbonMesh(pointsRendered, Math.max(width, PICK_WIDTH_MINIMUM)),
		...tips.map((tip) =>
			mapTacticalArrowheadMesh(branchStart ? [branchStart, tip] : [], headSize),
		),
	]);
	return { key, fill, stroke, pick };
}
