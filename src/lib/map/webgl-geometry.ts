import earcut from "earcut";
import { mapElementTacticalRecipe } from "$lib/map/element-subtypes";
import { clampMapNumber } from "$lib/map/geometry";
import type { MapBounds } from "$lib/map/geometry";
import type { MapNameArcLine } from "$lib/map/name-arc";
import type { MapElement, MapElementGrid, MapPoint } from "$lib/map/types";
import { mapTacticalDashedRibbonMesh, mapTacticalElementMeshes } from "$lib/map/tactical-geometry";

export type MapWebglPathSegment = {
	startIndex: number;
	points: MapPoint[];
};

export type MapWebglMesh = {
	vertices: Float32Array;
	bounds: MapBounds;
};

export type MapWebglElementMeshes = {
	key: string;
	fill?: MapWebglMesh;
	stroke?: MapWebglMesh;
	pick: MapWebglMesh;
};

export type MapWebglPathCommand =
	| [0, number, number]
	| [1, number, number]
	| [2, number, number, number, number]
	| [3, number, number, number, number, number, number]
	| [4];

const CURVE_FLATNESS = 0.5;
const CURVE_DEPTH_MAXIMUM = 10;

/**
 * Creates a cache key for one element mesh.
 *
 * @param element - The configured map element.
 * @returns A string that changes when the element mesh changes.
 */
export function mapWebglElementGeometryKey(element: MapElement): string {
	const recipe = mapElementTacticalRecipe(element);
	if (recipe && element.type !== "tactical")
		return `${mapWebglElementGeometryKey(recipe)}|${element.type === "region" ? (element.waterEdges?.join(",") ?? "") : ""}`;
	if (element.type === "grid") {
		return `${element.center.x},${element.center.y}|${element.width},${element.height}|${element.rotation}|${element.columnCount},${element.rowCount},${element.subdivisionCount}|${element.style.borderWidth}`;
	}
	if (element.type === "tactical") {
		return `${element.kind}|${element.points.map((point) => `${point.x},${point.y}`).join(";")}|${element.smoothing}|${JSON.stringify(element.parameters)}|${Math.max(0, element.style.borderWidth)}`;
	}
	if (element.type === "symbol") {
		return `${element.center.x},${element.center.y}|${element.width},${element.height}|${element.rotation}|${element.shape ?? "rectangle"}|${element.style?.borderWidth ?? 0}`;
	}
	if (element.type === "area") {
		return `${element.center.x},${element.center.y}|${element.radius}|${element.style.borderWidth}`;
	}
	const points = element.points.map((point) => `${point.x},${point.y}`).join(";");
	const pickWidth = element.type === "path" ? Math.max(element.style.borderWidth, 16) : 0;
	const waterEdges = element.type === "region" ? (element.waterEdges ?? []).join(",") : "";
	return `${points}|${element.smoothing}|${element.style.borderWidth}|${pickWidth}|${waterEdges}`;
}

/**
 * Creates the reusable fill, stroke, and pick meshes for one map element.
 *
 * @param element - The map element to tessellate.
 * @returns The element meshes and their cache key.
 */
export function mapWebglElementMeshes(element: MapElement): MapWebglElementMeshes {
	const recipe = mapElementTacticalRecipe(element);
	if (recipe && element.type !== "tactical") {
		if (element.type === "region") {
			const segments = mapWebglPathSegments(element.points, true, element.smoothing);
			const points = segments.flatMap((segment, index) =>
				index === 0 ? segment.points : segment.points.slice(1),
			);
			return {
				...mapTacticalElementMeshes(recipe, points, {
					fill: mapWebglFillMesh(element.points, element.smoothing),
					stroke: mapWebglStrokeMesh(
						segments,
						element.style.borderWidth,
						element.waterEdges,
					),
				}),
				key: mapWebglElementGeometryKey(element),
			};
		}
		return { ...mapWebglElementMeshes(recipe), key: mapWebglElementGeometryKey(element) };
	}
	if (element.type === "grid") return mapWebglGridElementMeshes(element);
	if (element.type === "tactical") {
		const segments = mapWebglPathSegments(
			element.points,
			element.kind === "kill-zone",
			element.smoothing,
		);
		const points = segments.flatMap((segment, index) =>
			index === 0 ? segment.points : segment.points.slice(1),
		);
		return mapTacticalElementMeshes(
			element,
			points,
			element.kind === "kill-zone"
				? {
						fill: mapWebglFillMesh(element.points, element.smoothing),
						stroke: mapWebglStrokeMesh(segments, element.style.borderWidth),
					}
				: undefined,
		);
	}
	const key = mapWebglElementGeometryKey(element);
	if (element.type === "symbol") {
		const pick =
			element.shape === "circle"
				? mapWebglCircleMesh(element.center, Math.min(element.width, element.height) / 2)
				: mapWebglRectangleMesh(
						element.center,
						element.width,
						element.height,
						element.rotation,
					);
		const stroke =
			element.shape === "circle" && element.style?.borderWidth
				? mapWebglStrokeMesh(
						mapWebglPathSegments(
							Array.from({ length: 64 }, (_, index) => ({
								x:
									element.center.x +
									Math.cos((index / 64) * Math.PI * 2) * (element.width / 2),
								y:
									element.center.y +
									Math.sin((index / 64) * Math.PI * 2) * (element.height / 2),
							})),
							true,
							0,
						),
						element.style.borderWidth,
					)
				: undefined;
		return { key, stroke, pick };
	}
	if (element.type === "area") {
		const fill = mapWebglCircleMesh(element.center, element.radius);
		const points = Array.from({ length: 64 }, (_, index) => ({
			x: element.center.x + Math.cos((index / 64) * Math.PI * 2) * element.radius,
			y: element.center.y + Math.sin((index / 64) * Math.PI * 2) * element.radius,
		}));
		return {
			key,
			fill,
			stroke: mapWebglStrokeMesh(
				mapWebglPathSegments(points, true, 0),
				element.style.borderWidth,
			),
			pick: fill,
		};
	}
	const closed = element.type === "region";
	const segments = mapWebglPathSegments(element.points, closed, element.smoothing);
	const stroke = mapWebglStrokeMesh(
		segments,
		element.style.borderWidth,
		element.type === "region" ? element.waterEdges : [],
	);
	if (element.type === "region") {
		const fill = mapWebglFillMesh(element.points, element.smoothing);
		return { key, fill, stroke, pick: fill };
	}
	return {
		key,
		stroke,
		pick: mapWebglStrokeMesh(segments, Math.max(element.style.borderWidth, 16)),
	};
}

/**
 * Tests whether a point is inside a polygon.
 *
 * @param point - The point to test.
 * @param polygon - The polygon points in edge order.
 * @returns `true` when the polygon contains the point.
 */
function mapWebglPointInPolygon(point: MapPoint, polygon: MapPoint[]): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const start = polygon[index];
		const end = polygon[previous];
		if (!start || !end) continue;
		if (
			start.y > point.y !== end.y > point.y &&
			point.x <
				((end.x - start.x) * (point.y - start.y)) / (end.y - start.y || Number.EPSILON) +
					start.x
		)
			inside = !inside;
	}
	return inside;
}

/**
 * Clips one line segment to a polygon.
 *
 * @param start - The line start.
 * @param end - The line end.
 * @param polygon - The optional clipping polygon.
 * @returns The line sections whose middle points are inside the polygon.
 */
function mapWebglSegmentClipPolygon(
	start: MapPoint,
	end: MapPoint,
	polygon: MapPoint[],
): MapPoint[][] {
	if (polygon.length < 3) return [[start, end]];
	const direction = { x: end.x - start.x, y: end.y - start.y };
	const positions = [0, 1];
	for (let index = 0; index < polygon.length; index += 1) {
		const edgeStart = polygon[index];
		const edgeEnd = polygon[(index + 1) % polygon.length];
		if (!edgeStart || !edgeEnd) continue;
		const edge = { x: edgeEnd.x - edgeStart.x, y: edgeEnd.y - edgeStart.y };
		const denominator = direction.x * edge.y - direction.y * edge.x;
		if (Math.abs(denominator) < Number.EPSILON) continue;
		const offset = { x: edgeStart.x - start.x, y: edgeStart.y - start.y };
		const linePosition = (offset.x * edge.y - offset.y * edge.x) / denominator;
		const edgePosition = (offset.x * direction.y - offset.y * direction.x) / denominator;
		if (linePosition > 0 && linePosition < 1 && edgePosition >= 0 && edgePosition <= 1) {
			positions.push(linePosition);
		}
	}
	positions.sort((left, right) => left - right);
	return positions.slice(0, -1).flatMap((position, index) => {
		const positionNext = positions[index + 1];
		if (positionNext === undefined) return [];
		const middle = (position + positionNext) / 2;
		if (
			!mapWebglPointInPolygon(
				{ x: start.x + direction.x * middle, y: start.y + direction.y * middle },
				polygon,
			)
		)
			return [];
		return [
			[
				{ x: start.x + direction.x * position, y: start.y + direction.y * position },
				{
					x: start.x + direction.x * positionNext,
					y: start.y + direction.y * positionNext,
				},
			],
		];
	});
}

/**
 * Creates the visible grid lines and transform bounds for one grid object.
 *
 * @param element - The grid object.
 * @param maskPolygon - An optional parent-region outline that clips the lines.
 * @returns The grid stroke and its rectangular pick mesh.
 */
export function mapWebglGridElementMeshes(
	element: MapElementGrid,
	maskPolygon: MapPoint[] = [],
): MapWebglElementMeshes {
	const radians = (element.rotation * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	const rotate = (x: number, y: number): MapPoint => ({
		x: element.center.x + x * cosine - y * sine,
		y: element.center.y + x * sine + y * cosine,
	});
	const segments: MapWebglPathSegment[] = [];
	const columnCount = element.columnCount * element.subdivisionCount;
	const rowCount = element.rowCount * element.subdivisionCount;
	for (let index = 0; index <= columnCount; index += 1) {
		const x = -element.width / 2 + (index / columnCount) * element.width;
		for (const points of mapWebglSegmentClipPolygon(
			rotate(x, -element.height / 2),
			rotate(x, element.height / 2),
			maskPolygon,
		)) {
			segments.push({ startIndex: segments.length, points });
		}
	}
	for (let index = 0; index <= rowCount; index += 1) {
		const y = -element.height / 2 + (index / rowCount) * element.height;
		for (const points of mapWebglSegmentClipPolygon(
			rotate(-element.width / 2, y),
			rotate(element.width / 2, y),
			maskPolygon,
		)) {
			segments.push({ startIndex: segments.length, points });
		}
	}
	const keyBase = mapWebglElementGeometryKey(element);
	const key =
		maskPolygon.length > 0
			? `${keyBase}|mask:${maskPolygon.map((point) => `${point.x},${point.y}`).join(";")}`
			: keyBase;
	const strokeMeshes = segments.map((segment) =>
		mapWebglStrokeMesh([segment], element.style.borderWidth),
	);
	const stroke = mapWebglMeshesJoin(strokeMeshes);
	return {
		key,
		stroke,
		pick:
			maskPolygon.length > 0
				? mapWebglMeshesJoin(
						segments.map((segment) =>
							mapWebglStrokeMesh([segment], Math.max(24, element.style.borderWidth)),
						),
					)
				: mapWebglRectangleMesh(
						element.center,
						element.width,
						element.height,
						element.rotation,
					),
	};
}

/**
 * Joins triangle meshes without converting their typed arrays to number arrays.
 *
 * @param meshes - The meshes to join.
 * @returns One mesh that contains all input vertices and bounds.
 */
function mapWebglMeshesJoin(meshes: MapWebglMesh[]): MapWebglMesh {
	const vertices = new Float32Array(
		meshes.reduce((length, mesh) => length + mesh.vertices.length, 0),
	);
	let offset = 0;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const mesh of meshes) {
		vertices.set(mesh.vertices, offset);
		offset += mesh.vertices.length;
		minX = Math.min(minX, mesh.bounds.minX);
		minY = Math.min(minY, mesh.bounds.minY);
		maxX = Math.max(maxX, mesh.bounds.maxX);
		maxY = Math.max(maxY, mesh.bounds.maxY);
	}
	return {
		vertices,
		bounds:
			meshes.length > 0 ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 0, maxY: 0 },
	};
}

/**
 * Creates sampled path segments from map control points.
 *
 * @param points - The map control points.
 * @param closed - Whether the last point connects to the first point.
 * @param smoothing - The curve strength from 0 through 100.
 * @returns One sampled segment for each control-point edge.
 */
export function mapWebglPathSegments(
	points: MapPoint[],
	closed: boolean,
	smoothing: number,
): MapWebglPathSegment[] {
	if (points.length < 2) return [];
	const strength = clampMapNumber(smoothing, 0, 100) / 100;
	const count = points.length;
	const segmentCount = closed ? count : count - 1;
	const segments: MapWebglPathSegment[] = [];
	for (let index = 0; index < segmentCount; index += 1) {
		const pointStart = points[index];
		const pointEnd = points[(index + 1) % count];
		if (!pointStart || !pointEnd) continue;
		if (strength === 0) {
			segments.push({ startIndex: index, points: [pointStart, pointEnd] });
			continue;
		}
		const pointBefore = points[(index - 1 + count) % count] ?? pointStart;
		const pointAfter = points[(index + 2) % count] ?? pointEnd;
		const before = closed || index > 0 ? pointBefore : pointStart;
		const after = closed || index < count - 2 ? pointAfter : pointEnd;
		const controlStart = {
			x: pointStart.x + ((pointEnd.x - before.x) * strength) / 6,
			y: pointStart.y + ((pointEnd.y - before.y) * strength) / 6,
		};
		const controlEnd = {
			x: pointEnd.x - ((after.x - pointStart.x) * strength) / 6,
			y: pointEnd.y - ((after.y - pointStart.y) * strength) / 6,
		};
		const sampled = [pointStart];
		mapWebglFlattenCubic(
			pointStart,
			controlStart,
			controlEnd,
			pointEnd,
			CURVE_FLATNESS,
			0,
			sampled,
		);
		segments.push({ startIndex: index, points: sampled });
	}
	return segments;
}

/**
 * Creates a triangle mesh for a closed map path.
 *
 * @param points - The map control points.
 * @param smoothing - The curve strength from 0 through 100.
 * @returns The fill triangles and their bounds.
 */
export function mapWebglFillMesh(points: MapPoint[], smoothing: number): MapWebglMesh {
	const outline = mapWebglPathSegments(points, true, smoothing).flatMap((segment, index) =>
		index === 0 ? segment.points : segment.points.slice(1),
	);
	if (outline.length > 1 && mapWebglPointsEqual(outline[0], outline.at(-1))) outline.pop();
	const coordinates = outline.flatMap((point) => [point.x, point.y]);
	const indexes = earcut(coordinates);
	const triangles: number[] = [];
	for (const index of indexes) {
		const point = outline[index];
		if (point) triangles.push(point.x, point.y);
	}
	return { vertices: new Float32Array(triangles), bounds: mapWebglPointBounds(outline) };
}

/**
 * Samples compact font path commands into closed contours.
 *
 * @param commands - The encoded font path commands.
 * @param tolerance - The permitted curve error in font units.
 * @returns The sampled closed contours.
 */
export function mapWebglPathContours(
	commands: MapWebglPathCommand[],
	tolerance = CURVE_FLATNESS,
): MapPoint[][] {
	const contours: MapPoint[][] = [];
	let contour: MapPoint[] = [];
	let current = { x: 0, y: 0 };
	const finish = () => {
		if (contour.length > 1) {
			if (!mapWebglPointsEqual(contour[0], contour.at(-1))) contour.push({ ...contour[0] });
			contours.push(contour);
		}
		contour = [];
	};
	for (const command of commands) {
		switch (command[0]) {
			case 0:
				finish();
				current = { x: command[1], y: command[2] };
				contour.push(current);
				break;
			case 1:
				current = { x: command[1], y: command[2] };
				contour.push(current);
				break;
			case 2: {
				const end = { x: command[3], y: command[4] };
				mapWebglFlattenQuadratic(
					current,
					{ x: command[1], y: command[2] },
					end,
					tolerance,
					0,
					contour,
				);
				current = end;
				break;
			}
			case 3: {
				const end = { x: command[5], y: command[6] };
				mapWebglFlattenCubic(
					current,
					{ x: command[1], y: command[2] },
					{ x: command[3], y: command[4] },
					end,
					tolerance,
					0,
					contour,
				);
				current = end;
				break;
			}
			case 4:
				finish();
				break;
		}
	}
	finish();
	return contours;
}

/**
 * Creates fill triangles for compound contours with holes and nested islands.
 *
 * @param sourceContours - The closed source contours.
 * @returns The compound fill triangles and their bounds.
 */
export function mapWebglCompoundFillMesh(sourceContours: MapPoint[][]): MapWebglMesh {
	const contours = sourceContours
		.map((source) =>
			source.filter(
				(point, index) => index === 0 || !mapWebglPointsEqual(point, source[index - 1]),
			),
		)
		.map((source) =>
			mapWebglPointsEqual(source[0], source.at(-1)) ? source.slice(0, -1) : source,
		)
		.filter((source) => source.length >= 3);
	const areas = contours.map(mapWebglContourArea);
	const parents = contours.map((contour, index) => {
		const point = contour[0];
		let parent = -1;
		let areaParent = Number.POSITIVE_INFINITY;
		if (!point) return parent;
		for (let candidate = 0; candidate < contours.length; candidate += 1) {
			if (
				candidate === index ||
				Math.abs(areas[candidate] ?? 0) <= Math.abs(areas[index] ?? 0)
			)
				continue;
			const source = contours[candidate];
			const area = Math.abs(areas[candidate] ?? 0);
			if (source && area < areaParent && mapWebglPointInContour(point, source)) {
				parent = candidate;
				areaParent = area;
			}
		}
		return parent;
	});
	const depths = parents.map((_, index) => {
		let depth = 0;
		let parent = parents[index] ?? -1;
		while (parent >= 0 && depth <= contours.length) {
			depth += 1;
			parent = parents[parent] ?? -1;
		}
		return depth;
	});
	const triangles: number[] = [];
	for (let index = 0; index < contours.length; index += 1) {
		if ((depths[index] ?? 0) % 2 !== 0) continue;
		const contourOuter = contours[index];
		if (!contourOuter) continue;
		const contoursPart = [
			contourOuter,
			...contours.filter(
				(_, candidate) =>
					parents[candidate] === index && (depths[candidate] ?? 0) % 2 === 1,
			),
		];
		const coordinates: number[] = [];
		const holes: number[] = [];
		for (const [partIndex, part] of contoursPart.entries()) {
			if (partIndex > 0) holes.push(coordinates.length / 2);
			for (const point of part) coordinates.push(point.x, point.y);
		}
		for (const vertexIndex of earcut(coordinates, holes)) {
			triangles.push(
				coordinates[vertexIndex * 2] ?? 0,
				coordinates[vertexIndex * 2 + 1] ?? 0,
			);
		}
	}
	return {
		vertices: new Float32Array(triangles),
		bounds: mapWebglPointBounds(contours.flat()),
	};
}

/**
 * Creates a triangle mesh for a map stroke.
 *
 * @param segments - The sampled path segments.
 * @param width - The stroke width in map units.
 * @param omittedIndexes - The segment indexes that have no stroke.
 * @returns The stroke triangles and their bounds.
 */
export function mapWebglStrokeMesh(
	segments: MapWebglPathSegment[],
	width: number,
	omittedIndexes: Iterable<number> = [],
): MapWebglMesh {
	const omitted = new Set(omittedIndexes);
	const triangles: number[] = [];
	const half = Math.max(width, 0) / 2;
	if (half === 0) return { vertices: new Float32Array(), bounds: mapWebglPointBounds([]) };
	let run: MapPoint[] = [];
	const addRun = () => {
		if (run.length > 1) mapWebglAddStrokePolyline(triangles, run, half);
		run = [];
	};
	for (const segment of segments) {
		if (omitted.has(segment.startIndex)) {
			addRun();
			continue;
		}
		if (run.length === 0) run.push(...segment.points);
		else run.push(...segment.points.slice(1));
	}
	addRun();
	return {
		vertices: new Float32Array(triangles),
		bounds: mapWebglExpandBounds(
			mapWebglPointBounds(segments.flatMap((segment) => segment.points)),
			half,
		),
	};
}

/**
 * Creates fill triangles for a circle.
 *
 * @param center - The circle center in map units.
 * @param radius - The circle radius in map units.
 * @param segmentCount - The number of circle edges.
 * @returns The circle triangles and their bounds.
 */
export function mapWebglCircleMesh(
	center: MapPoint,
	radius: number,
	segmentCount = 64,
): MapWebglMesh {
	const triangles: number[] = [];
	mapWebglAddCircle(triangles, center, radius, segmentCount);
	return {
		vertices: new Float32Array(triangles),
		bounds: {
			minX: center.x - radius,
			minY: center.y - radius,
			maxX: center.x + radius,
			maxY: center.y + radius,
		},
	};
}

/**
 * Creates two triangles for a rotated rectangle.
 *
 * @param center - The rectangle center in map units.
 * @param width - The rectangle width in map units.
 * @param height - The rectangle height in map units.
 * @param rotation - The clockwise rotation in degrees.
 * @returns The rectangle triangles and their bounds.
 */
export function mapWebglRectangleMesh(
	center: MapPoint,
	width: number,
	height: number,
	rotation = 0,
): MapWebglMesh {
	const radians = (rotation * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	const corners = [
		mapWebglRotateOffset(center, -width / 2, -height / 2, cosine, sine),
		mapWebglRotateOffset(center, width / 2, -height / 2, cosine, sine),
		mapWebglRotateOffset(center, width / 2, height / 2, cosine, sine),
		mapWebglRotateOffset(center, -width / 2, height / 2, cosine, sine),
	];
	const order = [0, 1, 2, 0, 2, 3];
	const triangles = order.flatMap((index) => {
		const point = corners[index] ?? center;
		return [point.x, point.y];
	});
	return { vertices: new Float32Array(triangles), bounds: mapWebglPointBounds(corners) };
}

/**
 * Gets a point and tangent on a quadratic text curve.
 *
 * @param line - The text curve.
 * @param amount - The curve position from 0 through 1.
 * @returns The curve point and its unit tangent.
 */
export function mapWebglNameCurveSample(
	line: MapNameArcLine,
	amount: number,
): { point: MapPoint; tangent: MapPoint } {
	const t = clampMapNumber(amount, 0, 1);
	const rest = 1 - t;
	const point = {
		x: rest * rest * line.start.x + 2 * rest * t * line.control.x + t * t * line.end.x,
		y: rest * rest * line.start.y + 2 * rest * t * line.control.y + t * t * line.end.y,
	};
	const tangentRaw = {
		x: 2 * rest * (line.control.x - line.start.x) + 2 * t * (line.end.x - line.control.x),
		y: 2 * rest * (line.control.y - line.start.y) + 2 * t * (line.end.y - line.control.y),
	};
	const length = Math.hypot(tangentRaw.x, tangentRaw.y) || 1;
	return { point, tangent: { x: tangentRaw.x / length, y: tangentRaw.y / length } };
}

/**
 * Estimates the length of a quadratic text curve.
 *
 * @param line - The text curve.
 * @param sampleCount - The number of measurement segments.
 * @returns The sampled length in map units.
 */
export function mapWebglNameCurveLength(line: MapNameArcLine, sampleCount = 32): number {
	let length = 0;
	let previous = line.start;
	for (let index = 1; index <= sampleCount; index += 1) {
		const current = mapWebglNameCurveSample(line, index / sampleCount).point;
		length += Math.hypot(current.x - previous.x, current.y - previous.y);
		previous = current;
	}
	return length;
}

/**
 * Gets the bounds of a point list.
 *
 * @param points - The points to measure.
 * @returns The minimum and maximum coordinates.
 */
export function mapWebglPointBounds(points: MapPoint[]): MapBounds {
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
 * Adds padding to map bounds.
 *
 * @param bounds - The source bounds.
 * @param amount - The padding in map units.
 * @returns The expanded bounds.
 */
export function mapWebglExpandBounds(bounds: MapBounds, amount: number): MapBounds {
	return {
		minX: bounds.minX - amount,
		minY: bounds.minY - amount,
		maxX: bounds.maxX + amount,
		maxY: bounds.maxY + amount,
	};
}

/**
 * Samples one quadratic curve into an output point list.
 *
 * @param start - The curve start.
 * @param control - The control point.
 * @param end - The curve end.
 * @param tolerance - The permitted curve error in map units.
 * @param depth - The current subdivision depth.
 * @param output - The output point list.
 * @returns Nothing.
 * @sideEffects Adds sampled points to `output`.
 */
function mapWebglFlattenQuadratic(
	start: MapPoint,
	control: MapPoint,
	end: MapPoint,
	tolerance: number,
	depth: number,
	output: MapPoint[],
): void {
	const lineLength = Math.hypot(end.x - start.x, end.y - start.y) || 1;
	const error = Math.abs(
		(end.y - start.y) * control.x -
			(end.x - start.x) * control.y +
			end.x * start.y -
			end.y * start.x,
	);
	if (depth >= CURVE_DEPTH_MAXIMUM || error / lineLength <= tolerance) {
		output.push(end);
		return;
	}
	const startMid = mapWebglMidpoint(start, control);
	const endMid = mapWebglMidpoint(control, end);
	const middle = mapWebglMidpoint(startMid, endMid);
	mapWebglFlattenQuadratic(start, startMid, middle, tolerance, depth + 1, output);
	mapWebglFlattenQuadratic(middle, endMid, end, tolerance, depth + 1, output);
}

/**
 * Samples one cubic curve into an output point list.
 *
 * @param start - The curve start.
 * @param controlStart - The first control point.
 * @param controlEnd - The second control point.
 * @param end - The curve end.
 * @param tolerance - The permitted curve error in map units.
 * @param depth - The current subdivision depth.
 * @param output - The output point list.
 * @returns Nothing.
 * @sideEffects Adds sampled points to `output`.
 */
function mapWebglFlattenCubic(
	start: MapPoint,
	controlStart: MapPoint,
	controlEnd: MapPoint,
	end: MapPoint,
	tolerance: number,
	depth: number,
	output: MapPoint[],
): void {
	const lineLength = Math.hypot(end.x - start.x, end.y - start.y) || 1;
	const errorStart = Math.abs(
		(end.y - start.y) * controlStart.x -
			(end.x - start.x) * controlStart.y +
			end.x * start.y -
			end.y * start.x,
	);
	const errorEnd = Math.abs(
		(end.y - start.y) * controlEnd.x -
			(end.x - start.x) * controlEnd.y +
			end.x * start.y -
			end.y * start.x,
	);
	if (depth >= CURVE_DEPTH_MAXIMUM || Math.max(errorStart, errorEnd) / lineLength <= tolerance) {
		output.push(end);
		return;
	}
	const startControlMid = mapWebglMidpoint(start, controlStart);
	const controlMid = mapWebglMidpoint(controlStart, controlEnd);
	const endControlMid = mapWebglMidpoint(controlEnd, end);
	const firstMid = mapWebglMidpoint(startControlMid, controlMid);
	const secondMid = mapWebglMidpoint(controlMid, endControlMid);
	const middle = mapWebglMidpoint(firstMid, secondMid);
	mapWebglFlattenCubic(start, startControlMid, firstMid, middle, tolerance, depth + 1, output);
	mapWebglFlattenCubic(middle, secondMid, endControlMid, end, tolerance, depth + 1, output);
}

/**
 * Calculates the signed area of one contour.
 *
 * @param contour - The contour points.
 * @returns The signed area.
 */
function mapWebglContourArea(contour: MapPoint[]): number {
	let area = 0;
	for (let index = 0; index < contour.length; index += 1) {
		const current = contour[index];
		const next = contour[(index + 1) % contour.length];
		if (current && next) area += current.x * next.y - next.x * current.y;
	}
	return area / 2;
}

/**
 * Tests whether one point is inside a contour.
 *
 * @param point - The point to test.
 * @param contour - The closed contour.
 * @returns `true` when the point is inside the contour.
 */
function mapWebglPointInContour(point: MapPoint, contour: MapPoint[]): boolean {
	let inside = false;
	for (
		let currentIndex = 0, previousIndex = contour.length - 1;
		currentIndex < contour.length;
		previousIndex = currentIndex, currentIndex += 1
	) {
		const current = contour[currentIndex];
		const previous = contour[previousIndex];
		if (!current || !previous) continue;
		if (
			current.y > point.y !== previous.y > point.y &&
			point.x <
				((previous.x - current.x) * (point.y - current.y)) /
					(previous.y - current.y || Number.EPSILON) +
					current.x
		) {
			inside = !inside;
		}
	}
	return inside;
}

/**
 * Adds one joined polyline to a triangle list.
 *
 * @param output - The output coordinate list.
 * @param sourcePoints - The line points.
 * @param halfWidth - Half of the stroke width.
 * @returns Nothing.
 * @sideEffects Adds joined stroke triangles to `output`.
 */
function mapWebglAddStrokePolyline(
	output: number[],
	sourcePoints: MapPoint[],
	halfWidth: number,
): void {
	const points = sourcePoints.filter(
		(point, index) => index === 0 || !mapWebglPointsEqual(point, sourcePoints[index - 1]),
	);
	const closed = points.length > 2 && mapWebglPointsEqual(points[0], points.at(-1));
	if (closed) points.pop();
	if (points.length < 2) return;
	const pairs: Array<[MapPoint, MapPoint]> = [];
	for (let index = 0; index < points.length; index += 1) {
		const point = points[index];
		if (!point) continue;
		const previous = points[index - 1] ?? (closed ? points.at(-1) : point);
		const next = points[index + 1] ?? (closed ? points[0] : point);
		if (!previous || !next) continue;
		const incoming =
			!closed && index === 0
				? mapWebglLineNormal(point, next)
				: mapWebglLineNormal(previous, point);
		const outgoing =
			!closed && index === points.length - 1 ? incoming : mapWebglLineNormal(point, next);
		let miterX = incoming.x + outgoing.x;
		let miterY = incoming.y + outgoing.y;
		const miterLength = Math.hypot(miterX, miterY);
		if (miterLength < 0.0001) {
			miterX = outgoing.x;
			miterY = outgoing.y;
		} else {
			miterX /= miterLength;
			miterY /= miterLength;
		}
		const divisor = Math.max(Math.abs(miterX * outgoing.x + miterY * outgoing.y), 0.25);
		const extension = Math.min(halfWidth / divisor, halfWidth * 4);
		pairs.push([
			{ x: point.x + miterX * extension, y: point.y + miterY * extension },
			{ x: point.x - miterX * extension, y: point.y - miterY * extension },
		]);
	}
	const edgeCount = closed ? pairs.length : pairs.length - 1;
	for (let index = 0; index < edgeCount; index += 1) {
		const start = pairs[index];
		const end = pairs[(index + 1) % pairs.length];
		if (!start || !end) continue;
		output.push(
			start[0].x,
			start[0].y,
			start[1].x,
			start[1].y,
			end[1].x,
			end[1].y,
			start[0].x,
			start[0].y,
			end[1].x,
			end[1].y,
			end[0].x,
			end[0].y,
		);
	}
}

/**
 * Gets a stable unit normal for one polyline direction.
 *
 * @param start - The direction start.
 * @param end - The direction end.
 * @returns The left-facing unit normal.
 */
function mapWebglLineNormal(start: MapPoint, end: MapPoint): MapPoint {
	const deltaX = end.x - start.x;
	const deltaY = end.y - start.y;
	const length = Math.hypot(deltaX, deltaY) || 1;
	return { x: -deltaY / length, y: deltaX / length };
}

/**
 * Adds a triangle fan to a triangle list.
 *
 * @param output - The output coordinate list.
 * @param center - The fan center.
 * @param radius - The fan radius.
 * @param segmentCount - The number of fan triangles.
 * @returns Nothing.
 * @sideEffects Adds the fan triangles to `output`.
 */
function mapWebglAddCircle(
	output: number[],
	center: MapPoint,
	radius: number,
	segmentCount: number,
): void {
	const count = Math.max(3, Math.round(segmentCount));
	for (let index = 0; index < count; index += 1) {
		const start = (index / count) * Math.PI * 2;
		const end = ((index + 1) / count) * Math.PI * 2;
		output.push(
			center.x,
			center.y,
			center.x + Math.cos(start) * radius,
			center.y + Math.sin(start) * radius,
			center.x + Math.cos(end) * radius,
			center.y + Math.sin(end) * radius,
		);
	}
}

/**
 * Rotates an offset and adds it to a center point.
 *
 * @param center - The rotation center.
 * @param offsetX - The horizontal offset.
 * @param offsetY - The vertical offset.
 * @param cosine - The cosine of the rotation.
 * @param sine - The sine of the rotation.
 * @returns The rotated point.
 */
function mapWebglRotateOffset(
	center: MapPoint,
	offsetX: number,
	offsetY: number,
	cosine: number,
	sine: number,
): MapPoint {
	return {
		x: center.x + offsetX * cosine - offsetY * sine,
		y: center.y + offsetX * sine + offsetY * cosine,
	};
}

/**
 * Gets the midpoint of two points.
 *
 * @param start - The first point.
 * @param end - The second point.
 * @returns The midpoint.
 */
function mapWebglMidpoint(start: MapPoint, end: MapPoint): MapPoint {
	return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

/**
 * Tests two optional points for equal coordinates.
 *
 * @param start - The first point.
 * @param end - The second point.
 * @returns `true` when both points have equal coordinates.
 */
function mapWebglPointsEqual(start?: MapPoint, end?: MapPoint): boolean {
	return Boolean(start && end && start.x === end.x && start.y === end.y);
}
