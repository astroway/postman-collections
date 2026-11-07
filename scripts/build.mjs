// Builds the Postman v2.1 collection from the live OpenAPI document.
// Usage: node scripts/build.mjs   (OPENAPI_URL overrides the source)

import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Response schemas without an example are filled by a faker that calls Math.random. A fixed seed
// makes the same spec produce the same file, so the sync workflow commits only real changes.
// The faker copies Math.random when it loads, so this runs before the import below.
let seed = 0x2f6b9d1;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const { default: Converter } = await import('openapi-to-postmanv2');

const SPEC_URL = process.env.OPENAPI_URL || 'https://api.astroway.info/v1/openapi.json';
const OUT = new URL('../astroway-api.postman_collection.json', import.meta.url);
const STATS = new URL('../stats.json', import.meta.url);

// The converter emits random ids on every run; ids derived from the item path keep diffs to real changes.
function stableId(seed) {
  const h = createHash('sha1').update('astroway-postman:' + seed).digest('hex');
  const v = ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${v}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const res = await fetch(SPEC_URL);
if (!res.ok) {
  console.error(`Could not fetch ${SPEC_URL}: HTTP ${res.status}`);
  process.exit(1);
}
const spec = await res.json();
const operations = Object.values(spec.paths || {}).reduce(
  (n, p) => n + Object.keys(p).filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m)).length,
  0,
);
// A spec this small means the source is broken, not that the API shrank; keep the last good collection.
if (operations < 100) {
  console.error(`Spec has only ${operations} operations, refusing to overwrite the collection`);
  process.exit(1);
}

// The converter invents a random value for a parameter with no example (a latitude of 3246, a new
// one on every run). Give those a plausible fixed value instead, so requests run and diffs stay quiet.
const FALLBACK = {
  lat: 50.45, lat_a: 50.45, lat_b: 48.86,
  lng: 30.52, lng_a: 30.52, lng_b: 2.35,
  tz: 3, tz_a: 3, tz_b: 1,
  date: '2026-01-15', date_a: '1990-05-15', date_b: '1992-08-03',
  time_a: '14:30', time_b: '09:15',
  city: 'Kyiv', name: 'Ada Lovelace', seed: 42, q: 'natal chart', 'Accept-Language': 'en',
};
function fillExample(param) {
  const schema = param.schema || {};
  if ('example' in param || 'examples' in param || 'example' in schema) return;
  if ('default' in schema) param.example = schema.default;
  else if (schema.enum) param.example = schema.enum[0];
  else if (schema.type === 'boolean') param.example = false;
  else if (param.name in FALLBACK) param.example = FALLBACK[param.name];
  else if (schema.type === 'number' || schema.type === 'integer') param.example = schema.minimum ?? 0;
  else param.example = '';
}
const shared = spec.components?.parameters || {};
for (const ops of Object.values(spec.paths || {})) {
  for (const op of [ops, ...Object.values(ops)]) {
    for (const p of op?.parameters || []) fillExample(p.$ref ? shared[p.$ref.split('/').pop()] || {} : p);
  }
}

const conversion = await new Promise((resolve, reject) =>
  Converter.convert(
    { type: 'json', data: spec },
    {
      folderStrategy: 'Tags',
      exampleParametersResolution: 'Example',
      requestParametersResolution: 'Example',
      keepImplicitHeaders: true,
    },
    (err, out) => (err ? reject(err) : resolve(out)),
  ),
);
if (!conversion.result) {
  console.error('Conversion failed:', conversion.reason);
  process.exit(1);
}
const collection = conversion.output[0].data;

// One place for the key and the base URL, so a user edits two variables and nothing else.
collection.variable = [
  { key: 'baseUrl', value: 'https://api.astroway.info/v1', type: 'string', description: 'API base URL' },
  {
    key: 'apiKey',
    value: 'aw_test_REPLACE_WITH_YOUR_KEY',
    type: 'string',
    description: 'Your key. Free tier: https://api.astroway.info/dashboard/sign-up',
  },
];
collection.auth = {
  type: 'apikey',
  apikey: [
    { key: 'key', value: 'X-Api-Key', type: 'string' },
    { key: 'value', value: '{{apiKey}}', type: 'string' },
    { key: 'in', value: 'header', type: 'string' },
  ],
};

function rewriteUrl(item) {
  const url = item.request?.url;
  if (url?.raw) {
    url.raw = url.raw.replace(/^(https?:\/\/[^/]+|\{\{baseUrl\}\})\/(api\/)?v1/, '{{baseUrl}}');
    if (Array.isArray(url.host)) url.host = ['{{baseUrl}}'];
    if (Array.isArray(url.path)) while (url.path[0] === 'v1' || url.path[0] === 'api') url.path.shift();
  }
  (item.item || []).forEach(rewriteUrl);
}

function stabilize(item, path) {
  const here = path ? `${path}/${item.name ?? ''}` : item.name ?? '';
  if (item.id) item.id = stableId(here);
  (item.response || []).forEach((r, i) => {
    if (r.id) r.id = stableId(`${here}#response[${i}]:${r.name ?? ''}`);
  });
  (item.item || []).forEach((c) => stabilize(c, here));
}

collection.item.forEach(rewriteUrl);
collection.item.forEach((c) => stabilize(c, ''));
collection.info._postman_id = stableId('collection');

let requests = 0;
const count = (item) => (item.request ? requests++ : (item.item || []).forEach(count));
collection.item.forEach(count);

writeFileSync(OUT, JSON.stringify(collection, null, 2) + '\n');
writeFileSync(
  STATS,
  JSON.stringify(
    { source: SPEC_URL, apiVersion: spec.info?.version ?? null, operations, requests, folders: collection.item.length },
    null,
    2,
  ) + '\n',
);
console.log(`API ${spec.info?.version}: ${operations} operations, ${requests} requests in ${collection.item.length} folders`);
