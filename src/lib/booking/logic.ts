import { NIGHTS_MAX, NIGHTS_MIN } from "$lib/content";
import type {
	Booking,
	BookingDraft,
	BookingErrors,
	Lodging,
	LodgingFilters
} from "$lib/booking/types";

/**
 * Russian plural form for the in-world currency.
 *
 * @param value - A non-negative integer amount.
 * @returns The matching word for "crown".
 */
export function crownsWord(value: number): string {
	const absolute = Math.abs(Math.trunc(value));
	const lastTwo = absolute % 100;
	const last = absolute % 10;
	if (lastTwo >= 11 && lastTwo <= 14) return "крон";
	if (last === 1) return "корона";
	if (last >= 2 && last <= 4) return "короны";
	return "крон";
}

/**
 * Formats an amount with the in-world currency.
 *
 * @param value - A non-negative integer amount.
 * @returns A string such as "14 крон".
 */
export function formatCrowns(value: number): string {
	return `${Math.max(0, Math.trunc(value)).toLocaleString("ru-RU")} ${crownsWord(value)}`;
}

/**
 * Russian plural form for a number of nights.
 *
 * @param value - A non-negative integer amount.
 * @returns The matching word for "night".
 */
export function nightsWord(value: number): string {
	const absolute = Math.abs(Math.trunc(value));
	const lastTwo = absolute % 100;
	const last = absolute % 10;
	if (lastTwo >= 11 && lastTwo <= 14) return "ночей";
	if (last === 1) return "ночь";
	if (last >= 2 && last <= 4) return "ночи";
	return "ночей";
}

/**
 * Tests whether a lodging is unavailable.
 *
 * @param lodging - The lodging to test.
 * @param bookings - The active browser bookings.
 * @returns `true` when the lodging is seeded as occupied or has an active booking.
 */
export function isOccupied(lodging: Lodging, bookings: Booking[]): boolean {
	return Boolean(lodging.initiallyOccupied) || bookings.some((booking) => booking.lodgingId === lodging.id);
}

/**
 * Returns the booking that occupies a lodging.
 *
 * @param lodgingId - The stable lodging identifier.
 * @param bookings - The active browser bookings.
 * @returns The active booking or `null`.
 */
export function bookingFor(lodgingId: string, bookings: Booking[]): Booking | null {
	return bookings.find((booking) => booking.lodgingId === lodgingId) ?? null;
}

/**
 * Applies the two interface filters to the shared lodging data.
 *
 * @param lodgings - The source lodgings.
 * @param filters - The guest count and the maximum nightly price.
 * @returns Lodgings that satisfy both filters, in source order.
 */
export function filterLodgings(lodgings: Lodging[], filters: LodgingFilters): Lodging[] {
	return lodgings.filter(
		(lodging) =>
			lodging.capacity >= filters.guests && lodging.pricePerNight <= filters.maxPrice
	);
}

/**
 * Validates the booking form against one lodging.
 *
 * @param draft - The parsed form values.
 * @param lodging - The selected lodging.
 * @returns Field-level error messages. An empty object means the draft is valid.
 */
export function validateDraft(draft: BookingDraft, lodging: Lodging): BookingErrors {
	const errors: BookingErrors = {};
	if (!Number.isInteger(draft.guests) || draft.guests < 1) {
		errors.guests = "Укажите целое число гостей — не меньше 1.";
	} else if (draft.guests > lodging.capacity) {
		errors.guests = `Для этого места максимум ${lodging.capacity} гостей.`;
	}

	if (!Number.isInteger(draft.nights) || draft.nights < NIGHTS_MIN) {
		errors.nights = `Укажите целое число ночей — от ${NIGHTS_MIN} до ${NIGHTS_MAX}.`;
	} else if (draft.nights > NIGHTS_MAX) {
		errors.nights = `Максимум — ${NIGHTS_MAX} ночей.`;
	}

	return errors;
}

/**
 * Returns a short unique-looking booking number.
 *
 * @param now - The current timestamp in milliseconds.
 * @returns A display number such as "NH-7K3Q2".
 */
export function bookingNumber(now = Date.now()): string {
	const stamp = now.toString(36).toUpperCase().slice(-4);
	const suffix = Math.floor(Math.random() * 36 ** 2)
		.toString(36)
		.toUpperCase()
		.padStart(2, "0");
	return `NH-${stamp}${suffix}`;
}

/**
 * Parses a numeric input without accepting fractional values.
 *
 * @param value - The raw input value.
 * @returns The integer, or `NaN` when the input is empty or broken.
 */
export function parseInteger(value: number | string | undefined): number {
	if (value === undefined || value === "") return Number.NaN;
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isInteger(parsed) ? parsed : Number.NaN;
}

/**
 * Formats a booking creation date for the "Мои брони" list.
 *
 * @param value - An ISO date string.
 * @returns A short Russian date.
 */
export function formatBookingDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "дата неизвестна";
	return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}
