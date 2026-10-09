const { runTests } = require('@vscode/test-electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const version = process.argv[2] || 'stable';
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'iam-test-'));
  try {
    await runTests({
      version,
      extensionDevelopmentPath: path.resolve('.vscode-test/packaged/extension'),
      extensionTestsPath: path.resolve('tests/vscode.test.cjs'),
      extensionTestsEnv: { IAM_TEST_REPORT: path.resolve(`.vscode-test/results/${version}.json`) },
      launchArgs: [
        `--user-data-dir=${profile}/profile`,
        `--extensions-dir=${profile}/extensions`,
        '--disable-extensions',
        '--disable-gpu',
        '--skip-welcome',
        '--disable-workspace-trust',
      ],
    });
  } finally {
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
