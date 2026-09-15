const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { assertZipAllowed } = require('./zip-policy');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageJson = require(path.join(rootDir, 'package.json'));
const packageLock = require(path.join(rootDir, 'package-lock.json'));
const version = packageJson.version;
const targets = new Set(['chrome', 'firefox']);
const inputTarget = process.argv[2] || 'chrome';
const ZIP_TIMESTAMP = { date: 0x0021, time: 0x0000 }; // 1980-01-01 00:00:00 UTC
const ZIP_FILES = ['manifest.json', 'content.js', 'styles.css', 'icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'];

function ensureCleanDir(targetDir) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
}

function copyArtifact(relativePath, targetDir) {
    fs.cpSync(path.join(rootDir, relativePath), path.join(targetDir, relativePath), { recursive: true });
}

function assertVersionConsistency(manifest) {
    const lockRootVersion = packageLock.packages && packageLock.packages[''] && packageLock.packages[''].version;
    if (manifest.version !== version || packageLock.version !== version || lockRootVersion !== version) {
        throw new Error('Version mismatch: package.json, package-lock.json, and manifest.json must use ' + version);
    }
}

function buildManifest(target) {
    const manifestPath = path.join(rootDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assertVersionConsistency(manifest);

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

function crc32(buffer) {
    let crc = 0xFFFFFFFF;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function listZipFiles(targetDir) {
    const files = [];
    function visit(relativeDir) {
        const absoluteDir = path.join(targetDir, relativeDir);
        fs.readdirSync(absoluteDir, { withFileTypes: true }).sort(function (a, b) {
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        }).forEach(function (entry) {
            const relativePath = path.posix.join(relativeDir, entry.name);
            if (entry.isDirectory()) {
                visit(relativePath);
            } else if (entry.isFile()) {
                files.push(relativePath);
            } else {
                throw new Error('Only regular files may be packaged: ' + relativePath);
            }
        });
    }

    visit('lib');
    return ZIP_FILES.concat(files).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
}

function writeUInt32(buffer, offset, value) {
    buffer.writeUInt32LE(value >>> 0, offset);
}

function createDeterministicZip(targetDir, zipPath) {
    let offset = 0;
    const localRecords = [];
    const centralRecords = [];

    listZipFiles(targetDir).forEach(function (relativePath) {
        const name = Buffer.from(relativePath, 'utf8');
        const source = fs.readFileSync(path.join(targetDir, relativePath));
        const compressed = zlib.deflateRawSync(source, { level: 9 });
        const crc = crc32(source);
        const local = Buffer.alloc(30 + name.length);
        local.writeUInt32LE(0x04034B50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt16LE(ZIP_TIMESTAMP.time, 10);
        local.writeUInt16LE(ZIP_TIMESTAMP.date, 12);
        writeUInt32(local, 14, crc);
        writeUInt32(local, 18, compressed.length);
        writeUInt32(local, 22, source.length);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        name.copy(local, 30);
        localRecords.push(local, compressed);

        const central = Buffer.alloc(46 + name.length);
        central.writeUInt32LE(0x02014B50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt16LE(ZIP_TIMESTAMP.time, 12);
        central.writeUInt16LE(ZIP_TIMESTAMP.date, 14);
        writeUInt32(central, 16, crc);
        writeUInt32(central, 20, compressed.length);
        writeUInt32(central, 24, source.length);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        writeUInt32(central, 38, 0);
        writeUInt32(central, 42, offset);
        name.copy(central, 46);
        centralRecords.push(central);
        offset += local.length + compressed.length;
    });

    const centralDirectory = Buffer.concat(centralRecords);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054B50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(centralRecords.length, 8);
    eocd.writeUInt16LE(centralRecords.length, 10);
    writeUInt32(eocd, 12, centralDirectory.length);
    writeUInt32(eocd, 16, offset);
    eocd.writeUInt16LE(0, 20);
    fs.writeFileSync(zipPath, Buffer.concat(localRecords.concat(centralDirectory, eocd)));
}

function zipTarget(target, targetDir) {
    const zipFileName = 'hoseo-lms-plus-' + target + '-v' + version + '.zip';
    const zipPath = path.join(targetDir, zipFileName);
    createDeterministicZip(targetDir, zipPath);
    assertZipAllowed(zipPath);
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
