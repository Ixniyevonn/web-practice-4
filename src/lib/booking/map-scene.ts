import type {
	MapBounds,
	MapElementArea,
	MapElementRegion,
	MapElementStyle,
	MapElementSymbol,
	MapPoint
} from "$lib/map/types";
import type { MapPresetScene } from "$lib/map/preset-scene";
import type { Lodging } from "$lib/booking/types";
import { FLATRIA_REGION_ID } from "$lib/content";

type SceneRegion = {
	id: string;
	name: string;
	points: MapPoint[];
};

type SceneOptions = {
	lodgings: Lodging[];
	occupiedIds: ReadonlySet<string>;
	selectedId: string | null;
	hoveredId: string | null;
	imageSrc: string;
	imageWidth: number;
	imageHeight: number;
	imageAlt: string;
	bounds: MapBounds;
	region: SceneRegion;
	symbolSources: Record<string, string>;
	revision: string;
};

function lodgingStyle(
	selected: boolean,
	occupied: boolean,
	hovered: boolean
): MapElementStyle {
	if (selected) {
		return {
			borderColor: "#ffcf9f",
			borderOpacity: 1,
			borderWidth: 5,
			fillColor: "#e4b472",
			fillOpacity: 0.38
		};
	}
	if (occupied) {
		return {
			borderColor: hovered ? "#e8897f" : "#6e6357",
			borderOpacity: hovered ? 1 : 0.65,
			borderWidth: hovered ? 4 : 3,
			fillColor: "#3b322a",
			fillOpacity: 0.5
		};
	}
	if (hovered) {
		return {
			borderColor: "#ffcf9f",
			borderOpacity: 1,
			borderWidth: 4,
			fillColor: "#e4b472",
			fillOpacity: 0.22
		};
	}
	return {
		borderColor: "#e4b472",
		borderOpacity: 0.9,
		borderWidth: 3,
		fillColor: "#b98a4e",
		fillOpacity: 0.22
	};
}

/**
 * Builds the immutable scene consumed by the WebGL map renderer.
 *
 * The source map already contains roads, forests, and labels. The vector layer
 * adds the Flatria border and lodging halos, so the booking state is visible on
 * the parchment without hiding its geography.
 *
 * @param options - Current lodgings, occupancy, selection, region, and image metadata.
 * @returns A complete preset scene for `MapLightweightRenderer`.
 */
export function buildLodgingScene(options: SceneOptions): MapPresetScene {
	const region: MapElementRegion = {
		id: options.region.id,
		type: "region",
		layerIds: ["main"],
		points: options.region.points,
		smoothing: 90,
		style: {
			borderColor: "#ffcf9f",
			borderOpacity: 0.72,
			borderWidth: 7,
			fillColor: "#e4b472",
			fillOpacity: 0.05
		},
		metadata: {
			title: options.region.name
		}
	};

	const areaElements: MapElementArea[] = options.lodgings.map((lodging) => {
		const selected = lodging.id === options.selectedId;
		const occupied = options.occupiedIds.has(lodging.id);
		const hovered = lodging.id === options.hoveredId;
		return {
			id: lodging.id,
			type: "area",
			layerIds: ["main"],
			parentRegionId: FLATRIA_REGION_ID,
			center: { x: lodging.x, y: lodging.y },
			radius: selected ? 46 : hovered ? 41 : 32,
			style: lodgingStyle(selected, occupied, hovered),
			metadata: {
				title: lodging.name,
				description: lodging.description
			}
		};
	});

	const symbolElements: MapElementSymbol[] = options.lodgings.map((lodging) => {
		const state =
			lodging.id === options.selectedId
				? "selected"
				: options.occupiedIds.has(lodging.id)
					? "occupied"
					: lodging.id === options.hoveredId
						? "hover"
						: "free";
		return {
			id: `${lodging.id}-symbol`,
			type: "symbol",
			layerIds: ["main"],
			parentRegionId: FLATRIA_REGION_ID,
			assetUid: `${state}-${lodging.kind}`,
			center: { x: lodging.x, y: lodging.y },
			width: 58,
			height: 58,
			rotation: 0,
			metadata: { title: lodging.name }
		};
	});

	const sceneElements = [
		{
			element: region,
			zoneId: null,
			bounds: { ...options.bounds }
		},
		...areaElements.map((element) => {
			const radius = element.radius;
			return {
				element,
				zoneId: null,
				bounds: {
					minX: element.center.x - radius,
					minY: element.center.y - radius,
					maxX: element.center.x + radius,
					maxY: element.center.y + radius
				}
			};
		}),
		...symbolElements.map((element) => ({
			element,
			zoneId: null,
			bounds: {
				minX: element.center.x - element.width / 2,
				minY: element.center.y - element.height / 2,
				maxX: element.center.x + element.width / 2,
				maxY: element.center.y + element.height / 2
			}
		}))
	];

	return {
		revision: options.revision,
		focusedRegionId: options.region.id,
		focusedRegionMode: "composite",
		preset: {
			id: "flatria",
			name: options.region.name,
			layerIds: ["main"],
			bounds: { ...options.bounds },
			center: {
				x: (options.bounds.minX + options.bounds.maxX) / 2,
				y: (options.bounds.minY + options.bounds.maxY) / 2
			},
			zoomInitial: 1,
			zoomMinimum: 1,
			zoomMaximum: 4,
			gridEnabled: false,
			publicHeroesEnabled: false
		},
		image: {
			src: options.imageSrc,
			alt: options.imageAlt,
			width: options.imageWidth,
			height: options.imageHeight
		},
		scale: { x: 1, y: 1, unit: "миль" },
		layers: [{ id: "main", name: "Флатрия", type: "default" }],
		military: { roles: [], echelons: [] },
		elements: sceneElements,
		visibilityZones: [],
		grid: null,
		heroPlacements: [],
		symbolSources: { ...options.symbolSources },
		imageVariants: null
	};
}
