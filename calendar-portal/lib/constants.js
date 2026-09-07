export const CATEGORIES = [
  "Marketing Activities",
  "Content Planning",
  "ATL Activities",
  "BTL Activities",
  "Brand & Corporate Communication",
  "Business Development",
  "GTM & Commercialization",
  "Strategic Partnerships",
  "Market & Consumer Intelligence",
  "Growth & Expansion Activities",
];

export const SBUS = [
  { code: "ACCL", name: "Akij Cement Company Ltd.", group: "Building Material" },
  { code: "AIL", name: "Akij Ispat Ltd.", group: "Building Material" },
  { code: "APFIL", name: "Akij Poly Fibre Industries Ltd.", group: "Packaging" },
  { code: "ALCL", name: "Akij LifeCare Ltd. (Pharmacy)", group: "Healthcare" },
  { code: "AMPL", name: "Akij Mediplex Ltd.", group: "Healthcare" },
  { code: "AMQL", name: "Akij Mediquip Ltd.", group: "Healthcare" },
  { code: "ALML", name: "Akij Landmark Ltd.", group: "Real Estate" },
  { code: "AEL", name: "Akij Essentials Ltd. (Export)", group: "FMCG / Export" },
  { code: "ASLL", name: "Akij Shipping Line Ltd.", group: "Logistics" },
  { code: "CORPORATE", name: "Corporate (Governance)", group: "Cross-SBU" },
];

export const STATUSES = ["Planned", "In Progress", "Completed", "On Hold", "Cancelled"];

export const STATUS_COLORS = {
  "Planned": "#2f81f7",
  "In Progress": "#f5a623",
  "Completed": "#2ecc71",
  "On Hold": "#ff5c5c",
  "Cancelled": "#8a93a8",
};

export const CATEGORY_COLORS = [
  "#2f81f7", "#7a5cff", "#ff5ca8", "#2ecc71", "#f5a623",
  "#ff7a3d", "#2fd5e8", "#e8b53a", "#7ad24a", "#ff5c5c",
];

export function sbuName(code) {
  const s = SBUS.find((x) => x.code === code);
  return s ? `${s.code} — ${s.name}` : code;
}

export function fmtCr(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const v = Number(n);
  if (v === 0) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 }) + " Cr";
}
