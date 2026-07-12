// This module previously exported an unused `getDqfItemContext` helper that
// duplicated the item/profile lookups the dqf-items routes already perform
// via lib/db/dqf-items.ts and lib/db/profiles.ts. It was never imported
// anywhere, so the dead code was removed (QA-026 / QA-029) rather than left
// to drift from the real rigfile_dqf_items / rigfile_profiles access paths.
// The empty export keeps this a valid TypeScript module until the file is
// deleted outright.
export {};
