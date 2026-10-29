import type { MapNameArcLayout } from "$lib/map/name-arc";
import type { MapConfig, MapElement, MapElementSymbol, MapPoint } from "$lib/map/types";

export type MapRenderRulerPath = {
	id: string;
	points: MapPoint[];
};

export type MapRenderPointAction =
	| "point"
	| "center"
	| "radius"
	| "size"
	| "rotation"
	| "name"
	| "nameRotation"
	| "insert";

export type MapRenderHit =
	| { kind: "element"; elementId: string }
	| { kind: "ruler"; rulerId: string }
	| { kind: "rulerPoint"; rulerId: string; index: number }
	| { kind: "finishRuler" }
	| { kind: "finishRegion" }
	| { kind: "edit"; elementId: string; action: MapRenderPointAction; index: number };

export type MapRenderOverlay = {
	rulerPaths: MapRenderRulerPath[];
	rulerActivePoints: MapPoint[];
	rulerPreviewPoints: MapPoint[];
	rulerSelectedId: string | null;
	rulerHoverId: string | null;
	rulerFinishHovered: boolean;
	draftPoints: MapPoint[];
	draftPreviewPoints: MapPoint[];
	draftType: "region" | "path" | null;
	editingElementId: string | null;
	elementHoverId: string | null;
	elementActiveId: string | null;
	editHoverKey: string | null;
	selectedPointIndexes: number[];
	symbolPreview?: MapElementSymbol;
};

export type MapRenderImageTile = {
	source: string;
	x: number;
	y: number;
	width: number;
	height: number;
};

export type MapRenderScene = {
	contentRevision: string;
	orderRevision: string;
	editingRevision: string;
	visibilityRevision: string;
	rulerRevision: string;
	overlayRevision: string;
	activeLayerIds: string[];
	config: MapConfig;
	elements: MapElement[];
	elementsAll: MapElement[];
	interactiveElementIds?: ReadonlySet<string>;
	focusedRegionId: string | null;
	focusedRegionMode?: "region" | "composite" | "multilayer";
	imageSource: string;
	imageElement?: HTMLImageElement;
	imageTiles?: MapRenderImageTile[];
	symbolSources: Map<string, string>;
	nameLayouts: Map<string, MapNameArcLayout | null>;
	overlay: MapRenderOverlay;
};

export type MapRenderView = {
	width: number;
	height: number;
	panX: number;
	panY: number;
	zoom: number;
	colorCache: boolean;
};

export type MapRenderResult = {
	imagePresented: boolean;
	ready: boolean;
};

export type MapRenderBackend = {
	draw: (scene: MapRenderScene, view: MapRenderView) => MapRenderResult;
	pick: (x: number, y: number) => MapRenderHit | null;
	destroy: () => void;
};
