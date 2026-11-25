const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const schema = readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
const itemsClient = readFileSync(path.join(root, "frontend", "src", "lib", "items.ts"), "utf8");

test("soft-delete RPC is restricted to secretariat and records removal metadata", () => {
  assert.match(schema, /create or replace function public\.remove_item\(target_item uuid\)/i);
  assert.match(schema, /auth\.uid\(\) is null or not public\.is_secretary\(\)/i);
  assert.match(schema, /set status = 'removed',\s*removed_at = now\(\),\s*removed_by = auth\.uid\(\)/i);
  assert.match(schema, /get diagnostics affected_rows = row_count/i);
  assert.match(schema, /if affected_rows = 0 then[\s\S]*?raise exception/i);
});

test("frontend calls the matching RPC and handles PostgREST missing-function errors", () => {
  assert.match(itemsClient, /\.rpc\("remove_item",\s*\{\s*target_item:\s*itemId,?\s*\}\)/);
  assert.match(itemsClient, /error\?\.code === "PGRST202"/);
  assert.doesNotMatch(itemsClient, /\.from\("items"\)\.delete\(\)/);
});

test("removed items are excluded from listing queries and schema is reloaded", () => {
  assert.match(itemsClient, /\.neq\("status", "removed"\)/);
  assert.match(schema, /status <> 'removed'/);
  assert.match(schema, /notify pgrst,\s*'reload schema'/i);
});
