import type { Booking } from "$lib/booking/types";

export const STORAGE_KEY = "flatria-lodging-v1";

export type LoadBookingsResult = {
	bookings: Booking[];
	error: string | null;
};

/**
 * Validates one untrusted booking record.
 *
 * @param value - A value parsed from localStorage.
 * @returns A safe booking or `null`.
 */
function parseBooking(value: unknown): Booking | null {
	if (!value || typeof value !== "object") return null;
	const candidate = value as Record<string, unknown>;
	const strings = ["id", "number", "lodgingId", "lodgingName", "createdAt"] as const;
	const numbers = ["guests", "nights", "total"] as const;
	if (
		strings.some((key) => typeof candidate[key] !== "string" || !candidate[key]) ||
		numbers.some(
			(key) => typeof candidate[key] !== "number" || !Number.isFinite(candidate[key])
		)
	)
		return null;
	if (
		(candidate.guests as number) < 1 ||
		(candidate.nights as number) < 1 ||
		(candidate.total as number) < 0
	)
		return null;
	return {
		id: candidate.id as string,
		number: candidate.number as string,
		lodgingId: candidate.lodgingId as string,
		lodgingName: candidate.lodgingName as string,
		guests: Math.trunc(candidate.guests as number),
		nights: Math.trunc(candidate.nights as number),
		total: Math.trunc(candidate.total as number),
		createdAt: candidate.createdAt as string
	};
}

/**
 * Reads bookings from the application's own localStorage key.
 *
 * @returns The valid bookings and an optional human-readable warning.
 * @sideEffects Reads localStorage. Does not throw when storage is unavailable.
 */
export function loadBookings(): LoadBookingsResult {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { bookings: [], error: null };
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { bookings?: unknown }).bookings)) {
			return {
				bookings: [],
				error:
					"Сохранённые брони имеют незнакомый формат. Показаны пустые данные — можно продолжить работу."
			};
		}
		const source = (parsed as { bookings: unknown[] }).bookings;
		const bookings = source.map(parseBooking).filter((booking): booking is Booking => Boolean(booking));
		return {
			bookings,
			error:
				bookings.length !== source.length
					? "Часть сохранённых броней повреждена и была пропущена. Остальные записи сохранены."
					: null
		};
	} catch {
		return {
			bookings: [],
			error:
				"Не удалось прочитать сохранённые брони. Возможно, браузер запретил localStorage. Приложение продолжит работать без сохранения."
		};
	}
}

/**
 * Writes bookings to the application's own localStorage key.
 *
 * @param bookings - The active bookings.
 * @returns A human-readable warning, or `null` after a successful write.
 * @sideEffects Writes localStorage. Does not clear other keys.
 */
export function saveBookings(bookings: Booking[]): string | null {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, bookings }));
		return null;
	} catch {
		return "Браузер не разрешил сохранить бронь. Запись останется в памяти до обновления страницы.";
	}
}

/**
 * Removes only this application's key.
 *
 * @returns A human-readable warning, or `null` after a successful removal.
 * @sideEffects Removes the application key from localStorage.
 */
export function clearBookings(): string | null {
	try {
		localStorage.removeItem(STORAGE_KEY);
		return null;
	} catch {
		return "Не удалось очистить localStorage. Брони останутся в памяти до обновления страницы.";
	}
}
