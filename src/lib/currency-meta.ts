/** Currency display metadata (client-safe, no server imports). */
export const CURRENCY_NAMES: Record<string, string> = {
  PHP: "Philippine Peso",
  USD: "US Dollar",
  JPY: "Japanese Yen",
  EUR: "Euro",
  GBP: "British Pound",
  KRW: "South Korean Won",
  SGD: "Singapore Dollar",
  AUD: "Australian Dollar",
  CAD: "Canadian Dollar",
  THB: "Thai Baht",
  TWD: "Taiwan Dollar",
  HKD: "Hong Kong Dollar",
  CNY: "Chinese Yuan",
  INR: "Indian Rupee",
  CHF: "Swiss Franc",
  NZD: "New Zealand Dollar",
  VND: "Vietnamese Dong",
  IDR: "Indonesian Rupiah",
  MYR: "Malaysian Ringgit",
};

export function currencyLabel(code: string): string {
  return `${code} · ${CURRENCY_NAMES[code] ?? code}`;
}

export const KIND_LABEL: Record<string, string> = {
  PASSPORT_NOTE: "Passport note",
  FLIGHT: "Flight",
  HOTEL: "Hotel",
  RESTAURANT: "Restaurant",
  TOUR: "Tour",
  TICKET: "Ticket",
  INSURANCE: "Insurance",
  NOTE: "Note",
  OTHER: "Other",
};
