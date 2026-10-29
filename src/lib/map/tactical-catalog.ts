import type { MapMilitaryConfig, MapTacticalKind, MapTacticalParameter } from "$lib/map/types";

export type MapTacticalParameterRule =
	| { type: "boolean"; default: boolean }
	| { type: "enum"; default: string; values: string[] }
	| { type: "number"; default: number; minimum: number; maximum: number; sliderMaximum?: number };

export type MapTacticalCatalogItem = {
	id: string;
	name: string;
	family: "unit" | "line" | "arrow" | "area";
	kind: MapTacticalKind;
	pointCountMinimum: number;
	pointCountMaximum: number;
	pointLabels: string[];
	parameters: Record<string, MapTacticalParameterRule>;
	stylePresetId: string;
	geometryRecipeId: string;
	detail: { distant: number; medium: number; near: number };
};

export const MAP_MILITARY_CONFIG_DEFAULT: MapMilitaryConfig = {
	roles: [
		{ id: "infantry", name: "Пехота" },
		{ id: "cavalry", name: "Кавалерия" },
		{ id: "artillery", name: "Артиллерия" },
		{ id: "magic", name: "Магическое подразделение" },
	],
	echelons: [
		{ id: "squad", name: "Отряд" },
		{ id: "company", name: "Рота" },
		{ id: "battalion", name: "Батальон" },
		{ id: "regiment", name: "Полк" },
	],
};

export const MAP_TACTICAL_CATALOG: MapTacticalCatalogItem[] = [
	{
		id: "unit-designation",
		name: "Обозначение подразделения",
		family: "unit",
		kind: "unit",
		pointCountMinimum: 1,
		pointCountMaximum: 1,
		pointLabels: ["Позиция"],
		parameters: {
			role: {
				type: "enum",
				default: "infantry",
				values: MAP_MILITARY_CONFIG_DEFAULT.roles.map((entry) => entry.id),
			},
			echelon: {
				type: "enum",
				default: "company",
				values: MAP_MILITARY_CONFIG_DEFAULT.echelons.map((entry) => entry.id),
			},
			size: { type: "number", default: 56, minimum: 12, maximum: 240 },
			rotation: { type: "number", default: 0, minimum: -180, maximum: 180 },
		},
		stylePresetId: "tactical-unit",
		geometryRecipeId: "unit-box",
		detail: { distant: 0, medium: 1, near: 2 },
	},
	{
		id: "directed-boundary",
		name: "Направленная граница",
		family: "line",
		kind: "boundary",
		pointCountMinimum: 2,
		pointCountMaximum: 256,
		pointLabels: ["Начало", "Путь", "Конец"],
		parameters: {
			width: { type: "number", default: 10, minimum: 2, maximum: 120 },
			markSpacing: { type: "number", default: 48, minimum: 12, maximum: 300 },
			reverse: { type: "boolean", default: false },
		},
		stylePresetId: "tactical-line",
		geometryRecipeId: "directed-line",
		detail: { distant: 1, medium: 2, near: 3 },
	},
	{
		id: "military-arrow",
		name: "Военная стрелка",
		family: "arrow",
		kind: "arrow",
		pointCountMinimum: 2,
		pointCountMaximum: 256,
		pointLabels: ["Начало", "Путь", "Конец"],
		parameters: {
			width: { type: "number", default: 18, minimum: 4, maximum: 300 },
			widthStart: {
				type: "number",
				default: 10.44,
				minimum: 0,
				maximum: 10000,
				sliderMaximum: 500,
			},
			widthEnd: {
				type: "number",
				default: 18,
				minimum: 0,
				maximum: 10000,
				sliderMaximum: 500,
			},
			headSize: { type: "number", default: 64, minimum: 12, maximum: 500 },
			tapered: { type: "boolean", default: true },
			dashed: { type: "boolean", default: false },
			split: { type: "boolean", default: false },
			splitLength: {
				type: "number",
				default: 92.8,
				minimum: 1,
				maximum: 10000,
				sliderMaximum: 1000,
			},
			splitSpread: {
				type: "number",
				default: 74.24,
				minimum: 0,
				maximum: 10000,
				sliderMaximum: 1000,
			},
			splitCount: { type: "number", default: 2, minimum: 2, maximum: 8 },
		},
		stylePresetId: "tactical-arrow",
		geometryRecipeId: "military-arrow",
		detail: { distant: 1, medium: 2, near: 3 },
	},
	{
		id: "kill-zone",
		name: "Зона поражения",
		family: "area",
		kind: "kill-zone",
		pointCountMinimum: 3,
		pointCountMaximum: 256,
		pointLabels: ["Граница"],
		parameters: {
			density: { type: "number", default: 0.5, minimum: 0, maximum: 2 },
			direction: { type: "number", default: 45, minimum: -360, maximum: 360 },
		},
		stylePresetId: "tactical-kill-zone",
		geometryRecipeId: "kill-zone",
		detail: { distant: 0, medium: 1, near: 3 },
	},
];

/**
 * Gets one tactical catalog item.
 *
 * @param kind - The stored tactical kind.
 * @returns The matching catalog item, or `undefined` when the kind is not supported.
 */
export function mapTacticalCatalogItem(kind: MapTacticalKind): MapTacticalCatalogItem | undefined {
	const kindCurrent =
		kind === "attack" || kind === "encirclement" || kind === "retreat" ? "arrow" : kind;
	return MAP_TACTICAL_CATALOG.find((item) => item.kind === kindCurrent);
}

/**
 * Checks and normalizes parameters for one tactical item.
 *
 * @param kind - The tactical kind that defines the permitted fields.
 * @param value - The parameter record from a config or an API request.
 * @returns A complete parameter record with catalog defaults.
 * @throws An error when a field is unknown or has an invalid value.
 */
export function parseMapTacticalParameters(
	kind: MapTacticalKind,
	value: Record<string, MapTacticalParameter>,
	military: MapMilitaryConfig = MAP_MILITARY_CONFIG_DEFAULT,
): Record<string, MapTacticalParameter> {
	const item = mapTacticalCatalogItem(kind);
	if (!item) throw new Error("Select a supported tactical graphic.");
	for (const key of Object.keys(value)) {
		if (!item.parameters[key]) throw new Error(`Remove the unknown tactical field: ${key}.`);
	}
	const result: Record<string, MapTacticalParameter> = {};
	for (const [key, sourceRule] of Object.entries(item.parameters)) {
		const rule =
			kind === "unit" && key === "role" && sourceRule.type === "enum"
				? { ...sourceRule, values: military.roles.map((entry) => entry.id) }
				: kind === "unit" && key === "echelon" && sourceRule.type === "enum"
					? { ...sourceRule, values: military.echelons.map((entry) => entry.id) }
					: sourceRule;
		const width = typeof value.width === "number" ? value.width : 18;
		const headSize = typeof value.headSize === "number" ? value.headSize : 64;
		const parameter =
			value[key] ??
			(key === "widthStart"
				? width * (value.tapered === false ? 1 : 0.58)
				: key === "widthEnd"
					? width
					: key === "splitLength"
						? headSize * 1.45
						: key === "splitSpread"
							? headSize * 1.16
							: rule.default);
		if (rule.type === "boolean" && typeof parameter !== "boolean") {
			throw new Error(`Use a Boolean value for ${key}.`);
		}
		if (
			rule.type === "enum" &&
			(typeof parameter !== "string" || !rule.values.includes(parameter))
		) {
			throw new Error(`Select a permitted value for ${key}.`);
		}
		if (
			rule.type === "number" &&
			(typeof parameter !== "number" ||
				!Number.isFinite(parameter) ||
				parameter < rule.minimum ||
				parameter > rule.maximum)
		) {
			throw new Error(
				`Use a number from ${rule.minimum} through ${rule.maximum} for ${key}.`,
			);
		}
		result[key] = parameter;
	}
	return result;
}
