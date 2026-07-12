// lib/db/item-types.ts
// Canonical catalog of the 18 Driver Qualification File (DQF) items tracked by RigFile.
// IMPORTANT: `key` values MUST exactly match the codes seeded into the
// rigfile_dqf_item_types table in schema.sql (initial_mvr, road_test_certificate,
// prev_employer_drug_alcohol, eldt_certificate, etc.). Keep the two in sync.
// Self-contained (no imports) so it is safe to use from server routes, lib/db modules,
// and client components alike.

export type ItemTypeCategory =
  | 'qualification'
  | 'medical'
  | 'driving_record'
  | 'drug_alcohol'
  | 'training';

export interface DqfItemType {
  /** Stable machine key (matches dqf_items.item_type in the database). */
  key: string;
  /** Alias of `key` for callers that expect an `id` field. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Alias of `name` for callers that expect a `label` field. */
  label: string;
  description: string;
  /** Governing FMCSA regulation. */
  cfr: string;
  category: ItemTypeCategory;
  /** Whether this document expires and must be renewed. */
  expires: boolean;
  /** Default renewal interval in months (null for one-time documents). */
  default_interval_months: number | null;
  /** camelCase alias of default_interval_months. */
  defaultIntervalMonths: number | null;
  /** Required for every driver vs. conditional (endorsement/variance specific). */
  required: boolean;
  sort_order: number;
  sortOrder: number;
}

/** Convenience alias for callers importing `ItemType`. */
export type ItemType = DqfItemType;

interface Seed {
  key: string;
  name: string;
  description: string;
  cfr: string;
  category: ItemTypeCategory;
  expires: boolean;
  intervalMonths: number | null;
  required: boolean;
}

const SEEDS: Seed[] = [
  {
    key: 'employment_application',
    name: 'Driver Employment Application',
    description: 'Completed and signed application for employment, retained for the duration of employment plus 3 years.',
    cfr: '49 CFR 391.21',
    category: 'qualification',
    expires: false,
    intervalMonths: null,
    required: true,
  },
  {
    key: 'cdl_copy',
    name: 'CDL / Driver License Copy',
    description: 'Legible copy of the current commercial driver license, tracked to the license expiration date.',
    cfr: '49 CFR 383.23',
    category: 'qualification',
    expires: true,
    intervalMonths: 48,
    required: true,
  },
  {
    key: 'medical_certificate',
    name: "Medical Examiner's Certificate (DOT Physical)",
    description: 'Current medical certificate; valid for a maximum of 24 months (may be shorter if restricted).',
    cfr: '49 CFR 391.43',
    category: 'medical',
    expires: true,
    intervalMonths: 24,
    required: true,
  },
  {
    key: 'medical_examiner_verification',
    name: 'National Registry Examiner Verification',
    description: 'Verification that the medical examiner was listed on the FMCSA National Registry when the exam was performed.',
    cfr: '49 CFR 391.51(b)(9)',
    category: 'medical',
    expires: true,
    intervalMonths: 24,
    required: true,
  },
  {
    key: 'initial_mvr',
    name: 'Initial Motor Vehicle Record (MVR)',
    description: 'MVR from every state where the driver held a license in the preceding 3 years, obtained at hire.',
    cfr: '49 CFR 391.23(a)(1)',
    category: 'driving_record',
    expires: false,
    intervalMonths: null,
    required: true,
  },
  {
    key: 'mvr_annual',
    name: 'Annual Motor Vehicle Record (MVR)',
    description: 'MVR pulled at least once every 12 months for each state where the driver holds a license.',
    cfr: '49 CFR 391.25(a)',
    category: 'driving_record',
    expires: true,
    intervalMonths: 12,
    required: true,
  },
  {
    key: 'annual_review',
    name: 'Annual Review of Driving Record',
    description: 'Signed certification that the driving record was reviewed and the driver meets minimum requirements.',
    cfr: '49 CFR 391.25(c)(2)',
    category: 'driving_record',
    expires: true,
    intervalMonths: 12,
    required: true,
  },
  {
    key: 'certificate_of_violations',
    name: 'Annual Certificate of Violations',
    description: "Driver's annual list of traffic violations (or certification of none) covering the prior 12 months.",
    cfr: '49 CFR 391.27',
    category: 'driving_record',
    expires: true,
    intervalMonths: 12,
    required: true,
  },
  {
    key: 'road_test_certificate',
    name: 'Road Test Certificate',
    description: 'Road test certificate or accepted equivalent (valid CDL or prior certificate), kept on file.',
    cfr: '49 CFR 391.31 / 391.33',
    category: 'qualification',
    expires: false,
    intervalMonths: null,
    required: true,
  },
  {
    key: 'prev_employer_drug_alcohol',
    name: 'Previous Employer Drug & Alcohol History',
    description: 'Previous-employer safety performance history and drug & alcohol testing records covering the prior 3 years.',
    cfr: '49 CFR 391.23(d)-(e) / 40.25',
    category: 'drug_alcohol',
    expires: false,
    intervalMonths: null,
    required: true,
  },
  {
    key: 'clearinghouse_pre_employment',
    name: 'Clearinghouse Pre-Employment Query',
    description: 'Full Drug & Alcohol Clearinghouse query completed before the driver performs safety-sensitive functions.',
    cfr: '49 CFR 382.701(a)',
    category: 'drug_alcohol',
    expires: false,
    intervalMonths: null,
    required: true,
  },
  {
    key: 'clearinghouse_annual',
    name: 'Annual Clearinghouse Limited Query',
    description: 'Limited Clearinghouse query run at least once every 12 months for each driver.',
    cfr: '49 CFR 382.701(b)',
    category: 'drug_alcohol',
    expires: true,
    intervalMonths: 12,
    required: true,
  },
  {
    key: 'pre_employment_drug_test',
    name: 'Pre-Employment Drug Test Result',
    description: 'Negative pre-employment controlled substances test result received before first dispatch.',
    cfr: '49 CFR 382.301',
    category: 'drug_alcohol',
    expires: false,
    intervalMonths: null,
    required: true,
  },
  {
    key: 'drug_alcohol_policy',
    name: 'Drug & Alcohol Policy Receipt',
    description: 'Signed receipt for the drug and alcohol policy and required educational materials.',
    cfr: '49 CFR 382.601',
    category: 'drug_alcohol',
    expires: false,
    intervalMonths: null,
    required: true,
  },
  {
    key: 'hazmat_training',
    name: 'HazMat Endorsement & Training',
    description: 'Hazardous materials endorsement plus recurrent training certificate, renewed every 3 years (if applicable).',
    cfr: '49 CFR 383.93 / 172.704',
    category: 'training',
    expires: true,
    intervalMonths: 36,
    required: false,
  },
  {
    key: 'eldt_certificate',
    name: 'Entry-Level Driver Training (ELDT) Certificate',
    description: 'ELDT completion recorded in the Training Provider Registry for drivers first licensed after Feb 7, 2022 (if applicable).',
    cfr: '49 CFR 380.609',
    category: 'training',
    expires: false,
    intervalMonths: null,
    required: false,
  },
  {
    key: 'spe_certificate',
    name: 'Skill Performance Evaluation (SPE) Certificate',
    description: 'SPE certificate for drivers with certain limb impairments; renewed every 2 years (if applicable).',
    cfr: '49 CFR 391.49',
    category: 'medical',
    expires: true,
    intervalMonths: 24,
    required: false,
  },
  {
    key: 'medical_variance',
    name: 'Medical Variance / Exemption',
    description: 'Vision, hearing, diabetes, or other FMCSA exemption documentation with its own expiration (if applicable).',
    cfr: '49 CFR 391.62 / 391.64',
    category: 'medical',
    expires: true,
    intervalMonths: 12,
    required: false,
  },
];

/** The full ordered catalog of DQF item types (18 items). */
export const DQF_ITEM_TYPES: DqfItemType[] = SEEDS.map((s, i) => ({
  key: s.key,
  id: s.key,
  name: s.name,
  label: s.name,
  description: s.description,
  cfr: s.cfr,
  category: s.category,
  expires: s.expires,
  default_interval_months: s.intervalMonths,
  defaultIntervalMonths: s.intervalMonths,
  required: s.required,
  sort_order: i + 1,
  sortOrder: i + 1,
}));

/** Aliases so any existing import style resolves. */
export const ITEM_TYPES: DqfItemType[] = DQF_ITEM_TYPES;
export const itemTypes: DqfItemType[] = DQF_ITEM_TYPES;

export const ITEM_TYPE_KEYS: string[] = DQF_ITEM_TYPES.map((t) => t.key);

export const ITEM_TYPES_BY_KEY: Record<string, DqfItemType> = DQF_ITEM_TYPES.reduce(
  (acc, t) => {
    acc[t.key] = t;
    return acc;
  },
  {} as Record<string, DqfItemType>,
);

/** Total number of tracked DQF items (18). */
export const TOTAL_DQF_ITEMS: number = DQF_ITEM_TYPES.length;

export function listItemTypes(): DqfItemType[] {
  return DQF_ITEM_TYPES;
}

export function getItemTypes(): DqfItemType[] {
  return DQF_ITEM_TYPES;
}

export function getItemType(key: string): DqfItemType | undefined {
  return ITEM_TYPES_BY_KEY[key];
}

export function isValidItemType(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(ITEM_TYPES_BY_KEY, key);
}

export function getDefaultIntervalMonths(key: string): number | null {
  const t = ITEM_TYPES_BY_KEY[key];
  return t ? t.default_interval_months : null;
}

export default DQF_ITEM_TYPES;
