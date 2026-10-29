export const MAP_FONT_DEFAULT_ID = "book-antiqua";

export const MAP_FONTS = [
	{
		id: MAP_FONT_DEFAULT_ID,
		label: "Book Antiqua",
		family: "Book Antiqua",
		source: "static/fonts/BookAntiqua.ttf",
		sourceVector: "/assets/tools/map/fonts/book-antiqua.json",
	},
	{
		id: "nunito",
		label: "Nunito",
		family: "Nunito",
		source: "static/fonts/Nunito-Regular.ttf",
		sourceVector: "/assets/tools/map/fonts/nunito.json",
	},
	{
		id: "roboto-slab",
		label: "Roboto Slab",
		family: "Roboto Slab",
		source: "static/fonts/RobotoSlab-Regular.ttf",
		sourceVector: "/assets/tools/map/fonts/roboto-slab.json",
	},
] as const;

export type MapFontId = (typeof MAP_FONTS)[number]["id"];
