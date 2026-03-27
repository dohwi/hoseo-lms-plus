const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const version = require(path.join(rootDir, 'package.json')).version;
const targets = new Set(['chrome', 'firefox']);
const inputTarget = process.argv[2] || 'chrome';

function ensureCleanDir(targetDir) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
}

function copyArtifact(relativePath, targetDir) {
    fs.cpSync(path.join(rootDir, relativePath), path.join(targetDir, relativePath), { recursive: true });
}

function buildManifest(target) {
    const manifestPath = path.join(rootDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (target === 'firefox') {
        manifest.browser_specific_settings = {
            gecko: {
                id: 'hoseo-lms-plus@dohwi.com',
                data_collection_permissions: {
                    required: ['none']
                }
            }
        };
    } else {
        delete manifest.browser_specific_settings;
    }

    return JSON.stringify(manifest, null, 2) + '\n';
}

function zipTarget(target, targetDir) {
    const zipFileName = 'hoseo-lms-plus-' + target + '-v' + version + '.zip';
    execFileSync(
        'zip',
        ['-r', zipFileName, 'manifest.json', 'content.js', 'styles.css', 'lib', 'icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'],
        { cwd: targetDir, stdio: 'inherit' }
    );
}

function buildTarget(target) {
    const targetDir = path.join(distDir, target);
    ensureCleanDir(targetDir);

    ['content.js', 'styles.css', 'lib', 'icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'].forEach(function (relativePath) {
        copyArtifact(relativePath, targetDir);
    });

    fs.writeFileSync(path.join(targetDir, 'manifest.json'), buildManifest(target), 'utf8');
    zipTarget(target, targetDir);
}

function main() {
    const requestedTargets = inputTarget === 'all' ? Array.from(targets) : [inputTarget];
    const invalidTarget = requestedTargets.find(function (target) { return !targets.has(target); });

    if (invalidTarget) {
        throw new Error('Unsupported build target: ' + invalidTarget);
    }

    fs.mkdirSync(distDir, { recursive: true });
    requestedTargets.forEach(buildTarget);
}

main();
