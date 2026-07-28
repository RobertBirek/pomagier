/** Field mappings: Pomagier feature → Subiekt GT column */
export interface FieldMapping {
  key: string; // e.g. "location"
  label: string; // e.g. "Lokalizacja towaru"
  subiektField: string; // e.g. "tw_Pole1"
  subiektTable: string; // e.g. "tw__Towar"
}

export const DEFAULT_MAPPINGS: FieldMapping[] = [
  {
    key: "location",
    label: "Lokalizacja towaru",
    subiektField: "tw_Pole1",
    subiektTable: "tw__Towar",
  },
];

/** Available Subiekt fields that can be mapped */
export const AVAILABLE_SUBIEKT_FIELDS = [
  { value: "tw_Pole1", label: "tw_Pole1 (varchar 50)" },
  { value: "tw_Pole2", label: "tw_Pole2 (varchar 50)" },
  { value: "tw_Pole3", label: "tw_Pole3 (varchar 50)" },
  { value: "tw_Pole4", label: "tw_Pole4 (varchar 50)" },
  { value: "tw_Pole5", label: "tw_Pole5 (varchar 50)" },
  { value: "tw_Pole6", label: "tw_Pole6 (varchar 50)" },
  { value: "tw_Pole7", label: "tw_Pole7 (varchar 50)" },
  { value: "tw_Pole8", label: "tw_Pole8 (varchar 50)" },
  { value: "tw_Opis", label: "tw_Opis (opis)" },
  { value: "tw_Uwagi", label: "tw_Uwagi (uwagi)" },
  { value: "tw_PodstKodKresk", label: "tw_PodstKodKresk (EAN)" },
];
