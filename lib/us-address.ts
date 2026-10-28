const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  PR: "Puerto Rico",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  VI: "Virgin Islands",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  GU: "Guam",
  AA: "Armed Forces Americas",
  AE: "Armed Forces Europe",
  AP: "Armed Forces Pacific",
};

/** Inclusive 3-digit ZIP prefixes. A few prefixes are handled before this list. */
const ZIP_RANGES: [number, number, string][] = [
  [5, 5, "NY"],
  [6, 7, "PR"],
  [8, 8, "VI"],
  [9, 9, "PR"],
  [10, 27, "MA"],
  [28, 29, "RI"],
  [30, 38, "NH"],
  [39, 49, "ME"],
  [50, 54, "VT"],
  [55, 55, "MA"],
  [56, 59, "VT"],
  [60, 69, "CT"],
  [70, 89, "NJ"],
  [90, 98, "AE"],
  [100, 149, "NY"],
  [150, 196, "PA"],
  [197, 199, "DE"],
  [200, 205, "DC"],
  [206, 219, "MD"],
  [220, 246, "VA"],
  [247, 268, "WV"],
  [270, 289, "NC"],
  [290, 299, "SC"],
  [300, 319, "GA"],
  [320, 339, "FL"],
  [340, 340, "AA"],
  [341, 349, "FL"],
  [350, 369, "AL"],
  [370, 385, "TN"],
  [386, 397, "MS"],
  [398, 399, "GA"],
  [400, 427, "KY"],
  [430, 459, "OH"],
  [460, 479, "IN"],
  [480, 499, "MI"],
  [500, 528, "IA"],
  [530, 549, "WI"],
  [550, 567, "MN"],
  [570, 577, "SD"],
  [580, 588, "ND"],
  [590, 599, "MT"],
  [600, 629, "IL"],
  [630, 658, "MO"],
  [660, 679, "KS"],
  [680, 693, "NE"],
  [700, 714, "LA"],
  [716, 729, "AR"],
  [730, 749, "OK"],
  [750, 799, "TX"],
  [800, 816, "CO"],
  [820, 831, "WY"],
  [832, 838, "ID"],
  [840, 847, "UT"],
  [850, 865, "AZ"],
  [870, 884, "NM"],
  [885, 885, "TX"],
  [889, 898, "NV"],
  [900, 961, "CA"],
  [962, 966, "AP"],
  [967, 968, "HI"],
  [969, 969, "GU"],
  [970, 979, "OR"],
  [980, 994, "WA"],
  [995, 999, "AK"],
];

export function stateCode(value: string): string | null {
  const trimmed = value.trim().replace(/\./g, "");
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const code = trimmed.toUpperCase();
    return STATE_NAMES[code] ? code : null;
  }
  const lower = trimmed.toLowerCase();
  for (const [code, name] of Object.entries(STATE_NAMES)) {
    if (name.toLowerCase() === lower) return code;
  }
  return null;
}

export function stateName(code: string): string {
  return STATE_NAMES[code.trim().toUpperCase()] || "";
}

export function stateFromZip(value: string): string | null {
  const zip = value.trim().match(/^(\d{5})(?:-\d{4})?$/)?.[1];
  if (!zip || zip === "00000") return null;
  const prefix = Number(zip.slice(0, 3));
  if (prefix === 733) return "TX";
  for (const [start, end, code] of ZIP_RANGES) {
    if (prefix >= start && prefix <= end) return code;
  }
  return null;
}

/** A state written in an address line, such as "Austin, TX" or "Austin, Texas". */
export function stateFromText(value: string): string | null {
  const text = value.toLowerCase().replace(/\./g, " ").replace(/\s+/g, " ");
  const names = Object.entries(STATE_NAMES).sort((a, b) => b[1].length - a[1].length);
  for (const [code, name] of names) {
    const pattern = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    if (new RegExp(`\\b${pattern}\\b`).test(text)) return code;
  }
  const tokens = text.match(/\b[a-z]{2}\b/g) || [];
  for (const token of tokens) {
    const code = stateCode(token);
    if (code) return code;
  }
  return null;
}

export function isUsPostal(value: string): boolean {
  return /^\d{5}(?:-\d{4})?$/.test(value.trim()) && stateFromZip(value) != null;
}
