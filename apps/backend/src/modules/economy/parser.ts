import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { ECONOMY_XML_MAX_BYTES } from "../../shared/env.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  suppressEmptyNode: true,
});

export type DayzTypeItem = {
  name: string;
  nominal: number;
  lifetime: number;
  restock: number;
  min: number;
  quantmin: number;
  quantmax: number;
  cost: number;
  flags: {
    countInCargo: boolean;
    countInHoarder: boolean;
    countInMap: boolean;
    countInPlayer: boolean;
    crafted: boolean;
    deloot: boolean;
  };
  category?: string;
  usage: string[];
  value: string[];
};

export type DayzEventItem = {
  name: string;
  nominal: number;
  min: number;
  max: number;
  lifetime: number;
  restock: number;
  saferadius: number;
  distanceradius: number;
  cleanupradius: number;
  active: boolean;
  children: string[];
};

export type DayzGlobalItem = {
  name: string;
  type: string;
  value: string;
};

export type DayzSpawnableSummary = {
  name: string;
  cargoPresets: number;
  attachmentPresets: number;
  attachments: number;
  cargoItems: number;
};

export type EconomyValidationSeverity = "error" | "warning";

export type EconomyValidationIssue = {
  severity: EconomyValidationSeverity;
  code: string;
  message: string;
  item?: string;
  file?: string;
};

export type EconomyValidationSummary = {
  errorCount: number;
  warningCount: number;
  grouped: Array<{
    code: string;
    severity: EconomyValidationSeverity;
    count: number;
    examples: string[];
    message: string;
  }>;
};

function addIssue(
  issues: EconomyValidationIssue[],
  severity: EconomyValidationSeverity,
  code: string,
  message: string,
  item?: string,
) {
  issues.push({ severity, code, message, item });
}

function summarizeIssues(
  issues: EconomyValidationIssue[],
): EconomyValidationSummary {
  const grouped = new Map<
    string,
    {
      code: string;
      severity: EconomyValidationSeverity;
      count: number;
      examples: string[];
      message: string;
    }
  >();
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.code}:${issue.message}`;
    const current = grouped.get(key) ?? {
      code: issue.code,
      severity: issue.severity,
      count: 0,
      examples: [],
      message: issue.message,
    };
    current.count += 1;
    if (issue.item && current.examples.length < 12)
      current.examples.push(issue.item);
    grouped.set(key, current);
  }
  return {
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    grouped: [...grouped.values()].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
      return b.count - a.count;
    }),
  };
}

function buildValidationResult(
  issues: EconomyValidationIssue[],
  count: number,
) {
  const errors = issues
    .filter((issue) => issue.severity === "error")
    .map((issue) =>
      issue.item ? `${issue.item}: ${issue.message}` : issue.message,
    );
  const warnings = issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) =>
      issue.item ? `${issue.item}: ${issue.message}` : issue.message,
    );
  const summary = summarizeIssues(issues);
  return {
    valid: summary.errorCount === 0,
    errors,
    warnings,
    issues,
    summary,
    count,
  };
}

export function assertEconomyXmlSize(xml: string, label = "economy XML") {
  const bytes = Buffer.byteLength(xml, "utf8");
  if (bytes > ECONOMY_XML_MAX_BYTES) {
    throw Object.assign(
      new Error(
        `${label} is too large: ${bytes} bytes > ${ECONOMY_XML_MAX_BYTES} bytes.`,
      ),
      { statusCode: 413 },
    );
  }
}

export function parseXml(xml: string) {
  assertEconomyXmlSize(xml);
  return parser.parse(xml);
}

export function serializeXml(input: unknown) {
  return builder.build(input);
}

function arr<T>(input: T | T[] | undefined | null): T[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function numberValue(input: unknown, fallback = 0) {
  const value = Number(input ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function boolValue(input: unknown) {
  return String(input ?? "0") === "1" || String(input).toLowerCase() === "true";
}

export function parseTypesXml(xml: string): DayzTypeItem[] {
  const parsed = parseXml(xml);
  const list = arr<any>(parsed?.types?.type);

  return list.map((entry: any) => ({
    name: String(entry["@_name"] ?? ""),
    nominal: numberValue(entry.nominal),
    lifetime: numberValue(entry.lifetime),
    restock: numberValue(entry.restock),
    min: numberValue(entry.min),
    quantmin: numberValue(entry.quantmin),
    quantmax: numberValue(entry.quantmax),
    cost: numberValue(entry.cost),
    flags: {
      countInCargo: String(entry.flags?.["@_count_in_cargo"] ?? "0") === "1",
      countInHoarder:
        String(entry.flags?.["@_count_in_hoarder"] ?? "0") === "1",
      countInMap: String(entry.flags?.["@_count_in_map"] ?? "0") === "1",
      countInPlayer: String(entry.flags?.["@_count_in_player"] ?? "0") === "1",
      crafted: String(entry.flags?.["@_crafted"] ?? "0") === "1",
      deloot: String(entry.flags?.["@_deloot"] ?? "0") === "1",
    },
    category: entry.category?.["@_name"],
    usage: normalizeNamedArray(entry.usage),
    value: normalizeNamedArray(entry.value),
  }));
}

export function updateTypesXmlFromItems(xml: string, items: DayzTypeItem[]) {
  const parsed = parseXml(xml);
  const index = new Map(items.map((item) => [item.name, item]));
  const rawTypes = parsed?.types?.type;
  const list = arr<any>(rawTypes);

  for (const entry of list) {
    const name = String(entry["@_name"] ?? "");
    const next = index.get(name);
    if (!next) continue;
    entry.nominal = String(next.nominal);
    entry.lifetime = String(next.lifetime);
    entry.restock = String(next.restock);
    entry.min = String(next.min);
    entry.quantmin = String(next.quantmin);
    entry.quantmax = String(next.quantmax);
    entry.cost = String(next.cost);
    entry.flags = {
      "@_count_in_cargo": next.flags.countInCargo ? "1" : "0",
      "@_count_in_hoarder": next.flags.countInHoarder ? "1" : "0",
      "@_count_in_map": next.flags.countInMap ? "1" : "0",
      "@_count_in_player": next.flags.countInPlayer ? "1" : "0",
      "@_crafted": next.flags.crafted ? "1" : "0",
      "@_deloot": next.flags.deloot ? "1" : "0",
    };
    if (next.category) entry.category = { "@_name": next.category };
  }

  if (Array.isArray(rawTypes)) parsed.types.type = list;
  else if (list[0]) parsed.types.type = list[0];
  return serializeXml(parsed);
}

export function parseEventsXml(xml: string): DayzEventItem[] {
  const parsed = parseXml(xml);
  return arr<any>(parsed?.events?.event).map((entry: any) => ({
    name: String(entry["@_name"] ?? ""),
    nominal: numberValue(entry.nominal),
    min: numberValue(entry.min),
    max: numberValue(entry.max),
    lifetime: numberValue(entry.lifetime),
    restock: numberValue(entry.restock),
    saferadius: numberValue(entry.saferadius),
    distanceradius: numberValue(entry.distanceradius),
    cleanupradius: numberValue(entry.cleanupradius),
    active: boolValue(entry.active ?? 1),
    children: arr<any>(entry.children?.child)
      .map((child: any) =>
        String(
          child?.["@_lootmax"]
            ? `${child?.["@_type"] ?? child?.["@_lootmax"]}`
            : (child?.["@_type"] ?? child?.["@_name"] ?? ""),
        ),
      )
      .filter(Boolean),
  }));
}

export function updateEventsXmlFromItems(xml: string, items: DayzEventItem[]) {
  const parsed = parseXml(xml);
  const index = new Map(items.map((item) => [item.name, item]));
  const rawEvents = parsed?.events?.event;
  const list = arr<any>(rawEvents);
  for (const entry of list) {
    const next = index.get(String(entry["@_name"] ?? ""));
    if (!next) continue;
    entry.nominal = String(next.nominal);
    entry.min = String(next.min);
    entry.max = String(next.max);
    entry.lifetime = String(next.lifetime);
    entry.restock = String(next.restock);
    entry.saferadius = String(next.saferadius);
    entry.distanceradius = String(next.distanceradius);
    entry.cleanupradius = String(next.cleanupradius);
    entry.active = next.active ? "1" : "0";
  }
  if (Array.isArray(rawEvents)) parsed.events.event = list;
  else if (list[0]) parsed.events.event = list[0];
  return serializeXml(parsed);
}

export function parseGlobalsXml(xml: string): DayzGlobalItem[] {
  const parsed = parseXml(xml);
  return arr<any>(parsed?.variables?.var).map((entry: any) => ({
    name: String(entry["@_name"] ?? ""),
    type: String(entry["@_type"] ?? ""),
    value: String(entry["@_value"] ?? ""),
  }));
}

export function updateGlobalsXmlFromItems(
  xml: string,
  items: DayzGlobalItem[],
) {
  const parsed = parseXml(xml);
  const index = new Map(items.map((item) => [item.name, item]));
  const rawVars = parsed?.variables?.var;
  const list = arr<any>(rawVars);
  for (const entry of list) {
    const next = index.get(String(entry["@_name"] ?? ""));
    if (!next) continue;
    entry["@_value"] = String(next.value);
    if (next.type) entry["@_type"] = next.type;
  }
  if (Array.isArray(rawVars)) parsed.variables.var = list;
  else if (list[0]) parsed.variables.var = list[0];
  return serializeXml(parsed);
}

export function parseSpawnableTypesSummary(
  xml: string,
): DayzSpawnableSummary[] {
  const parsed = parseXml(xml);
  return arr<any>(parsed?.spawnabletypes?.type).map((entry: any) => {
    const cargoPresets = arr<any>(entry.cargo?.preset).length;
    const cargoItems = arr<any>(entry.cargo?.item).length;
    const attachmentPresets = arr<any>(entry.attachments?.preset).length;
    const attachments = arr<any>(entry.attachments?.item).length;
    return {
      name: String(entry["@_name"] ?? ""),
      cargoPresets,
      cargoItems,
      attachmentPresets,
      attachments,
    };
  });
}

function normalizeNamedArray(input: unknown): string[] {
  if (!input) return [];
  const list = Array.isArray(input) ? input : [input];
  return list
    .map((item: any) => String(item?.["@_name"] ?? ""))
    .filter(Boolean);
}

export function validateXmlWellFormed(xml: string) {
  const issues: EconomyValidationIssue[] = [];
  try {
    parseXml(xml);
  } catch (error) {
    addIssue(issues, "error", "xml.parse", (error as Error).message);
  }
  return buildValidationResult(issues, 0);
}

export function validateTypesXml(xml: string) {
  const issues: EconomyValidationIssue[] = [];
  let entries: DayzTypeItem[] = [];
  try {
    entries = parseTypesXml(xml);
  } catch (error) {
    addIssue(
      issues,
      "error",
      "xml.parse",
      `XML parse failed: ${(error as Error).message}`,
    );
  }

  const seen = new Set<string>();
  for (const item of entries) {
    if (!item.name)
      addIssue(
        issues,
        "error",
        "type.name.missing",
        "Item without name detected.",
      );
    if (seen.has(item.name))
      addIssue(
        issues,
        "error",
        "type.name.duplicate",
        "duplicate type name.",
        item.name,
      );
    seen.add(item.name);

    // DayZ CE allows multiple vanilla / event-driven / infected / animal / mushroom entries where min > nominal.
    // This is suspicious for many normal loot entries, but it must not block Readiness or Economy save.
    if (item.min > item.nominal)
      addIssue(
        issues,
        "warning",
        "type.min_gt_nominal",
        "min is greater than nominal. DayZ CE can allow this for event-driven, infected, animal or special economy entries; review before editing but do not treat as a hard failure.",
        item.name,
      );

    if (item.quantmin > item.quantmax)
      addIssue(
        issues,
        "error",
        "type.quantmin_gt_quantmax",
        "quantmin must not be greater than quantmax.",
        item.name,
      );
    for (const key of [
      "nominal",
      "min",
      "lifetime",
      "restock",
      "cost",
    ] as const) {
      if (!Number.isFinite(item[key]))
        addIssue(
          issues,
          "error",
          `type.${key}.nan`,
          `${key} is not a number.`,
          item.name,
        );
      if (item[key] < 0)
        addIssue(
          issues,
          "error",
          `type.${key}.negative`,
          `${key} must not be negative.`,
          item.name,
        );
    }
    for (const key of ["quantmin", "quantmax"] as const) {
      if (!Number.isFinite(item[key]))
        addIssue(
          issues,
          "error",
          `type.${key}.nan`,
          `${key} is not a number.`,
          item.name,
        );
      if (item[key] < -1)
        addIssue(
          issues,
          "error",
          `type.${key}.too_low`,
          `${key} must not be lower than -1.`,
          item.name,
        );
    }
  }
  return buildValidationResult(issues, entries.length);
}

export function validateEventsXml(xml: string) {
  const issues: EconomyValidationIssue[] = [];
  let entries: DayzEventItem[] = [];
  try {
    entries = parseEventsXml(xml);
  } catch (error) {
    addIssue(
      issues,
      "error",
      "xml.parse",
      `XML parse failed: ${(error as Error).message}`,
    );
  }
  const seen = new Set<string>();
  for (const item of entries) {
    if (!item.name)
      addIssue(
        issues,
        "error",
        "event.name.missing",
        "Event without name detected.",
      );
    if (seen.has(item.name))
      addIssue(
        issues,
        "error",
        "event.name.duplicate",
        "duplicate event name.",
        item.name,
      );
    seen.add(item.name);
    if (item.min > item.nominal)
      addIssue(
        issues,
        "warning",
        "event.min_gt_nominal",
        "min is greater than nominal. This can be valid for DayZ event economy and is not a hard failure.",
        item.name,
      );
    if (item.nominal > item.max && item.max > 0)
      addIssue(
        issues,
        "warning",
        "event.nominal_gt_max",
        "nominal is greater than max. Review event CE tuning before saving.",
        item.name,
      );
    for (const key of [
      "nominal",
      "min",
      "max",
      "lifetime",
      "restock",
      "saferadius",
      "distanceradius",
      "cleanupradius",
    ] as const) {
      if (!Number.isFinite(item[key]))
        addIssue(
          issues,
          "error",
          `event.${key}.nan`,
          `${key} is not a number.`,
          item.name,
        );
      if (item[key] < 0)
        addIssue(
          issues,
          "error",
          `event.${key}.negative`,
          `${key} must not be negative.`,
          item.name,
        );
    }
  }
  return buildValidationResult(issues, entries.length);
}

export function validateGlobalsXml(xml: string) {
  const issues: EconomyValidationIssue[] = [];
  let entries: DayzGlobalItem[] = [];
  try {
    entries = parseGlobalsXml(xml);
  } catch (error) {
    addIssue(
      issues,
      "error",
      "xml.parse",
      `XML parse failed: ${(error as Error).message}`,
    );
  }
  const seen = new Set<string>();
  for (const item of entries) {
    if (!item.name)
      addIssue(
        issues,
        "error",
        "global.name.missing",
        "Global variable without name detected.",
      );
    if (seen.has(item.name))
      addIssue(
        issues,
        "error",
        "global.name.duplicate",
        "duplicate global variable.",
        item.name,
      );
    seen.add(item.name);
    if (item.type && !["0", "1", "2", "3", "4"].includes(item.type))
      addIssue(
        issues,
        "warning",
        "global.type.unusual",
        `unusual type value ${item.type}.`,
        item.name,
      );
  }
  return buildValidationResult(issues, entries.length);
}


export function formatValidationSummary(validation: { valid: boolean; errors?: string[]; warnings?: string[]; summary?: EconomyValidationSummary }) {
  if (validation.summary?.grouped?.length) {
    return validation.summary.grouped
      .slice(0, 6)
      .map((group) => {
        const prefix = group.severity === "error" ? "ERROR" : "WARN";
        const examples = group.examples.length ? ` Examples: ${group.examples.slice(0, 8).join(", ")}${group.examples.length >= 8 ? ", ..." : ""}` : "";
        return `${prefix} ${group.code}: ${group.count}x ${group.message}${examples}`;
      })
      .join(" ");
  }
  if (validation.errors?.length) return validation.errors.slice(0, 8).join(" ");
  if (validation.warnings?.length) return validation.warnings.slice(0, 8).join(" ");
  return "validation passed.";
}

export function validateEconomyXml(file: string, xml: string) {
  if (file === "types.xml") return validateTypesXml(xml);
  if (file === "events.xml") return validateEventsXml(xml);
  if (file === "globals.xml") return validateGlobalsXml(xml);
  const base = validateXmlWellFormed(xml);
  return { ...base, count: 0 };
}
