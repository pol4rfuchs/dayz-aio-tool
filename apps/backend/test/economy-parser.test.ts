import assert from "node:assert/strict";
import test from "node:test";
import {
  parseEventsXml,
  parseGlobalsXml,
  parseTypesXml,
  updateEventsXmlFromItems,
  updateGlobalsXmlFromItems,
  updateTypesXmlFromItems,
  validateEventsXml,
  validateGlobalsXml,
  validateTypesXml
} from "../src/modules/economy/parser.js";

const TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<types>
  <type name="Apple">
    <nominal>10</nominal><lifetime>3600</lifetime><restock>0</restock><min>5</min><quantmin>-1</quantmin><quantmax>-1</quantmax><cost>100</cost>
    <flags count_in_cargo="0" count_in_hoarder="0" count_in_map="1" count_in_player="0" crafted="0" deloot="0"/>
    <category name="food"/>
    <usage name="Town"/>
    <value name="Tier1"/>
  </type>
</types>`;

const EVENTS_XML = `<events><event name="AnimalCow"><nominal>5</nominal><min>1</min><max>10</max><lifetime>1200</lifetime><restock>0</restock><saferadius>100</saferadius><distanceradius>200</distanceradius><cleanupradius>100</cleanupradius><active>1</active></event></events>`;
const GLOBALS_XML = `<variables><var name="TimeLogin" type="0" value="15"/></variables>`;

test("types.xml parses, validates and round-trips edited numeric fields", () => {
  const items = parseTypesXml(TYPES_XML);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Apple");
  items[0].nominal = 12;
  items[0].min = 6;
  const nextXml = updateTypesXmlFromItems(TYPES_XML, items);
  const nextItems = parseTypesXml(nextXml);
  assert.equal(nextItems[0].nominal, 12);
  assert.equal(nextItems[0].min, 6);
  assert.equal(validateTypesXml(nextXml).valid, true);
});

test("types.xml validation treats min greater than nominal as warning", () => {
  const warningXml = TYPES_XML.replace("<nominal>10</nominal>", "<nominal>2</nominal>").replace("<min>5</min>", "<min>5</min>");
  const result = validateTypesXml(warningXml);
  assert.equal(result.valid, true);
  assert.equal(result.summary.warningCount, 1);
  assert.ok(result.warnings.some((warning) => warning.includes("min is greater than nominal")));
});

test("types.xml validation still catches destructive economy values", () => {
  const invalid = TYPES_XML.replace("<quantmin>-1</quantmin>", "<quantmin>50</quantmin>").replace("<quantmax>-1</quantmax>", "<quantmax>10</quantmax>");
  const result = validateTypesXml(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("quantmin must not be greater than quantmax")));
});

test("events.xml parses, validates and round-trips edited fields", () => {
  const events = parseEventsXml(EVENTS_XML);
  events[0].nominal = 7;
  events[0].active = false;
  const nextXml = updateEventsXmlFromItems(EVENTS_XML, events);
  const nextEvents = parseEventsXml(nextXml);
  assert.equal(nextEvents[0].nominal, 7);
  assert.equal(nextEvents[0].active, false);
  assert.equal(validateEventsXml(nextXml).valid, true);
});

test("globals.xml parses, validates and round-trips edited values", () => {
  const globals = parseGlobalsXml(GLOBALS_XML);
  globals[0].value = "30";
  const nextXml = updateGlobalsXmlFromItems(GLOBALS_XML, globals);
  const nextGlobals = parseGlobalsXml(nextXml);
  assert.equal(nextGlobals[0].value, "30");
  assert.equal(validateGlobalsXml(nextXml).valid, true);
});
