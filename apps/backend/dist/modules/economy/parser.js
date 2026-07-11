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
function addIssue(issues, severity, code, message, item) {
    issues.push({ severity, code, message, item });
}
function summarizeIssues(issues) {
    const grouped = new Map();
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
            if (a.severity !== b.severity)
                return a.severity === "error" ? -1 : 1;
            return b.count - a.count;
        }),
    };
}
function buildValidationResult(issues, count) {
    const errors = issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.item ? `${issue.item}: ${issue.message}` : issue.message);
    const warnings = issues
        .filter((issue) => issue.severity === "warning")
        .map((issue) => issue.item ? `${issue.item}: ${issue.message}` : issue.message);
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
export function assertEconomyXmlSize(xml, label = "economy XML") {
    const bytes = Buffer.byteLength(xml, "utf8");
    if (bytes > ECONOMY_XML_MAX_BYTES) {
        throw Object.assign(new Error(`${label} is too large: ${bytes} bytes > ${ECONOMY_XML_MAX_BYTES} bytes.`), { statusCode: 413 });
    }
}
export function parseXml(xml) {
    assertEconomyXmlSize(xml);
    return parser.parse(xml);
}
export function serializeXml(input) {
    return builder.build(input);
}
function arr(input) {
    if (!input)
        return [];
    return Array.isArray(input) ? input : [input];
}
function numberValue(input, fallback = 0) {
    const value = Number(input ?? fallback);
    return Number.isFinite(value) ? value : fallback;
}
function boolValue(input) {
    return String(input ?? "0") === "1" || String(input).toLowerCase() === "true";
}
export function parseTypesXml(xml) {
    const parsed = parseXml(xml);
    const list = arr(parsed?.types?.type);
    return list.map((entry) => ({
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
            countInHoarder: String(entry.flags?.["@_count_in_hoarder"] ?? "0") === "1",
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
export function updateTypesXmlFromItems(xml, items) {
    const parsed = parseXml(xml);
    const index = new Map(items.map((item) => [item.name, item]));
    const rawTypes = parsed?.types?.type;
    const list = arr(rawTypes);
    for (const entry of list) {
        const name = String(entry["@_name"] ?? "");
        const next = index.get(name);
        if (!next)
            continue;
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
        if (next.category)
            entry.category = { "@_name": next.category };
    }
    if (Array.isArray(rawTypes))
        parsed.types.type = list;
    else if (list[0])
        parsed.types.type = list[0];
    return serializeXml(parsed);
}
export function parseEventsXml(xml) {
    const parsed = parseXml(xml);
    return arr(parsed?.events?.event).map((entry) => ({
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
        children: arr(entry.children?.child)
            .map((child) => String(child?.["@_lootmax"]
            ? `${child?.["@_type"] ?? child?.["@_lootmax"]}`
            : (child?.["@_type"] ?? child?.["@_name"] ?? "")))
            .filter(Boolean),
    }));
}
export function updateEventsXmlFromItems(xml, items) {
    const parsed = parseXml(xml);
    const index = new Map(items.map((item) => [item.name, item]));
    const rawEvents = parsed?.events?.event;
    const list = arr(rawEvents);
    for (const entry of list) {
        const next = index.get(String(entry["@_name"] ?? ""));
        if (!next)
            continue;
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
    if (Array.isArray(rawEvents))
        parsed.events.event = list;
    else if (list[0])
        parsed.events.event = list[0];
    return serializeXml(parsed);
}
export function parseGlobalsXml(xml) {
    const parsed = parseXml(xml);
    return arr(parsed?.variables?.var).map((entry) => ({
        name: String(entry["@_name"] ?? ""),
        type: String(entry["@_type"] ?? ""),
        value: String(entry["@_value"] ?? ""),
    }));
}
export function updateGlobalsXmlFromItems(xml, items) {
    const parsed = parseXml(xml);
    const index = new Map(items.map((item) => [item.name, item]));
    const rawVars = parsed?.variables?.var;
    const list = arr(rawVars);
    for (const entry of list) {
        const next = index.get(String(entry["@_name"] ?? ""));
        if (!next)
            continue;
        entry["@_value"] = String(next.value);
        if (next.type)
            entry["@_type"] = next.type;
    }
    if (Array.isArray(rawVars))
        parsed.variables.var = list;
    else if (list[0])
        parsed.variables.var = list[0];
    return serializeXml(parsed);
}
export function parseSpawnableTypesSummary(xml) {
    const parsed = parseXml(xml);
    return arr(parsed?.spawnabletypes?.type).map((entry) => {
        const cargoPresets = arr(entry.cargo?.preset).length;
        const cargoItems = arr(entry.cargo?.item).length;
        const attachmentPresets = arr(entry.attachments?.preset).length;
        const attachments = arr(entry.attachments?.item).length;
        return {
            name: String(entry["@_name"] ?? ""),
            cargoPresets,
            cargoItems,
            attachmentPresets,
            attachments,
        };
    });
}
function normalizeNamedArray(input) {
    if (!input)
        return [];
    const list = Array.isArray(input) ? input : [input];
    return list
        .map((item) => String(item?.["@_name"] ?? ""))
        .filter(Boolean);
}
export function validateXmlWellFormed(xml) {
    const issues = [];
    try {
        parseXml(xml);
    }
    catch (error) {
        addIssue(issues, "error", "xml.parse", error.message);
    }
    return buildValidationResult(issues, 0);
}
export function validateTypesXml(xml) {
    const issues = [];
    let entries = [];
    try {
        entries = parseTypesXml(xml);
    }
    catch (error) {
        addIssue(issues, "error", "xml.parse", `XML parse failed: ${error.message}`);
    }
    const seen = new Set();
    for (const item of entries) {
        if (!item.name)
            addIssue(issues, "error", "type.name.missing", "Item without name detected.");
        if (seen.has(item.name))
            addIssue(issues, "error", "type.name.duplicate", "duplicate type name.", item.name);
        seen.add(item.name);
        // DayZ CE allows multiple vanilla / event-driven / infected / animal / mushroom entries where min > nominal.
        // This is suspicious for many normal loot entries, but it must not block Readiness or Economy save.
        if (item.min > item.nominal)
            addIssue(issues, "warning", "type.min_gt_nominal", "min is greater than nominal. DayZ CE can allow this for event-driven, infected, animal or special economy entries; review before editing but do not treat as a hard failure.", item.name);
        if (item.quantmin > item.quantmax)
            addIssue(issues, "error", "type.quantmin_gt_quantmax", "quantmin must not be greater than quantmax.", item.name);
        for (const key of [
            "nominal",
            "min",
            "lifetime",
            "restock",
            "cost",
        ]) {
            if (!Number.isFinite(item[key]))
                addIssue(issues, "error", `type.${key}.nan`, `${key} is not a number.`, item.name);
            if (item[key] < 0)
                addIssue(issues, "error", `type.${key}.negative`, `${key} must not be negative.`, item.name);
        }
        for (const key of ["quantmin", "quantmax"]) {
            if (!Number.isFinite(item[key]))
                addIssue(issues, "error", `type.${key}.nan`, `${key} is not a number.`, item.name);
            if (item[key] < -1)
                addIssue(issues, "error", `type.${key}.too_low`, `${key} must not be lower than -1.`, item.name);
        }
    }
    return buildValidationResult(issues, entries.length);
}
export function validateEventsXml(xml) {
    const issues = [];
    let entries = [];
    try {
        entries = parseEventsXml(xml);
    }
    catch (error) {
        addIssue(issues, "error", "xml.parse", `XML parse failed: ${error.message}`);
    }
    const seen = new Set();
    for (const item of entries) {
        if (!item.name)
            addIssue(issues, "error", "event.name.missing", "Event without name detected.");
        if (seen.has(item.name))
            addIssue(issues, "error", "event.name.duplicate", "duplicate event name.", item.name);
        seen.add(item.name);
        if (item.min > item.nominal)
            addIssue(issues, "warning", "event.min_gt_nominal", "min is greater than nominal. This can be valid for DayZ event economy and is not a hard failure.", item.name);
        if (item.nominal > item.max && item.max > 0)
            addIssue(issues, "warning", "event.nominal_gt_max", "nominal is greater than max. Review event CE tuning before saving.", item.name);
        for (const key of [
            "nominal",
            "min",
            "max",
            "lifetime",
            "restock",
            "saferadius",
            "distanceradius",
            "cleanupradius",
        ]) {
            if (!Number.isFinite(item[key]))
                addIssue(issues, "error", `event.${key}.nan`, `${key} is not a number.`, item.name);
            if (item[key] < 0)
                addIssue(issues, "error", `event.${key}.negative`, `${key} must not be negative.`, item.name);
        }
    }
    return buildValidationResult(issues, entries.length);
}
export function validateGlobalsXml(xml) {
    const issues = [];
    let entries = [];
    try {
        entries = parseGlobalsXml(xml);
    }
    catch (error) {
        addIssue(issues, "error", "xml.parse", `XML parse failed: ${error.message}`);
    }
    const seen = new Set();
    for (const item of entries) {
        if (!item.name)
            addIssue(issues, "error", "global.name.missing", "Global variable without name detected.");
        if (seen.has(item.name))
            addIssue(issues, "error", "global.name.duplicate", "duplicate global variable.", item.name);
        seen.add(item.name);
        if (item.type && !["0", "1", "2", "3", "4"].includes(item.type))
            addIssue(issues, "warning", "global.type.unusual", `unusual type value ${item.type}.`, item.name);
    }
    return buildValidationResult(issues, entries.length);
}
export function formatValidationSummary(validation) {
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
    if (validation.errors?.length)
        return validation.errors.slice(0, 8).join(" ");
    if (validation.warnings?.length)
        return validation.warnings.slice(0, 8).join(" ");
    return "validation passed.";
}
export function validateEconomyXml(file, xml) {
    if (file === "types.xml")
        return validateTypesXml(xml);
    if (file === "events.xml")
        return validateEventsXml(xml);
    if (file === "globals.xml")
        return validateGlobalsXml(xml);
    const base = validateXmlWellFormed(xml);
    return { ...base, count: 0 };
}
