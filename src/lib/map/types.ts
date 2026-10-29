export type MapPoint = {
	x: number;
	y: number;
};

export type MapBounds = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

export type MapElementMetadata = {
	title?: string;
	description?: string;
	author?: {
		name: string;
		href?: string;
	};
	url?: string;
};

export type MapFillGradient = {
	color: string;
	opacity: number;
	angle: number;
	offset?: number;
};

export type MapElementStyle = {
	borderColor: string;
	borderOpacity: number;
	borderWidth: number;
	fillColor: string;
	fillOpacity: number;
	fillGradient?: MapFillGradient;
};

export type MapNameArc = {
	enabled?: boolean;
	fontId?: string;
	fontSize?: number;
	anchor?: MapPoint;
	rotation?: number;
	fillColor: string;
	fillOpacity: number;
	borderColor: string;
	borderOpacity: number;
	borderWidth: number;
};

export type MapPathLabel = Omit<MapNameArc, "anchor" | "rotation"> & {
	mode?: "straight" | "arc";
	position?: number;
};

export type MapElementBase = {
	id: string;
	locationUid?: string;
	locationMetadata?: MapElementMetadata;
	labelName?: string;
	namePrevious?: string[];
	layerIds: string[];
	parentRegionId?: string;
	metadata?: MapElementMetadata;
};

export type MapElementShapeBase = MapElementBase & {
	style: MapElementStyle;
};

export type MapElementRegion = MapElementShapeBase & {
	type: "region";
	subtype?: "default" | "kill-zone";
	parameters?: Record<string, MapTacticalParameter>;
	points: MapPoint[];
	smoothing: number;
	focusChildren?: boolean;
	waterEdges?: number[];
	nameArc?: MapNameArc;
};

export type MapElementArea = MapElementShapeBase & {
	type: "area";
	center: MapPoint;
	radius: number;
	nameArc?: MapNameArc;
};

export type MapElementPath = MapElementShapeBase & {
	type: "path";
	subtype?: "default" | "boundary" | "arrow";
	parameters?: Record<string, MapTacticalParameter>;
	points: MapPoint[];
	smoothing: number;
	label?: MapPathLabel;
};

export type MapSymbolLabel = {
	autoscale?: boolean;
	fontId?: string;
	fontSize?: number;
};

export type MapElementSymbol = MapElementBase & {
	type: "symbol";
	subtype?: "default" | "unit";
	parameters?: Record<string, MapTacticalParameter>;
	assetUid: string;
	center: MapPoint;
	width: number;
	height: number;
	rotation: number;
	shape?: "rectangle" | "circle";
	style?: MapElementStyle;
	label?: MapSymbolLabel;
};

export type MapElementGrid = MapElementShapeBase & {
	type: "grid";
	center: MapPoint;
	width: number;
	height: number;
	rotation: number;
	columnCount: number;
	rowCount: number;
	subdivisionCount: number;
};

export type MapTacticalKind =
	| "unit"
	| "boundary"
	| "arrow"
	| "attack"
	| "encirclement"
	| "retreat"
	| "kill-zone";

export type MapTacticalParameter = string | number | boolean;

export type MapElementTactical = MapElementShapeBase & {
	type: "tactical";
	kind: MapTacticalKind;
	points: MapPoint[];
	smoothing: number;
	stylePresetId: string;
	parameters: Record<string, MapTacticalParameter>;
};

export type MapElement =
	| MapElementRegion
	| MapElementArea
	| MapElementPath
	| MapElementSymbol
	| MapElementGrid
	| MapElementTactical;

export type MapLayerType = "default" | "grid" | "user-heroes" | "locations";

export type MapLayer = {
	id: string;
	name: string;
	type: MapLayerType;
	enabledDefault?: boolean;
	incompatibleLayerIds?: string[];
};

export type MapMilitarySymbol = {
	id: string;
	name: string;
	assetUid?: string;
};

export type MapMilitaryConfig = {
	roles: MapMilitarySymbol[];
	echelons: MapMilitarySymbol[];
};

export type MapVisibilityZone = {
	id: string;
	name: string;
	parentZoneId?: string;
	layerIds: string[];
	points: MapPoint[];
	style: MapElementStyle;
};

export type MapGridConfig = {
	enabledDefault: boolean;
	layerId: string;
	origin: MapPoint;
	rotation: number;
	cellWidth: number;
	cellHeight: number;
	subdivisionCount: number;
};

export type MapViewPreset = {
	id: string;
	name: string;
	layerIds: string[];
	bounds: MapBounds;
	center: MapPoint;
	zoomInitial: number;
	zoomMinimum: number;
	zoomMaximum: number;
	zoneIds?: string[];
	gridEnabled?: boolean;
	publicHeroesEnabled?: boolean;
};

export type MapConfigVersion1 = {
	version: 1;
	image: {
		src: string;
		alt: string;
		width: number;
		height: number;
	};
	scale: {
		x: number;
		y: number;
		unit: string;
	};
	layers: MapLayer[];
	elements: MapElement[];
};

export type MapConfig = Omit<MapConfigVersion1, "version"> & {
	version: 2;
	military: MapMilitaryConfig;
	visibilityZones: MapVisibilityZone[];
	grid: MapGridConfig | null;
	viewPresets: MapViewPreset[];
};

export type MapVisibilityZoneConfig = {
	version: 1;
	zoneId: string;
	revision: string;
	elements: MapElement[];
};

export type MapHeroPlacement = {
	heroUid: string;
	positionX: number;
	positionY: number;
	visibilityZoneId: string | null;
	name: string;
	profileUrl: string;
	avatarUrl: string | null;
	ownerUserid?: string;
};

export type MapDisplayFeatures = {
	regionFocusMode?: "region" | "composite" | "multilayer";
	interactionEnabled?: boolean;
	imageDetail?: "overview" | "source" | "tiles";
	objectRendering?: boolean;
	objectPicking?: boolean;
	objectHover?: "none" | "border";
	objectPopups?: boolean;
	positionPicking?: boolean;
	positionMarker?: "avatar" | "pin";
	heroMarkers?: boolean;
	visibilityZones?: boolean;
	grid?: boolean;
	cameraNavigation?: boolean;
};

export type MapImageVariantTile = {
	x: number;
	y: number;
	width: number;
	height: number;
	src: string;
};

export type MapImageVariantLevel = {
	scale: number;
	width: number;
	height: number;
	tiles: MapImageVariantTile[];
};

export type MapImageVariantManifest = {
	version: 1;
	source: string;
	generation: string;
	width: number;
	height: number;
	tileSize: number;
	overview: { src: string; width: number; height: number };
	levels: MapImageVariantLevel[];
};

export type MapPointerResult = {
	point: MapPoint;
	hit: { kind: "element" | "hero" | "zone"; id: string } | null;
};

export type MapElementType = MapElement["type"];
