/// <reference lib="webworker" />

import {
	mapWebglCompoundFillMesh,
	mapWebglElementMeshes,
	mapWebglPathContours,
	mapWebglStrokeMesh,
	type MapWebglElementMeshes,
	type MapWebglMesh,
	type MapWebglPathCommand,
} from "$lib/map/webgl-geometry";
import type { MapElement, MapPoint } from "$lib/map/types";

export type MapWebglGeometryRequest = {
	kind: "elements";
	id: number;
	elements: MapElement[];
};

export type MapWebglGlyphRequest = {
	kind: "glyphs";
	id: number;
	glyphs: Array<{
		fontId: string;
		character: string;
		commands: MapWebglPathCommand[];
		outlineWidths: number[];
	}>;
};

export type MapWebglGeometryResult = {
	kind: "elements";
	id: number;
	meshes: Array<{ elementId: string; value: MapWebglElementMeshes }>;
};

export type MapWebglGlyphResult = {
	kind: "glyphs";
	id: number;
	glyphs: Array<{
		fontId: string;
		character: string;
		contours: MapPoint[][];
		fill: MapWebglMesh;
		outlines: Array<{ key: string; vertices: Float32Array }>;
	}>;
};

export type MapWebglWorkerRequest = MapWebglGeometryRequest | MapWebglGlyphRequest;
export type MapWebglWorkerResult = MapWebglGeometryResult | MapWebglGlyphResult;

/**
 * Gets each transferable vertex buffer from a geometry result.
 *
 * @param meshes - The completed element meshes.
 * @returns The buffers that the worker transfers to the main thread.
 */
function mapWebglGeometryTransfers(meshes: MapWebglGeometryResult["meshes"]): Transferable[] {
	const transfers: Transferable[] = [];
	const buffers = new Set<ArrayBufferLike>();
	for (const { value } of meshes) {
		for (const buffer of [
			value.pick.vertices.buffer,
			value.fill?.vertices.buffer,
			value.stroke?.vertices.buffer,
		]) {
			if (!buffer || buffers.has(buffer)) continue;
			buffers.add(buffer);
			transfers.push(buffer as ArrayBuffer);
		}
	}
	return transfers;
}

/**
 * Gets each transferable vertex buffer from a glyph result.
 *
 * @param glyphs - The completed glyph meshes.
 * @returns The buffers that the worker transfers to the main thread.
 */
function mapWebglGlyphTransfers(glyphs: MapWebglGlyphResult["glyphs"]): Transferable[] {
	const transfers: Transferable[] = [];
	for (const glyph of glyphs) {
		transfers.push(glyph.fill.vertices.buffer);
		for (const outline of glyph.outlines) transfers.push(outline.vertices.buffer);
	}
	return transfers;
}

/**
 * Tessellates a geometry request outside the user-interface thread.
 *
 * @param request - The request identifier and map elements.
 * @returns Nothing.
 * @sideEffects Sends the completed meshes to the renderer.
 */
function mapWebglPrepareGeometry(request: MapWebglGeometryRequest): void {
	const meshes = request.elements.map((element) => ({
		elementId: element.id,
		value: mapWebglElementMeshes(element),
	}));
	const result: MapWebglGeometryResult = { kind: "elements", id: request.id, meshes };
	self.postMessage(result, { transfer: mapWebglGeometryTransfers(meshes) });
}

/**
 * Tessellates glyph fills and requested outlines outside the user-interface thread.
 *
 * @param request - The request identifier and compact glyph paths.
 * @returns Nothing.
 * @sideEffects Sends the completed glyph meshes to the renderer.
 */
function mapWebglPrepareGlyphs(request: MapWebglGlyphRequest): void {
	const glyphs = request.glyphs.map((glyph) => {
		const contours = mapWebglPathContours(glyph.commands);
		const fill = mapWebglCompoundFillMesh(contours);
		const outlines = glyph.outlineWidths.map((width) => {
			const values: number[] = [];
			for (const contour of contours) {
				values.push(
					...mapWebglStrokeMesh([{ startIndex: 0, points: contour }], width).vertices,
				);
			}
			return { key: String(width), vertices: new Float32Array(values) };
		});
		return {
			fontId: glyph.fontId,
			character: glyph.character,
			contours,
			fill,
			outlines,
		};
	});
	const result: MapWebglGlyphResult = { kind: "glyphs", id: request.id, glyphs };
	self.postMessage(result, { transfer: mapWebglGlyphTransfers(glyphs) });
}

self.onmessage = (event: MessageEvent<MapWebglWorkerRequest>) => {
	if (event.data.kind === "elements") mapWebglPrepareGeometry(event.data);
	else mapWebglPrepareGlyphs(event.data);
};
