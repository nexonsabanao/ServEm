#!/usr/bin/env node
/**
 * ServEm production audit.
 *
 * Read-only checks over the finished source tree:
 *   1. no leftover demo / simulation copy in user-facing strings
 *   2. no US dollars or US localities left in the web client
 *   3. every internal <Link to="..."> and href="/..." resolves to a real route
 *   4. no client-side write to privileged collections or client-computed fees
 *   5. every callable the web or mobile client invokes is exported from functions/src/index.ts
 *
 * Usage: node tools/production-audit.mjs   (exit 1 on any finding)
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.cwd();
const WEB = path.join(REPO, 'servem_web');
const APP = path.join(REPO, 'servem_app');

const files = (dir, exts) => {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
  };
  walk(dir);
  return out;
};

const findings = [];
const report = (rule, file, line, text) =>
  findings.push({ rule, where: `${path.relative(REPO, file)}${line ? `:${line}` : ''}`, text: text.trim().slice(0, 140) });

const eachLine = (list, exts, fn) => {
  for (const file of files(list, exts)) {
    if (file.includes(`${path.sep}tools${path.sep}`) || file.includes('production-audit')) continue;
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => fn(file, index + 1, line));
  }
};

// 1. demo / simulation language must not survive in shipped UI copy
const DEMO_PATTERNS = [
  [/\bdemo\b/i, 'demo-wording'],
  [/simulat/i, 'demo-wording'],
  [/fake\s+(data|id|payment)/i, 'demo-wording'],
  [/test card/i, 'demo-wording'],
  [/not\s+real\s+(money|payment)/i, 'demo-wording'],
];
eachLine(path.join(WEB, 'src'), ['.ts', '.tsx'], (file, line, text) => {
  // `src/dev` is the design-review surface: it is code-split behind
  // `import.meta.env.DEV`, so it can describe states that do not exist yet
  // (payment success, refund, payout) without any of it shipping.
  if (file.includes(`${path.sep}dev${path.sep}`)) return;
  if (text.includes('localStorage') && text.includes('demo')) report('demo-storage', file, line, text);
  for (const [pattern, rule] of DEMO_PATTERNS) if (pattern.test(text)) report(rule, file, line, text);
});
eachLine(path.join(APP, 'lib'), ['.dart'], (file, line, text) => {
  for (const [pattern, rule] of DEMO_PATTERNS) if (pattern.test(text)) report(rule, file, line, text);
});

// 2. Philippines only: no dollar pricing, no US localities
const US_PATTERNS = [
  [/\bBrooklyn\b/, 'us-locality'],
  [/\bNew York\b/, 'us-locality'],
  [/\bManhattan\b/, 'us-locality'],
  [/America\/New_York/, 'us-timezone'],
  [/(?<!\.)\$\s?\d|\$\$\{/, 'us-currency'],
];
eachLine(path.join(WEB, 'src'), ['.ts', '.tsx'], (file, line, text) => {
  for (const [pattern, rule] of US_PATTERNS) if (pattern.test(text)) report(rule, file, line, text);
});
eachLine(path.join(APP, 'lib'), ['.dart'], (file, line, text) => {
  for (const [pattern, rule] of US_PATTERNS) if (pattern.test(text)) report(rule, file, line, text);
});

// 2b. the product settles through Philippine rails, so no foreign card brand
//     art or test-card copy may survive in either client.
const BRAND_PATTERNS = [
  [/\bVISA\b/i, 'card-brand'],
  [/\bMastercard\b/i, 'card-brand'],
  [/\bAmerican Express\b/i, 'card-brand'],
  [/4242/, 'card-brand'],
];
eachLine(path.join(WEB, 'src'), ['.ts', '.tsx'], (file, line, text) => {
  for (const [pattern, rule] of BRAND_PATTERNS) if (pattern.test(text)) report(rule, file, line, text);
});
eachLine(path.join(APP, 'lib'), ['.dart'], (file, line, text) => {
  for (const [pattern, rule] of BRAND_PATTERNS) if (pattern.test(text)) report(rule, file, line, text);
});

// 3. internal links must resolve to routes declared in App.tsx
const appSource = fs.readFileSync(path.join(WEB, 'src/App.tsx'), 'utf8');
const routes = new Set([...appSource.matchAll(/path=["']([^"']+)["']/g)].map((m) => m[1]));
const prefixes = [...routes].filter((r) => !r.includes(':'));
const resolves = (target) => {
  if (!target.startsWith('/') || target.startsWith('//')) return true; // external or protocol-relative
  const clean = target.split('?')[0].split('#')[0];
  if (routes.has(clean)) return true;
  if (clean.includes(':')) return true; // built from a variable, cannot be statically checked
  return prefixes.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
};
eachLine(path.join(WEB, 'src'), ['.tsx'], (file, line, text) => {
  for (const match of text.matchAll(/(?:to|href)=["'](\/[^"']*)["']/g)) {
    if (!resolves(match[1])) report('dead-link', file, line, match[0]);
  }
});

// 4. money records stay outside the client's reach even on the free plan:
//    payments, payouts and throttle state have no client write path at all.
eachLine(path.join(WEB, 'src'), ['.ts', '.tsx'], (file, line, text) => {
  if (/setDoc\(\s*[a-zA-Z_]*\b(payment|payout|withdrawal|webhookEvent|rateLimit)/i.test(text))
    report('client-writes-money', file, line, text);
  if (/fee:\s*\d/.test(text) && !/test|spec/.test(file)) report('client-computed-fee', file, line, text);
});

// 5. the callable API the clients integrate against must exist in the deployed
//    Functions entrypoint, and every callable must actually be exported there.
const functionsDir = path.join(WEB, 'functions', 'src');
const functionsIndex = path.join(functionsDir, 'index.ts');
if (fs.existsSync(functionsDir)) {
  if (!fs.existsSync(functionsIndex)) {
    report('callable-not-deployed', WEB, 0, 'functions/src/index.ts is missing — no callable is deployable');
  }
  const indexSource = fs.existsSync(functionsIndex) ? fs.readFileSync(functionsIndex, 'utf8') : '';
  const exported = new Set(
    [...indexSource.matchAll(/export\s*\{([^}]*)\}/g)]
      .flatMap((m) => m[1].split(','))
      .map((name) => name.trim().split(/\s+as\s+/).pop())
      .filter(Boolean),
  );
  const called = new Map();
  const callableCall = /callable\s*(?:<[A-Za-z0-9_,\s{}:|;<>\[\]'"]*?>)?\(\s*['"]([a-zA-Z]+)['"]/g;
  for (const file of files(path.join(WEB, 'src'), ['.ts', '.tsx']).concat(files(path.join(APP, 'lib'), ['.dart']))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(callableCall)) {
      const line = source.slice(0, match.index).split('\n').length;
      called.set(match[1], `${path.relative(REPO, file)}:${line}`);
    }
    for (const match of source.matchAll(/httpsCallable[A-Za-z0-9_<>,\s{}:|[\]"'.]*\(\s*[^,]+,\s*['"]([a-zA-Z]+)['"]/g)) {
      const line = source.slice(0, match.index).split('\n').length;
      called.set(match[1], `${path.relative(REPO, file)}:${line}`);
    }
    // Dart reaches callables through the ServEmFunction enum, so the name lives in
    // the enum case rather than in a string literal at the call site.
    for (const match of source.matchAll(/ServEmFunction\s*\.\s*([a-zA-Z]+)/g)) {
      const line = source.slice(0, match.index).split('\n').length;
      called.set(match[1], `${path.relative(REPO, file)}:${line}`);
    }
  }
  for (const [name, where] of [...called].sort())
    if (!exported.has(name)) report('callable-not-deployed', path.join(WEB, 'functions/src/index.ts'), 0, `${name} called from ${where}`);

  for (const file of files(functionsDir, ['.ts'])) {
    if (file.endsWith('index.ts')) continue;
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/export\s+const\s+([a-zA-Z]+)\s*=\s*(onCall|onRequest|onSchedule|functions?\.)/g))
      if (!exported.has(match[1])) report('callable-not-deployed', file, 0, `${match[1]} (${match[2]}) is defined but not exported from index.ts`);
  }
}

// 6. every collection a client touches must have an explicit match block in
//    firestore.rules — otherwise deny-by-default silently breaks the feature.
const rulesPath = path.join(WEB, 'firestore.rules');
if (fs.existsSync(rulesPath) && fs.existsSync(path.join(WEB, 'src', 'lib', 'db.ts'))) {
  const rulesSource = fs.readFileSync(rulesPath, 'utf8');
  const ruled = new Set([...rulesSource.matchAll(/match\s*\/([A-Za-z0-9_]+)\/\{?/g)].map((m) => m[1]));
  const clientCollections = new Map();
  const patterns = [
    /(?:collection|doc)\s*\(\s*\w+\s*,\s*['"]([a-zA-Z_]+)['"]/g,
    /\.collection\s*\(\s*['"]([a-zA-Z_]+)['"]\s*\)/g,
  ];
  for (const file of files(path.join(WEB, 'src'), ['.ts', '.tsx']).concat(files(path.join(APP, 'lib'), ['.dart']))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const line = source.slice(0, match.index).split('\n').length;
        clientCollections.set(match[1], `${path.relative(REPO, file)}:${line}`);
      }
    }
  }
  for (const [name, where] of [...clientCollections].sort())
    if (!ruled.has(name) && name !== 'databases')
      report('unruled-collection', rulesPath, 0, `${name} used by ${where} has no match block in firestore.rules`);
}

// 7. payload shape parity: the strict zod schemas in Cloud Functions and the
//    typed client interfaces must declare exactly the same fields, because a
//    drifted key only fails at runtime with invalid-argument.
const objectKeys = (source, declaration) => {
  const start = source.indexOf(declaration);
  if (start === -1) return null;
  // prettier splits `z` and `.object({` across lines, so match the chain, not the literal.
  const head = source.slice(start).match(/\.\s*object\s*\(\s*\{/);
  if (!head) return null;
  const open = start + head.index + head[0].length - 1;
  if (open === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  // JSDoc blocks between keys defeat the depth scanner (`/** … {x} … */`), so strip comments first.
  const body = source
    .slice(open + 1, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return parseSchemaFields(body);
};

// A client may legally omit an optional() key, so drift has to be measured
// against the required subset or the gate cries wolf.
const parseSchemaFields = (body) => {
  const all = new Set();
  const required = new Set();
  let d = 0;
  let token = '';
  const flush = () => {
    const key = token.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
    if (key) {
      all.add(key[1]);
      if (!/\.optional\(|\.default\(/.test(token)) required.add(key[1]);
    }
    token = '';
  };
  for (const ch of body) {
    if ('([{'.includes(ch)) d += 1;
    else if (')]}'.includes(ch)) d -= 1;
    if (d === 0 && ch === ',') flush();
    else token += ch;
  }
  flush();
  all.required = required;
  return all;
};

const interfaceKeys = (source, name) => {
  const match = source.match(new RegExp(`interface\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) return null;
  const keys = new Set();
  for (const line of match[1].split('\n')) {
    const key = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/);
    if (key) keys.add(key[1]);
  }
  return keys;
};

if (fs.existsSync(functionsDir)) {
  // Value drift: a key both sides declare can still disagree on its enum, and
  // that fails at runtime with invalid-argument while typechecking cleanly.
  const unionValues = (text) => new Set([...text.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const schemaEnumValues = (source, schemaName, key) => {
    const decl = source.indexOf(schemaName);
    if (decl === -1) return null;
    const inline = source.slice(decl).match(new RegExp(`\\b${key}:\\s*(?:z\\.enum\\(\\s*)?(\\[[^\\]]*\\]|[A-Za-z0-9_]+)`));
    if (!inline) return null;
    let literal = inline[1];
    const sources = [source].concat(
      files(functionsDir, ['.ts']).map((f) => fs.readFileSync(f, 'utf8')),
    );
    for (let hop = 0; !literal.startsWith('[') && hop < 6; hop += 1) {
      let next = null;
      for (const text of sources) {
        const arr = text.match(new RegExp(`(?:const|export const)\\s+${literal}\\s*=\\s*(\\[[^\\]]*\\])`));
        if (arr) { next = arr[1]; break; }
        const alias = text.match(new RegExp(`(?:const|export const)\\s+${literal}\\s*=\\s*z\\.enum\\(\\s*([A-Za-z0-9_]+)`));
        if (alias) { next = alias[1]; break; }
      }
      if (!next) return null;
      literal = next;
    }
    return unionValues(literal);
  };
  const clientUnion = (source, typeName) => {
    const m = source.match(new RegExp(`(?:export )?type\\s+${typeName}\\s*=([\\s\\S]*?);`));
    return m ? unionValues(m[1]) : null;
  };
  const valuePairs = [
    ['bookings.ts', 'createBookingSchema', 'placeType', 'src/pages/booking/draft.tsx', /placeType:\s*((?:'[^']+'(?:\s*\|\s*)?)+)/],
    ['bookings.ts', 'updateBookingStatusSchema', 'action', 'src/lib/functions.ts', null, 'BookingAction'],
    ['admin.ts', 'adminDecisionSchema', 'kind', 'src/lib/functions.ts', null, 'AdminDecisionKind'],
  ];
  for (const [moduleFile, schemaName, key, clientRel, inlineRe, typeName] of valuePairs) {
    const modulePath = path.join(functionsDir, moduleFile);
    if (!fs.existsSync(modulePath)) continue;
    const source = fs.readFileSync(modulePath, 'utf8');
    const server = schemaEnumValues(source, schemaName, key);
    const clientFile = path.join(WEB, clientRel);
    if (!server || !fs.existsSync(clientFile)) continue;
    const clientText = fs.readFileSync(clientFile, 'utf8');
    const client = typeName ? clientUnion(clientText, typeName) : (() => {
      const m = clientText.match(inlineRe);
      return m ? unionValues(m[1]) : null;
    })();
    if (!client || !client.size) continue;
    const rejected = [...client].filter((v) => !server.has(v));
    const required = [...server].filter((v) => !client.has(v));
    if (rejected.length || required.length)
      report(
        'payload-drift',
        clientFile,
        0,
        `${key}: client sends [${rejected.join(', ')}] that ${schemaName} rejects; server accepts [${required.join(', ')}] the client never offers`,
      );
  }

  const webFunctionsSource = fs.existsSync(path.join(WEB, 'src/lib/functions.ts'))
    ? fs.readFileSync(path.join(WEB, 'src/lib/functions.ts'), 'utf8')
    : '';
  const pairs = [
    ['bookings.ts', 'createBookingSchema', 'CreateBookingInput'],
    ['bookings.ts', 'updateBookingStatusSchema', 'UpdateBookingStatusInput'],
    ['chat.ts', 'sendMessageSchema', 'SendMessageInput'],
    ['verification.ts', 'submitSchema', 'SubmitVerificationInput'],
    ['payouts.ts', 'requestPayoutSchema', 'RequestPayoutInput'],
    ['admin.ts', 'adminDecisionSchema', 'AdminDecisionInput'],
    ['admin.ts', 'bootstrapSchema', 'AdminBootstrapInput'],
  ];
  for (const [moduleFile, schemaName, interfaceName] of pairs) {
    const modulePath = path.join(functionsDir, moduleFile);
    if (!fs.existsSync(modulePath)) continue;
    const source = fs.readFileSync(modulePath, 'utf8');
    const server = objectKeys(source, schemaName);
    const client = interfaceKeys(webFunctionsSource, interfaceName);
    if (!server || !server.size || !client || !client.size) continue; // one side not written yet
    const missing = [...(server.required ?? server)].filter((key) => !client.has(key));
    const extra = [...client].filter((key) => !server.has(key));
    if (missing.length || extra.length)
      report(
        'payload-drift',
        path.join(WEB, 'src/lib/functions.ts'),
        0,
        `${interfaceName} vs ${schemaName}: missing [${missing.join(', ')}] extra [${extra.join(', ')}]`,
      );
  }

  // The Flutter client speaks the same callables, but its payloads are Dart map
  // literals, so they need their own parser. Typecheck cannot see any of this.
  const depthOneKeys = (body, quoted) => {
    const keys = new Set();
    let d = 0;
    let token = '';
    for (const ch of body) {
      if ('([{'.includes(ch)) d += 1;
      else if (')]}'.includes(ch)) d -= 1;
      if (d === 0 && ch === ',') {
        const key = token.match(quoted ? /^\s*'([A-Za-z_][A-Za-z0-9_]*)'\s*:/ : /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
        if (key) keys.add(key[1]);
        token = '';
      } else token += ch;
    }
    const tail = token.match(quoted ? /^\s*'([A-Za-z_][A-Za-z0-9_]*)'\s*:/ : /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
    if (tail) keys.add(tail[1]);
    return keys;
  };
  const braceBody = (text, open) => {
    let depth = 0;
    for (let i = open; i < text.length; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') {
        depth -= 1;
        if (depth === 0) return text.slice(open + 1, i);
      }
    }
    return null;
  };
  const dartPairs = [
    ['bookings.ts', 'createBookingSchema', 'createBooking'],
    ['bookings.ts', 'updateBookingStatusSchema', 'updateBookingStatus'],
    ['chat.ts', 'sendMessageSchema', 'sendMessage'],
    ['payouts.ts', 'requestPayoutSchema', 'requestPayout'],
    ['verification.ts', 'submitSchema', 'submitVerification'],
  ];
  const dartFiles = files(path.join(APP, 'lib'), ['.dart']);
  const dartPayload = (text, callableName) => {
    // the app calls through an enum façade (ServEmFunction.createBooking) rather
    // than httpsCallable('createBooking'), so both spellings must be searched.
    const patterns = [
      new RegExp(`ServEmFunction\\s*\\.\\s*${callableName}\\s*,`),
      new RegExp(`httpsCallable\\s*(?:<[^>]*>)?\\s*\\(\\s*['"]${callableName}['"]`),
    ];
    for (const re of patterns) {
      const match = re.exec(text);
      if (!match) continue;
      const open = text.indexOf('{', match.index);
      if (open === -1 || open - match.index > 400) continue;
      const body = braceBody(text, open);
      if (body) return { keys: depthOneKeys(body, true), line: text.slice(0, match.index).split('\n').length };
    }
    return null;
  };
  for (const [moduleFile, schemaName, callableName] of dartPairs) {
    const modulePath = path.join(functionsDir, moduleFile);
    if (!fs.existsSync(modulePath)) continue;
    const server = objectKeys(fs.readFileSync(modulePath, 'utf8'), schemaName);
    if (!server || !server.size) continue;
    for (const file of dartFiles) {
      const found = dartPayload(fs.readFileSync(file, 'utf8'), callableName);
      if (!found || !found.keys.size) continue;
      const missing = [...(server.required ?? server)].filter((key) => !found.keys.has(key));
      const extra = [...found.keys].filter((key) => !server.has(key));
      if (missing.length || extra.length)
        report(
          'payload-drift',
          file,
          found.line,
          `Dart ${callableName}() payload vs ${schemaName}: missing [${missing.join(', ')}] extra [${extra.join(', ')}]`,
        );
    }
  }
}

// 8. dead imports: a half-finished deletion leaves files importing a module that
//    no longer exists, which is a build error the copy-focused rules cannot see.
const resolveImport = (fromFile, specifier) => {
  let base;
  if (specifier.startsWith('package:servem_app/')) base = path.join(APP, 'lib', specifier.slice('package:servem_app/'.length));
  else if (specifier.startsWith('package:') || specifier.startsWith('dart:')) return null;
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;
  const candidates = ['', '.ts', '.tsx', '.dart', '.js', '.jsx', '.scss', '.css', '/index.ts', '/index.tsx', '/index.dart'];
  return candidates.some((suffix) => fs.existsSync(base + suffix));
};
for (const file of files(path.join(WEB, 'src'), ['.ts', '.tsx'])
  .concat(files(path.join(APP, 'lib'), ['.dart']))
  .concat(files(path.join(APP, 'test'), ['.dart']))
  .concat(files(path.join(WEB, 'functions', 'src'), ['.ts']))) {
  const source = fs.readFileSync(file, 'utf8');
  // Anchored per line and newline-hostile: an apostrophe inside double-quoted JSX
  // copy otherwise lets a naive quote match run across lines into a real import.
  for (const match of source.matchAll(
    /^\s*(?:import|export)\s*(?:[^'"]*?\bfrom\s*)?['"]([^'"\n]+)['"]|^\s*part\s+['"]([^'"\n]+)['"]/gm,
  )) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    const line = source.slice(0, match.index).split('\n').length;
    if (resolveImport(file, specifier) === false)
      report('dead-import', file, line, `${specifier} does not exist`);
  }
}

// 9. a client write to a collection whose rules deny every write fails at
//    runtime with permission-denied — the build, the type checker and the
//    unruled-collection check above all stay green while the feature is dead.
const rulesDocPath = path.join(WEB, 'firestore.rules');
if (fs.existsSync(rulesDocPath)) {
  const rulesSource = fs.readFileSync(rulesDocPath, 'utf8');
  const seen = new Set();
  const granted = new Set();
  for (const match of rulesSource.matchAll(/match\s*\/([A-Za-z0-9_]+)\/\{[^}]*\}\s*\{/g)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let end = open;
    for (let i = open; i < rulesSource.length; i += 1) {
      if (rulesSource[i] === '{') depth += 1;
      else if (rulesSource[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const body = rulesSource.slice(open + 1, end);
    const writes = [...body.matchAll(/allow\s+([a-z,\s]+?)\s*:\s*if\s+([^;]+);/g)]
      .map((allow) => ({ verbs: allow[1].split(',').map((verb) => verb.trim()), condition: allow[2].trim() }))
      .filter(
        (allow) =>
          allow.verbs.some((verb) => ['write', 'create', 'update', 'delete'].includes(verb)) &&
          allow.condition !== 'false',
      );
    seen.add(match[1]);
    if (writes.length) granted.add(match[1]);
  }
  const clients = files(path.join(WEB, 'src'), ['.ts', '.tsx']).concat(files(path.join(APP, 'lib'), ['.dart']));
  for (const file of clients) {
    const source = fs.readFileSync(file, 'utf8');
    const patterns = [
      /\.collection\s*\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)\s*(?:\.doc\s*\([^)]*\)\s*)?\.(set|update|delete|add)\s*\(/g,
      /(setDoc|updateDoc|deleteDoc|addDoc)\s*\(\s*doc\s*\(\s*\w+\s*,\s*['"]([A-Za-z0-9_]+)['"]/g,
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const name = pattern === patterns[0] ? match[1] : match[2];
        if (!seen.has(name) || granted.has(name)) continue;
        const line = source.slice(0, match.index).split('\n').length;
        report('rules-blocked-write', file, line, `client writes ${name}/ but firestore.rules grants no write on it`);
      }
    }
  }
}

// 10. a ruleset that cannot compile is a deploy-time failure, and the emulator
//     is often the last place it surfaces: a Firestore rules file may only
//     import another Firestore ruleset, never the Storage one.
for (const [file, service] of [
  ['firestore.rules', 'cloud.firestore'],
  ['storage.rules', 'firebase.storage'],
]) {
  const rulesFile = path.join(WEB, file);
  if (!fs.existsSync(rulesFile)) continue;
  const source = fs.readFileSync(rulesFile, 'utf8');
  if (!source.includes(`service ${service}`))
    report('rules-compile', rulesFile, 1, `no \`service ${service}\` block, so the file cannot compile`);
  for (const match of source.matchAll(/^\s*import\s+["']([^"']+)["']\s*;/gm)) {
    const line = source.slice(0, match.index).split('\n').length;
    const target = path.join(WEB, match[1]);
    if (!fs.existsSync(target)) {
      report('rules-compile', rulesFile, line, `imports ${match[1]}, which does not exist`);
      continue;
    }
    const imported = fs.readFileSync(target, 'utf8');
    if (!imported.includes(`service ${service}`))
      report('rules-compile', rulesFile, line, `imports ${match[1]}, which is not a ${service} ruleset`);
  }
}

// 11. `src/dev` is a review surface that must never reach a production bundle.
//     A static import from it drags its copy (and demo states) into the build,
//     so the only allowed form is the `@vite-ignore` dynamic import in App.tsx.
for (const file of files(path.join(WEB, 'src'), ['.ts', '.tsx'])) {
  if (file.includes(`${path.sep}dev${path.sep}`)) continue;
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/^\s*(?:import|export)[^'"]*?from\s*['"]([^'"]*\/dev\/[^'"]+)['"]/gm)) {
    const line = source.slice(0, match.index).split('\n').length;
    report('dev-import', file, line, `${match[1]} must load through import(/* @vite-ignore */ …) under import.meta.env.DEV`);
  }
}

// 13. rules syntax the emulator rejects. `matches` is a string method, not an
//     infix operator, and a stray brace makes the whole file fail to compile —
//     both are deploy-time failures the type checks cannot see.
for (const rulesFile of [path.join(WEB, 'firestore.rules'), path.join(WEB, 'storage.rules')]) {
  if (!fs.existsSync(rulesFile)) continue;
  const source = fs.readFileSync(rulesFile, 'utf8');
  source.split('\n').forEach((line, index) => {
    if (/\b[a-zA-Z_][\w.]*\s+matches\s+['"]/.test(line)) {
      report('rules-syntax', rulesFile, index + 1, 'use value.matches("…"), not the infix `matches` operator');
    }
    if (/request\.auth\.token\.(?!get\b)[A-Za-z_]/.test(line)) {
      report(
        'rules-syntax',
        rulesFile,
        index + 1,
        'use request.auth.token.get("claim", false); dot access errors when the claim is absent',
      );
    }
  });
  const open = (source.match(/{/g) ?? []).length;
  const close = (source.match(/}/g) ?? []).length;
  if (open !== close) {
    report('rules-syntax', rulesFile, 0, `unbalanced braces: ${open} "{" vs ${close} "}"`);
  }
}

// 14. the demo cast must never ship. These names were invented for the design
//     boards; any of them in a screen means fake identities crept back in.
const DEMO_NAMES = [
  'RJ Mercado', 'Alex Morgan', 'Taylor Brooks', 'Sofia Reyes', 'Nina Salazar',
  'Marcus Dela Cruz', 'Taylor Domingo', 'Dana Villanueva', 'Owen Cruz',
  'Jamie Fisher', 'Jamie Parker', 'Jamie Torres',
];
eachLine(path.join(WEB, 'src'), ['.ts', '.tsx'], (file, line, text) => {
  if (file.includes(`${path.sep}dev${path.sep}`)) return;
  for (const name of DEMO_NAMES) {
    if (text.includes(name)) report('fake-identity', file, line, `hardcoded demo identity "${name}"`);
  }
});
eachLine(path.join(APP, 'lib'), ['.dart'], (file, line, text) => {
  for (const name of DEMO_NAMES) {
    if (text.includes(name)) report('fake-identity', file, line, `hardcoded demo identity "${name}"`);
  }
});

// 15. controls that look live but do nothing — the failure mode users report
//     as "the button is broken". Disabled controls are fine; no-ops are not.
const NOOP_HANDLER =
  /(onPressed|onTap|onClick|onChange|onChanged|onSubmit|onLink)\s*[:=]\s*\([^)]*\)\s*(=>\s*)?\{\s*\}/;
const NULL_HANDLER = /(onPressed|onTap|onClick|onLink)\s*[:=]\s*\([^)]*\)\s*=>\s*(undefined|null)\b/;
for (const [root, exts] of [[path.join(WEB, 'src'), ['.ts', '.tsx']], [path.join(APP, 'lib'), ['.dart']]]) {
  eachLine(root, exts, (file, line, text) => {
    if (file.includes(`${path.sep}dev${path.sep}`)) return;
    if (NOOP_HANDLER.test(text) || NULL_HANDLER.test(text)) {
      report('dead-control', file, line, 'this handler does nothing');
    }
  });
}

const grouped = {};for (const finding of findings) (grouped[finding.rule] ||= []).push(finding);

console.log(`ServEm production audit — ${findings.length} finding(s)\n`);
for (const [rule, list] of Object.entries(grouped)) {
  console.log(`## ${rule} (${list.length})`);
  for (const item of list.slice(0, 25)) console.log(`   ${item.where}  ${item.text}`);
  if (list.length > 25) console.log(`   … ${list.length - 25} more`);
  console.log('');
}
process.exit(findings.length ? 1 : 0);
