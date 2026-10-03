// Site-wide settings.
/** Business contact address shown on the pricing and legal pages. Leave empty until there is a dedicated address. */
export const CONTACT_EMAIL = "";

/**
 * The legal entity behind Warmtewijs AI. The terms and privacy pages show a "draft" banner
 * until name, KvK number, address and CONTACT_EMAIL are all filled in.
 */
export const COMPANY = {
  name: "", // e.g. "Warmtewijs B.V." or your eenmanszaak's trade name
  kvk: "", // KvK number
  address: "", // street, postcode, city
};

export const LEGAL_UPDATED = "2026-10-04";

export const legalComplete = () => Boolean(COMPANY.name && COMPANY.kvk && COMPANY.address && CONTACT_EMAIL);
