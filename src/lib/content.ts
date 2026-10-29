import type { MapPoint } from "$lib/map/types";
import type { Lodging, LodgingKind } from "$lib/booking/types";

export const MAP_IMAGE = {
	src: "/assets/map/flatria-region.webp",
	width: 2100,
	height: 1600,
	alt: "Пергаментная карта Доминиона Флатрия: Мерцающий лес, Кратер Ситтаса, Севеж и южные пустоши"
} as const;

/**
 * The "Доминион Флатрия" region from the source map configuration.
 *
 * Coordinates are converted into the cropped map image:
 * source crop origin (1050, 1300), image size 2100 × 1600.
 */
export const FLATRIA_REGION_ID = "flatria-region";

export const FLATRIA_REGION = {
	id: FLATRIA_REGION_ID,
	name: "Доминион Флатрия",
	points: [
		{ x: 553.61, y: 402.46 },
		{ x: 515.23, y: 437.19 },
		{ x: 522.54, y: 460.94 },
		{ x: 478.68, y: 484.7 },
		{ x: 473.19, y: 523.08 },
		{ x: 306.89, y: 587.04 },
		{ x: 283.13, y: 629.08 },
		{ x: 301.4, y: 663.8 },
		{ x: 334.3, y: 716.8 },
		{ x: 367.2, y: 773.46 },
		{ x: 440.3, y: 786.25 },
		{ x: 507.92, y: 784.42 },
		{ x: 593.81, y: 804.52 },
		{ x: 655.95, y: 820.97 },
		{ x: 727.22, y: 831.94 },
		{ x: 774.74, y: 850.21 },
		{ x: 774.74, y: 894.07 },
		{ x: 820.43, y: 921.49 },
		{ x: 851.5, y: 954.38 },
		{ x: 897.81, y: 947.43 },
		{ x: 941.05, y: 958.04 },
		{ x: 956.52, y: 981.15 },
		{ x: 1040.23, y: 946.27 },
		{ x: 1107.66, y: 935.23 },
		{ x: 1240.86, y: 933.93 },
		{ x: 1303.76, y: 954.9 },
		{ x: 1333.45, y: 923.52 },
		{ x: 1332.15, y: 839.25 },
		{ x: 1350.37, y: 757.98 },
		{ x: 1234.62, y: 677.38 },
		{ x: 1110.69, y: 697.5 },
		{ x: 1010.07, y: 624.42 },
		{ x: 931.86, y: 620.91 },
		{ x: 897.52, y: 499.99 },
		{ x: 876.03, y: 394.12 },
		{ x: 833.52, y: 347.07 },
		{ x: 844.67, y: 296.37 },
		{ x: 882.9, y: 253.27 },
		{ x: 835.39, y: 216.72 },
		{ x: 767.77, y: 209.41 },
		{ x: 694.66, y: 249.61 },
		{ x: 667.25, y: 284.34 },
		{ x: 612.42, y: 337.33 },
		{ x: 583.18, y: 379.37 }
	] satisfies MapPoint[]
};

/** Padded bounds of the "Доминион Флатрия" region in the cropped image. */
export const FLATRIA_BOUNDS = {
	minX: 219.1,
	minY: 145.38,
	maxX: 1414.4,
	maxY: 1045.18
};

export const DEMO_NOTE =
	"бронирования сохраняются только в этом браузере. Реальная бронь не оформляется.";

export const KIND_META: Record<
	LodgingKind,
	{ label: string; short: string; plural: string }
> = {
	inn: { label: "Постоялый двор", short: "Двор", plural: "двора" },
	cabin: { label: "Охотничий домик", short: "Домик", plural: "домика" },
	tower: { label: "Башня", short: "Башня", plural: "башни" },
	camp: { label: "Лагерь", short: "Лагерь", plural: "лагеря" }
};

export const LODGINGS: Lodging[] = [
	{
		id: "flatrih",
		name: "Флатрихский двор",
		kind: "inn",
		region: "Флатрих",
		description:
			"Столичный двор у восточных ворот: общий зал, конюшня и комнаты под черепичной крышей. Отсюда удобно начинать путь по Доминиону.",
		capacity: 6,
		pricePerNight: 14,
		x: 843,
		y: 762,
		amenities: ["Конюшня", "Общий зал", "Завтрак"],
		initiallyOccupied: true
	},
	{
		id: "sevezh",
		name: "Севежский приют",
		kind: "inn",
		region: "Севеж",
		description:
			"Приют на торговой улице Севежа. Низкие потолки, купеческие разговоры и кухня, которая не закрывается до полуночи.",
		capacity: 8,
		pricePerNight: 18,
		x: 1226,
		y: 744,
		amenities: ["Кухня", "Склад", "Баня"]
	},
	{
		id: "osber",
		name: "Осберская застава",
		kind: "tower",
		region: "Западная граница",
		description:
			"Сторожевая башня на западном тракте. Две комнаты, очаг и вид на старые шахты Осбера.",
		capacity: 2,
		pricePerNight: 9,
		x: 500,
		y: 500,
		amenities: ["Смотровая", "Очаг"]
	},
	{
		id: "korkaft",
		name: "Коркафтская башня",
		kind: "tower",
		region: "Северная граница",
		description:
			"Башня на северном рубеже Доминиона. Каменная кладка, узкие окна и ветер с Серного моря.",
		capacity: 3,
		pricePerNight: 22,
		x: 800,
		y: 320,
		amenities: ["Смотровая", "Библиотека", "Вино"]
	},
	{
		id: "severny",
		name: "Северный тракт",
		kind: "inn",
		region: "Северный тракт",
		description:
			"Постоялый двор на перекрёстке северных дорог. Здесь останавливаются гонцы, торговцы и те, кто идёт к краю карты.",
		capacity: 6,
		pricePerNight: 16,
		x: 750,
		y: 600,
		amenities: ["Конюшня", "Кухня", "Сеть"]
	},
	{
		id: "lesnoy",
		name: "Лесной кров",
		kind: "cabin",
		region: "Мерцающий лес",
		description:
			"Охотничий домик на опушке. Тёмное дерево, светящиеся мхи за окном и печь, которая держит тепло до утра.",
		capacity: 4,
		pricePerNight: 11,
		x: 550,
		y: 700,
		amenities: ["Очаг", "Кухня", "Тишина"]
	},
	{
		id: "zapadny",
		name: "Западный лагерь",
		kind: "camp",
		region: "Западные холмы",
		description:
			"Палаточный лагерь у старой дороги. Навес, костровище и место для лошадей — без лишних удобств, зато дёшево.",
		capacity: 10,
		pricePerNight: 8,
		x: 400,
		y: 750,
		amenities: ["Костровище", "Навес", "Лошади"]
	},
	{
		id: "yuzhny",
		name: "Южный лагерь",
		kind: "camp",
		region: "Южные пустоши",
		description:
			"Стоянка на южном тракте, у самой границы Доминиона. Ветреные ночи, крепкий чай и вид на солончаки.",
		capacity: 12,
		pricePerNight: 10,
		x: 850,
		y: 950,
		amenities: ["Костровище", "Шатры", "Припасы"]
	},
	{
		id: "vostochnaya",
		name: "Восточная башня",
		kind: "tower",
		region: "Восточная граница",
		description:
			"Башня над речной развилкой. Круглый зал, библиотека и лестница к смотровой площадке — самое тихое место на востоке.",
		capacity: 3,
		pricePerNight: 20,
		x: 1000,
		y: 800,
		amenities: ["Библиотека", "Смотровая", "Очаг"]
	},
	{
		id: "pogranichny",
		name: "Пограничный лагерь",
		kind: "camp",
		region: "Восточная граница",
		description:
			"Лагерь у переправы: деревянные настилы, парусиновые шатры и переправа к большой земле. Здесь заканчивается Доминион.",
		capacity: 8,
		pricePerNight: 12,
		x: 1300,
		y: 850,
		amenities: ["Причал", "Шатры", "Костровище"],
		initiallyOccupied: true
	}
];

export const FILTER_MIN_GUESTS = 1;
export const FILTER_MAX_GUESTS = 12;
export const FILTER_MIN_PRICE = 8;
export const FILTER_MAX_PRICE = 24;
export const NIGHTS_MIN = 1;
export const NIGHTS_MAX = 30;
