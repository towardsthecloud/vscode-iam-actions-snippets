const assert = require('node:assert/strict');
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const cases = [];
function test(name, run) {
  cases.push({ name, run });
}

test('catalog load failures recover after the packaged data is repaired', async () => {
  const extension = vscode.extensions.getExtension('dannysteenman.iam-actions-snippets');
  const catalog = vscode.Uri.joinPath(extension.extensionUri, 'snippets', 'iam-actions.json');
  const original = await vscode.workspace.fs.readFile(catalog);
  try {
    await vscode.workspace.fs.writeFile(catalog, Buffer.from('{}'));
    const { items } = await suggestions('json', '{"Action": ["s3:Ge|"]}');
    assert.ok(!items.some((item) => label(item) === 's3:GetObject'));
  } finally {
    await vscode.workspace.fs.writeFile(catalog, original);
  }
  const { items } = await suggestions('json', '{"Action": ["s3:Ge|"]}');
  assert.ok(
    items.some((item) => label(item) === 's3:GetObject'),
    'A failed load must not poison subsequent requests',
  );
});

for (const marked of ['{"Action": "s|"}', '{"Action": |}']) {
  test(`selecting a service then an action completes ${marked}`, async () => {
    const { document, position, items } = await suggestions('json', marked);
    const service = items.find((item) => label(item) === 's3:');
    assert.ok(service);
    const start = document.offsetAt(
      service.range instanceof vscode.Range ? service.range.start : service.range.replacing.start,
    );
    await insert(document, position, service);
    const cursor = document.positionAt(start + service.insertText.length);
    const result = await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      document.uri,
      cursor,
      undefined,
      1000,
    );
    const action = result.items.find((item) => label(item) === 's3:GetObject');
    assert.ok(action, 'The cursor must remain in the action string after selecting a service');
    assert.ok(action.documentation.value.includes('list_s3.html#list_s3-action-GetObject'));
    await insert(document, cursor, action);
    assert.equal(JSON.parse(document.getText()).Action, 's3:GetObject');
  });
}

async function openAtCursor(language, marked) {
  const offset = marked.indexOf('|');
  const document = await vscode.workspace.openTextDocument({ language, content: marked.replace('|', '') });
  return { document, position: document.positionAt(offset) };
}

async function suggestions(language, marked) {
  const { document, position } = await openAtCursor(language, marked);
  const result = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, position);
  return { document, position, items: result?.items || [] };
}

function label(item) {
  return typeof item.label === 'string' ? item.label : item.label.label;
}

async function insert(document, position, item) {
  const edit = new vscode.WorkspaceEdit();
  const range =
    item.range instanceof vscode.Range
      ? item.range
      : item.range?.replacing || document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
  edit.replace(document.uri, range, item.insertText || label(item));
  for (const additional of item.additionalTextEdits || [])
    edit.replace(document.uri, additional.range, additional.newText);
  assert.equal(await vscode.workspace.applyEdit(edit), true);
}

test('accepting a JSON action replaces the full prefix and preserves existing commas', async () => {
  const { document, position, items } = await suggestions(
    'json',
    '{\n  "Action": [\n    "s3:Ge|",\n    "s3:ListBucket"\n  ]\n}',
  );
  const item = items.find((item) => label(item) === 's3:GetObject');
  assert.ok(item, 'S3 actions must be available');
  await insert(document, position, item);
  assert.deepEqual(JSON.parse(document.getText()).Action, ['s3:GetObject', 's3:ListBucket']);
});

for (const [language, marked, expected] of [
  ['json', '{"Action": "s3:Ge|"}', '{"Action": "s3:GetObject"}'],
  ['json', '{"NotAction": ["s3:Ge|"]}', '{"NotAction": ["s3:GetObject"]}'],
  ['json', '{"Action": [s3:Ge|\n"s3:ListBucket"]}', '{"Action": ["s3:GetObject",\n"s3:ListBucket"]}'],
  ['json', '{"Action": ["s3:Ge|\n"s3:ListBucket"]}', '{"Action": ["s3:GetObject",\n"s3:ListBucket"]}'],
  ['yaml', 'Action:\n  - s3:Ge|', 'Action:\n  - s3:GetObject'],
  ['yaml', 'Action:\n- s3:Ge|', 'Action:\n- s3:GetObject'],
  ['yaml', 'Action: "s3:Ge|"', 'Action: "s3:GetObject"'],
  ['yaml', 'Action: ["s3:Ge|"]', 'Action: ["s3:GetObject"]'],
  ['yaml', 'Action: [\n  "s3:Ge|"\n]', 'Action: [\n  "s3:GetObject"\n]'],
  ['yaml', '{Action: ["s3:Ge|"]}', '{Action: ["s3:GetObject"]}'],
  ['terraform', 'statement {\n  actions = ["s3:Ge|"]\n}', 'statement {\n  actions = ["s3:GetObject"]\n}'],
  ['typescript', 'const p = { actions: ["s3:Ge|"] };', 'const p = { actions: ["s3:GetObject"] };'],
  [
    'typescript',
    "const p = {\n  actions: [\n    's3:Ge|'\n  ]\n};",
    "const p = {\n  actions: [\n    's3:GetObject'\n  ]\n};",
  ],
  [
    'python',
    "p = PolicyStatement(\n  actions=[\n    's3:Ge|'\n  ]\n)",
    "p = PolicyStatement(\n  actions=[\n    's3:GetObject'\n  ]\n)",
  ],
  ['python', 'p = PolicyStatement(actions=["s3:Ge|"])', 'p = PolicyStatement(actions=["s3:GetObject"])'],
]) {
  test(`${language}: completes ${JSON.stringify(marked)}`, async () => {
    const { document, position, items } = await suggestions(language, marked);
    const item = items.find((item) => label(item) === 's3:GetObject');
    assert.ok(item, 'S3 GetObject must be available in this action context');
    await insert(document, position, item);
    assert.equal(document.getText(), expected);
  });
}

for (const [language, marked] of [
  ['json', '{\n  "Action": ["s3:GetObject"],\n  "Resource": "s3:Ge|"\n}'],
  ['typescript', 'const p = {\n  actions: ["s3:GetObject"],\n  resources: [\n    "s3:Ge|"\n  ]\n};'],
  ['python', 'p = PolicyStatement(\n  actions=["s3:GetObject"],\n  resources=[\n    "s3:Ge|"\n  ]\n)'],
  ['terraform', 'statement { actions = ["s3:GetObject"]\n  resources = ["s3:Ge|"] }'],
  ['yaml', 'Action:\n  - "s3:GetObject"\nResource:\n  - s3:Ge|'],
  ['yaml', 'Action: [\n  "s3:GetObject"\n]\nResource: ["s3:Ge|"]'],
  ['typescript', 'const p = { actions: [\n  // "s3:Ge|"\n] };'],
]) {
  test(`${language}: excludes non-action context ${JSON.stringify(marked)}`, async () => {
    const { items } = await suggestions(language, marked);
    assert.ok(!items.some((item) => label(item) === 's3:GetObject'));
  });
}

test('CloudFormation .template files activate IAM completion through their file association', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'iam-template-'));
  const file = path.join(directory, 'policy.template');
  const marked = '{"Action": ["s3:Ge|"]}';
  try {
    await fs.writeFile(file, marked.replace('|', ''));
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
    assert.equal(document.languageId, 'json');
    const result = await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      document.uri,
      document.positionAt(marked.indexOf('|')),
    );
    assert.ok(result.items.some((item) => label(item) === 's3:GetObject'));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('completion results are restricted to the typed service and action prefix', async () => {
  const { items } = await suggestions('json', '{"Action": ["s3:Ge|"]}');
  const actions = items.filter((item) => item.detail?.startsWith('IAM Action:'));
  assert.ok(actions.length > 0);
  assert.ok(actions.every((item) => label(item).toLowerCase().startsWith('s3:ge')));
});

for (const [expression, expected] of [
  ['S3:GetObject', 's3:GetObject'],
  ['s3:getobject', 's3:GetObject'],
  ['execute-api:Invoke', 'execute-api:Invoke'],
  ['ecr-public:GetAuthorizationToken', 'ecr-public:GetAuthorizationToken'],
  ['vpc-lattice:AssociateViaAWSService-EventsAndStates', 'vpc-lattice:AssociateViaAWSService-EventsAndStates'],
  ['S3:Get?bject', 's3:GetObject'],
]) {
  test(`hover follows IAM matching rules for ${expression}`, async () => {
    const { document, position } = await openAtCursor('json', `{"Action": "${expression}|"}`);
    const hovers = await vscode.commands.executeCommand(
      'vscode.executeHoverProvider',
      document.uri,
      position.translate(0, -2),
    );
    const contents = hovers.flatMap((hover) => hover.contents);
    assert.ok(
      contents.some((content) => content.value?.includes(expected)),
      `${expected} must be described`,
    );
    assert.ok(
      contents.every((content) => !content.isTrusted),
      'Documentation must not enable trusted Markdown commands',
    );
  });
}

test('global wildcard hover reports the full count but bounds the rendered table', async () => {
  const { document, position } = await openAtCursor('json', '{"Action": "*|"}');
  const hovers = await vscode.commands.executeCommand(
    'vscode.executeHoverProvider',
    document.uri,
    position.translate(0, -1),
  );
  const text = hovers
    .flatMap((hover) => hover.contents)
    .map((content) => content.value || '')
    .join('\n');
  assert.match(text, /Total matching actions:\*\* [2-9]\d{4}/);
  assert.match(text, /Showing the first 100/);
  assert.ok(text.split('\n').filter((line) => line.startsWith('| [')).length <= 100);
});

exports.run = async () => {
  await vscode.extensions.getExtension('dannysteenman.iam-actions-snippets').activate();
  const results = [];
  for (const { name, run } of cases) {
    try {
      await run();
      results.push({ name, passed: true });
      console.log(`PASS ${name}`);
    } catch (error) {
      results.push({ name, passed: false, error: String(error.stack || error) });
      console.error(`FAIL ${name}:`, error);
    }
  }
  const report = process.env.IAM_TEST_REPORT;
  await fs.mkdir(path.dirname(report), { recursive: true });
  await fs.writeFile(report, JSON.stringify({ vscode: vscode.version, results }, null, 2));
  if (results.some((result) => !result.passed)) throw new Error('Extension integration tests failed');
};
