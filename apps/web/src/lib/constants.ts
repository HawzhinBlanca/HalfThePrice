export const IRAQI_GOVERNORATES = [
  "Baghdad",
  "Basra",
  "Erbil",
  "Najaf",
  "Karbala",
  "Mosul",
  "Kirkuk",
  "Duhok",
  "Sulaymaniyah",
  "Anbar",
  "Babil",
  "Dhi Qar",
  "Diyala",
  "Maysan",
  "Muthanna",
  "Qadisiyyah",
  "Saladin",
  "Wasit",
] as const;

export type IraqiGovernorate = (typeof IRAQI_GOVERNORATES)[number];

export const RETAIL_SOURCES = [
  "Elryan",
  "Miswag",
  "Alhafidh",
  "ElectroMall",
  "iCenter Iraq",
] as const;

export const LISTING_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "savings", label: "Biggest savings" },
] as const;

export type ListingSort = (typeof LISTING_SORT_OPTIONS)[number]["value"];

export const CSRF_COOKIE = "htp_csrf";
export const CSRF_HEADER = "x-csrf-token";
