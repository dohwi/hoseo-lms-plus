const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { assertEntriesAllowed, assertZipAllowed, isAllowedEntry, readZipEntries } = require('../scripts/zip-policy');

const rootDir = path.resolve(__dirname, '..');
const zipPath = path.join(rootDir, 'dist', 'chrome', 'hoseo-lms-plus-chrome-v1.4.2.zip');

function buildChrome() {
    execFileSync(process.execPath, ['scripts/build.js', 'chrome'], {
        cwd: rootDir,
        stdio: 'pipe'
    });
}

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('production ZIP is allowlisted and reproducible', function () {
    buildChrome();
    const firstHash = sha256(zipPath);
    const entries = assertZipAllowed(zipPath);

    buildChrome();
    const secondHash = sha256(zipPath);

    assert.equal(secondHash, firstHash);
    assert.deepEqual(entries, readZipEntries(zipPath));
    assert.ok(entries.includes('manifest.json'));
    assert.ok(entries.includes('lib/core.js'));
    assert.ok(entries.every(isAllowedEntry));
});

test('ZIP allowlist rejects sensitive and development paths', function () {
    ['.env', '.git/config', 'node_modules/example/index.js', 'test/build.test.js', 'scripts/build.js', 'package-lock.json'].forEach(function (entry) {
        assert.equal(isAllowedEntry(entry), false, entry + ' must not be allowed');
        assert.throws(function () { assertEntriesAllowed([entry], 'fixture.zip'); }, /sensitive or development|allowlist/);
    });
});
