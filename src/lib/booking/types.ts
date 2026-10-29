export type LodgingKind = "inn" | "cabin" | "tower" | "camp";

export type Lodging = {
	id: string;
	name: string;
	kind: LodgingKind;
	region: string;
	description: string;
	capacity: number;
	pricePerNight: number;
	x: number;
	y: number;
	amenities: string[];
	initiallyOccupied?: boolean;
};

export type Booking = {
	id: string;
	number: string;
	lodgingId: string;
	lodgingName: string;
	guests: number;
	nights: number;
	total: number;
	createdAt: string;
};

export type LodgingFilters = {
	guests: number;
	maxPrice: number;
};

export type BookingDraft = {
	guests: number;
	nights: number;
};

export type BookingErrors = {
	guests?: string;
	nights?: string;
	form?: string;
};
