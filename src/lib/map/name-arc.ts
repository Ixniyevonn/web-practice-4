import { clampMapNumber, mapPointsBounds } from "$lib/map/geometry";
import type { MapPoint } from "$lib/map/types";

export type MapNameArcLine = {
	start: MapPoint;
	control: MapPoint;
	end: MapPoint;
	text: string;
	fontSize: number;
};

export type MapNameArcLayout = {
	lines: MapNameArcLine[];
};

export type MapPathLabelSample = {
	point: MapPoint;
	tangent: MapPoint;
};

const CHAR_EM = 0.56;
const CHORD_INSET = 0.1;
const SAMPLE_COUNT = 7;
const LINE_GAP = 1.2;

/**
 * Tests whether a point lies inside a polygon.
 *
 * @param point - The point to test.
 * @param polygon - The polygon vertices in order.
 * @returns `true` when the point is inside.
 */
export function mapPointInPolygon(point: MapPoint, polygon: MapPoint[]): boolean {
	let inside = false;
	const count = polygon.length;
	for (let index = 0, previous = count - 1; index < count; previous = index, index += 1) {
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
 * Calculates the area centroid of a polygon.
 *
 * @param polygon - The polygon vertices in order.
 * @returns The centroid, or the vertex mean when the area is degenerate.
 */
export function mapPolygonCentroid(polygon: MapPoint[]): MapPoint {
	let area = 0;
	let centerX = 0;
	let centerY = 0;
	const count = polygon.length;
	for (let index = 0; index < count; index += 1) {
		const start = polygon[index];
		const end = polygon[(index + 1) % count];
		if (!start || !end) continue;
		const cross = start.x * end.y - end.x * start.y;
		area += cross;
		centerX += (start.x + end.x) * cross;
		centerY += (start.y + end.y) * cross;
	}
	const signed = area / 2;
	if (Math.abs(signed) < 1e-6) return mapVertexMean(polygon);
	return { x: centerX / (6 * signed), y: centerY / (6 * signed) };
}

/**
 * Splits a name into lines by word count and word length.
 *
 * Four equal words become two lines of two words. A long last word can stand
 * on its own line when the earlier words are shorter.
 *
 * @param title - The name to split.
 * @returns One display line for each row of words.
 */
export function mapNameArcLines(title: string): string[] {
	const manualLines = mapTextManualLines(title);
	if (manualLines.length > 1) return manualLines;
	const words = title
		.trim()
		.split(/[\t\n\f\r ]+/)
		.filter(Boolean);
	if (words.length === 0) return [];
	const lineCount = clampMapNumber(Math.round(Math.sqrt(words.length)), 1, words.length);
	if (lineCount === 1) return [words.join(" ")];
	return partitionWordLines(words, lineCount);
}

/**
 * Splits map text at line breaks from the editor.
 *
 * @param text - The map text.
 * @returns The nonempty lines in their source order.
 */
export function mapTextManualLines(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

/**
 * Builds fitted name arcs for a polygon.
 *
 * The path follows the long interior axis and bends with the local width.
 * Font size uses the polygon size. Zoom does not change the layout.
 *
 * @param polygon - The region vertices in order.
 * @param title - The name to place on the arc.
 * @param fontSizeRequested - The optional font size from the editor.
 * @param anchor - The optional manual center of the name.
 * @param rotation - The optional manual rotation in degrees.
 * @returns The text curves and font size, or `null` when the name cannot fit.
 */
export function mapNameArcLayout(
	polygon: MapPoint[],
	title: string,
	fontSizeRequested?: number,
	anchor?: MapPoint,
	rotation?: number,
): MapNameArcLayout | null {
	if (anchor)
		return mapNameArcAnchoredLayout(polygon, title, anchor, fontSizeRequested, rotation);
	const lines = mapNameArcLines(title);
	if (lines.length === 0 || polygon.length < 3) return null;
	const origin = mapPolygonInteriorPoint(polygon);
	if (!origin) return null;
	const axis = mapPolygonPrincipalAxis(polygon, origin);
	const forward = mapRayPolygonExit(origin, axis, polygon);
	const backward = mapRayPolygonExit(origin, { x: -axis.x, y: -axis.y }, polygon);
	if (forward === null || backward === null) return null;
	const span = forward + backward;
	if (span < 8) return null;
	const inset = span * CHORD_INSET;
	const start = {
		x: origin.x - axis.x * (backward - inset),
		y: origin.y - axis.y * (backward - inset),
	};
	const end = {
		x: origin.x + axis.x * (forward - inset),
		y: origin.y + axis.y * (forward - inset),
	};
	const spineNormal = { x: -axis.y, y: axis.x };
	const spine = mapNameArcSpine(polygon, start, end, spineNormal);
	const first = spine[0] ?? start;
	const last = spine[spine.length - 1] ?? end;
	const mid = spine[Math.floor(spine.length / 2)] ?? mapPointBlend(first, last, 0.5);
	const control = {
		x: 2 * mid.x - 0.5 * first.x - 0.5 * last.x,
		y: 2 * mid.y - 0.5 * first.y - 0.5 * last.y,
	};
	const insideControl = mapPointInPolygon(control, polygon)
		? control
		: mapPointBlend(mid, origin, 0.35);
	const oriented =
		last.x < first.x || (Math.abs(last.x - first.x) < 1e-3 && last.y > first.y)
			? { start: last, control: insideControl, end: first }
			: { start: first, control: insideControl, end: last };
	const arcLength = mapQuadraticLength(oriented.start, oriented.control, oriented.end);
	if (arcLength < 8) return null;
	const halfWidth = mapNameArcHalfWidth(polygon, mid, spineNormal);
	const longest = Math.max(...lines.map((line) => [...line].length), 1);
	const fontSizeMaximum = Math.min(
		arcLength / (longest * CHAR_EM),
		(halfWidth * 2) / (lines.length * LINE_GAP),
	);
	const fontSize = Math.min(fontSizeRequested ?? fontSizeMaximum, fontSizeMaximum);
	if (fontSize < 8 || fontSize > arcLength * 0.9) return null;
	const deltaX = oriented.end.x - oriented.start.x;
	const deltaY = oriented.end.y - oriented.start.y;
	const tangentLength = Math.hypot(deltaX, deltaY) || 1;
	const stack = { x: -deltaY / tangentLength, y: deltaX / tangentLength };
	const layoutLines: MapNameArcLine[] = [];
	for (const [index, text] of lines.entries()) {
		const shift = (index - (lines.length - 1) / 2) * fontSize * LINE_GAP;
		const pathStart = mapOffsetPoint(oriented.start, stack, shift);
		const pathControl = mapOffsetPoint(oriented.control, stack, shift);
		const pathEnd = mapOffsetPoint(oriented.end, stack, shift);
		layoutLines.push({
			start: pathStart,
			control: pathControl,
			end: pathEnd,
			text,
			fontSize,
		});
	}
	return { lines: layoutLines };
}

/**
 * Builds name arcs at a manual anchor.
 *
 * The manual layout uses the polygon axis but does not fit the arc to one interior section.
 *
 * @param polygon - The region vertices in order.
 * @param title - The name to place on the arc.
 * @param anchor - The center of the name.
 * @param fontSizeRequested - The optional font size from the editor.
 * @param rotation - The optional manual rotation in degrees.
 * @returns The text curves and font size, or `null` when the name is empty.
 */
function mapNameArcAnchoredLayout(
	polygon: MapPoint[],
	title: string,
	anchor: MapPoint,
	fontSizeRequested?: number,
	rotation = 0,
): MapNameArcLayout | null {
	const lines = mapNameArcLines(title);
	if (lines.length === 0 || polygon.length < 3) return null;
	const bounds = mapPointsBounds(polygon);
	const rotationRadians = (rotation * Math.PI) / 180;
	const axis = { x: Math.cos(rotationRadians), y: Math.sin(rotationRadians) };
	const normal = { x: -axis.y, y: axis.x };
	const projections = polygon.map((point) => point.x * axis.x + point.y * axis.y);
	const projectionSpan = Math.max(...projections) - Math.min(...projections);
	const boundsMinor = Math.max(Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY), 8);
	const longest = Math.max(...lines.map((line) => [...line].length), 1);
	const fontSize =
		fontSizeRequested ??
		Math.min(
			(projectionSpan * 0.8) / (longest * CHAR_EM),
			boundsMinor / (lines.length * LINE_GAP),
		);
	if (fontSize < 8) return null;
	const halfSpan = Math.max(projectionSpan * 0.4, longest * fontSize * CHAR_EM * 0.55);
	const start = mapOffsetPoint(anchor, axis, -halfSpan);
	const end = mapOffsetPoint(anchor, axis, halfSpan);
	const control = mapOffsetPoint(anchor, normal, -halfSpan * 0.12);
	return {
		lines: lines.map((text, index) => {
			const shift = (index - (lines.length - 1) / 2) * fontSize * LINE_GAP;
			const pathStart = mapOffsetPoint(start, normal, shift);
			const pathControl = mapOffsetPoint(control, normal, shift);
			const pathEnd = mapOffsetPoint(end, normal, shift);
			return {
				start: pathStart,
				control: pathControl,
				end: pathEnd,
				text,
				fontSize,
			};
		}),
	};
}

/**
 * Builds fitted name arcs for a circle.
 *
 * @param center - The circle center.
 * @param radius - The circle radius.
 * @param title - The name to place on the arc.
 * @param fontSizeRequested - The optional font size from the editor.
 * @returns The text curves and font size, or `null` when the name cannot fit.
 */
export function mapCircleNameArcLayout(
	center: MapPoint,
	radius: number,
	title: string,
	fontSizeRequested?: number,
): MapNameArcLayout | null {
	const lines = mapNameArcLines(title);
	if (lines.length === 0 || radius < 8) return null;
	const halfChord = radius * 0.78;
	const start = { x: center.x - halfChord, y: center.y + radius * 0.14 };
	const control = { x: center.x, y: center.y - radius * 0.38 };
	const end = { x: center.x + halfChord, y: start.y };
	const arcLength = mapQuadraticLength(start, control, end);
	const longest = Math.max(...lines.map((line) => [...line].length), 1);
	const fontSizeMaximum = Math.min(
		arcLength / (longest * CHAR_EM),
		(radius * 1.35) / (lines.length * LINE_GAP),
	);
	const fontSize = Math.min(fontSizeRequested ?? fontSizeMaximum, fontSizeMaximum);
	if (fontSize < 8) return null;
	return {
		lines: lines.map((text, index) => {
			const shift = (index - (lines.length - 1) / 2) * fontSize * LINE_GAP;
			return {
				start: { x: start.x, y: start.y + shift },
				control: { x: control.x, y: control.y + shift },
				end: { x: end.x, y: end.y + shift },
				text,
				fontSize,
			};
		}),
	};
}

/**
 * Samples a point and direction along a path.
 *
 * @param points - The path points in drawing order.
 * @param position - The requested position from 0 through 100 percent.
 * @returns The sampled point and unit tangent, or `null` for a degenerate path.
 */
export function mapPathLabelSample(
	points: MapPoint[],
	position: number,
): MapPathLabelSample | null {
	if (points.length < 2) return null;
	const lengths: number[] = [];
	let total = 0;
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		if (!start || !end) continue;
		const length = Math.hypot(end.x - start.x, end.y - start.y);
		lengths.push(length);
		total += length;
	}
	if (total <= Number.EPSILON) return null;
	let remaining = (clampMapNumber(position, 0, 100) / 100) * total;
	for (let index = 0; index < lengths.length; index += 1) {
		const length = lengths[index] ?? 0;
		const start = points[index];
		const end = points[index + 1];
		if (!start || !end || length <= Number.EPSILON) continue;
		if (remaining > length && index < lengths.length - 1) {
			remaining -= length;
			continue;
		}
		const amount = clampMapNumber(remaining / length, 0, 1);
		return {
			point: mapPointBlend(start, end, amount),
			tangent: { x: (end.x - start.x) / length, y: (end.y - start.y) / length },
		};
	}
	return null;
}

/**
 * Builds local text curves around a selected position on a path.
 *
 * @param points - The sampled path points in drawing order.
 * @param title - The label text.
 * @param fontSizeRequested - The configured font size in map units.
 * @param position - The label center from 0 through 100 percent.
 * @returns Text curves centered near the requested position, or `null` for invalid input.
 */
export function mapPathLabelArcLayout(
	points: MapPoint[],
	title: string,
	fontSizeRequested = 48,
	position = 50,
): MapNameArcLayout | null {
	const lines = mapNameArcLines(title);
	if (lines.length === 0 || points.length < 2) return null;
	let total = 0;
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		if (start && end) total += Math.hypot(end.x - start.x, end.y - start.y);
	}
	if (total < 8) return null;
	const longest = Math.max(...lines.map((line) => [...line].length), 1);
	const fontSize = Math.max(8, fontSizeRequested);
	const span = Math.min(total, Math.max(fontSize * longest * CHAR_EM * 1.15, fontSize * 3));
	const centerDistance = (clampMapNumber(position, 0, 100) / 100) * total;
	const startDistance = clampMapNumber(centerDistance - span / 2, 0, total - span);
	const endDistance = startDistance + span;
	const start = mapPathLabelSample(points, (startDistance / total) * 100);
	const middle = mapPathLabelSample(points, ((startDistance + span / 2) / total) * 100);
	const end = mapPathLabelSample(points, (endDistance / total) * 100);
	if (!start || !middle || !end) return null;
	let pathStart = start.point;
	let pathEnd = end.point;
	let tangent = middle.tangent;
	if (tangent.x < 0 || (Math.abs(tangent.x) < 1e-4 && tangent.y > 0)) {
		[pathStart, pathEnd] = [pathEnd, pathStart];
		tangent = { x: -tangent.x, y: -tangent.y };
	}
	const control = {
		x: 2 * middle.point.x - 0.5 * pathStart.x - 0.5 * pathEnd.x,
		y: 2 * middle.point.y - 0.5 * pathStart.y - 0.5 * pathEnd.y,
	};
	const normal = { x: -tangent.y, y: tangent.x };
	return {
		lines: lines.map((text, index) => {
			const shift = (index - (lines.length - 1) / 2) * fontSize * LINE_GAP;
			return {
				start: mapOffsetPoint(pathStart, normal, shift),
				control: mapOffsetPoint(control, normal, shift),
				end: mapOffsetPoint(pathEnd, normal, shift),
				text,
				fontSize,
			};
		}),
	};
}

/**
 * Packs words into a fixed number of lines with balanced character length.
 *
 * @param words - The words in reading order.
 * @param lineCount - The number of lines to fill.
 * @returns Joined lines from first to last.
 */
function partitionWordLines(words: string[], lineCount: number): string[] {
	const count = words.length;
	const prefix = [0];
	for (const word of words) prefix.push((prefix.at(-1) ?? 0) + word.length);
	const width = (from: number, to: number): number =>
		(prefix[to] ?? 0) - (prefix[from] ?? 0) + Math.max(to - from - 1, 0);
	const worst = Array.from({ length: count + 1 }, () =>
		Array.from({ length: lineCount + 1 }, () => Number.POSITIVE_INFINITY),
	);
	const splitAt = Array.from({ length: count + 1 }, () =>
		Array.from({ length: lineCount + 1 }, () => 0),
	);
	const first = worst[0];
	if (first) first[0] = 0;
	for (let lines = 1; lines <= lineCount; lines += 1) {
		for (let end = lines; end <= count; end += 1) {
			for (let start = lines - 1; start < end; start += 1) {
				const previous = worst[start]?.[lines - 1] ?? Number.POSITIVE_INFINITY;
				const candidate = Math.max(previous, width(start, end));
				const cell = worst[end]?.[lines] ?? Number.POSITIVE_INFINITY;
				if (candidate > cell) continue;
				const row = worst[end];
				const splitRow = splitAt[end];
				if (row) row[lines] = candidate;
				if (splitRow) splitRow[lines] = start;
			}
		}
	}
	const lines: string[] = [];
	let end = count;
	for (let remaining = lineCount; remaining >= 1; remaining -= 1) {
		const start = splitAt[end]?.[remaining] ?? 0;
		lines.push(words.slice(start, end).join(" "));
		end = start;
	}
	return lines.reverse();
}

/**
 * Moves a point along a unit axis.
 *
 * @param point - The point to move.
 * @param axis - The unit direction.
 * @param distance - The signed distance.
 * @returns The moved point.
 */
function mapOffsetPoint(point: MapPoint, axis: MapPoint, distance: number): MapPoint {
	return {
		x: point.x + axis.x * distance,
		y: point.y + axis.y * distance,
	};
}

/**
 * Returns the mean of polygon vertices.
 *
 * @param polygon - The polygon vertices.
 * @returns The vertex mean.
 */
function mapVertexMean(polygon: MapPoint[]): MapPoint {
	let x = 0;
	let y = 0;
	for (const point of polygon) {
		x += point.x;
		y += point.y;
	}
	const count = Math.max(polygon.length, 1);
	return { x: x / count, y: y / count };
}

/**
 * Finds a point that lies inside the polygon.
 *
 * @param polygon - The polygon vertices in order.
 * @returns An interior point, or `null` when none is found.
 */
function mapPolygonInteriorPoint(polygon: MapPoint[]): MapPoint | null {
	const centroid = mapPolygonCentroid(polygon);
	if (mapPointInPolygon(centroid, polygon)) return centroid;
	const mean = mapVertexMean(polygon);
	if (mapPointInPolygon(mean, polygon)) return mean;
	const bounds = mapPointsBounds(polygon);
	for (let row = 0; row < 5; row += 1) {
		for (let column = 0; column < 5; column += 1) {
			const point = {
				x: bounds.minX + ((column + 0.5) / 5) * (bounds.maxX - bounds.minX),
				y: bounds.minY + ((row + 0.5) / 5) * (bounds.maxY - bounds.minY),
			};
			if (mapPointInPolygon(point, polygon)) return point;
		}
	}
	return null;
}

/**
 * Calculates the principal axis of a polygon.
 *
 * @param polygon - The polygon vertices.
 * @param origin - The axis origin.
 * @returns A unit vector along the long axis.
 */
function mapPolygonPrincipalAxis(polygon: MapPoint[], origin: MapPoint): MapPoint {
	let covXX = 0;
	let covXY = 0;
	let covYY = 0;
	for (const point of polygon) {
		const dx = point.x - origin.x;
		const dy = point.y - origin.y;
		covXX += dx * dx;
		covXY += dx * dy;
		covYY += dy * dy;
	}
	const theta = 0.5 * Math.atan2(2 * covXY, covXX - covYY || Number.EPSILON);
	const axis = { x: Math.cos(theta), y: Math.sin(theta) };
	const length = Math.hypot(axis.x, axis.y) || 1;
	return { x: axis.x / length, y: axis.y / length };
}

/**
 * Finds the distance from an origin to the first polygon edge along a ray.
 *
 * @param origin - The ray origin. The origin must lie inside the polygon.
 * @param direction - The ray direction.
 * @param polygon - The polygon vertices in order.
 * @returns The exit distance, or `null` when the ray misses.
 */
function mapRayPolygonExit(
	origin: MapPoint,
	direction: MapPoint,
	polygon: MapPoint[],
): number | null {
	let nearest: number | null = null;
	const count = polygon.length;
	for (let index = 0; index < count; index += 1) {
		const start = polygon[index];
		const end = polygon[(index + 1) % count];
		if (!start || !end) continue;
		const hit = mapRaySegmentHit(origin, direction, start, end);
		if (hit === null) continue;
		if (nearest === null || hit < nearest) nearest = hit;
	}
	return nearest;
}

/**
 * Finds the ray parameter where a ray hits a segment.
 *
 * @param origin - The ray origin.
 * @param direction - The ray direction.
 * @param start - The segment start.
 * @param end - The segment end.
 * @returns The hit distance, or `null` when the ray misses the segment.
 */
function mapRaySegmentHit(
	origin: MapPoint,
	direction: MapPoint,
	start: MapPoint,
	end: MapPoint,
): number | null {
	const edgeX = end.x - start.x;
	const edgeY = end.y - start.y;
	const det = direction.x * edgeY - direction.y * edgeX;
	if (Math.abs(det) < 1e-12) return null;
	const offsetX = start.x - origin.x;
	const offsetY = start.y - origin.y;
	const time = (offsetX * edgeY - offsetY * edgeX) / det;
	const amount = (offsetX * direction.y - offsetY * direction.x) / det;
	if (time <= 1e-6 || amount < 0 || amount > 1) return null;
	return time;
}

/**
 * Builds interior spine samples along a chord.
 *
 * @param polygon - The polygon vertices.
 * @param start - The inset chord start.
 * @param end - The inset chord end.
 * @param normal - A unit perpendicular to the chord.
 * @returns Spine points from start to end.
 */
function mapNameArcSpine(
	polygon: MapPoint[],
	start: MapPoint,
	end: MapPoint,
	normal: MapPoint,
): MapPoint[] {
	const spine: MapPoint[] = [];
	for (let index = 0; index < SAMPLE_COUNT; index += 1) {
		const amount = index / (SAMPLE_COUNT - 1);
		const point = mapPointBlend(start, end, amount);
		const positive = mapRayPolygonExit(point, normal, polygon) ?? 0;
		const negative = mapRayPolygonExit(point, { x: -normal.x, y: -normal.y }, polygon) ?? 0;
		const shift = ((positive - negative) / 2) * 0.55;
		spine.push({
			x: point.x + normal.x * shift,
			y: point.y + normal.y * shift,
		});
	}
	return spine;
}

/**
 * Measures the smaller interior half-width at a point.
 *
 * @param polygon - The polygon vertices.
 * @param point - The sample point.
 * @param normal - A unit perpendicular to the name axis.
 * @returns The smaller distance to the boundary along the normal.
 */
function mapNameArcHalfWidth(polygon: MapPoint[], point: MapPoint, normal: MapPoint): number {
	const positive = mapRayPolygonExit(point, normal, polygon) ?? 0;
	const negative = mapRayPolygonExit(point, { x: -normal.x, y: -normal.y }, polygon) ?? 0;
	return Math.max(Math.min(positive, negative), 1);
}

/**
 * Blends two points.
 *
 * @param start - The first point.
 * @param end - The second point.
 * @param amount - The blend from 0 through 1.
 * @returns The blended point.
 */
function mapPointBlend(start: MapPoint, end: MapPoint, amount: number): MapPoint {
	const t = clampMapNumber(amount, 0, 1);
	return {
		x: start.x + (end.x - start.x) * t,
		y: start.y + (end.y - start.y) * t,
	};
}

/**
 * Estimates the length of a quadratic Bezier.
 *
 * @param start - The curve start.
 * @param control - The control point.
 * @param end - The curve end.
 * @returns The sampled curve length.
 */
function mapQuadraticLength(start: MapPoint, control: MapPoint, end: MapPoint): number {
	let length = 0;
	let previous = start;
	for (let index = 1; index <= 8; index += 1) {
		const t = index / 8;
		const rest = 1 - t;
		const point = {
			x: rest * rest * start.x + 2 * rest * t * control.x + t * t * end.x,
			y: rest * rest * start.y + 2 * rest * t * control.y + t * t * end.y,
		};
		length += Math.hypot(point.x - previous.x, point.y - previous.y);
		previous = point;
	}
	return length;
}
