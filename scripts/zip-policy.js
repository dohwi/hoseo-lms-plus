const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const STATIC_ENTRIES = new Set([
    'manifest.json',
    'content.js',
    'styles.css',
    'icon16.png',
    'icon32.png',
    'icon48.png',
    'icon128.png'
]);
const SENSITIVE_OR_DEVELOPMENT_PATH = /(^|\/)(?:\.git(?:\/|$)|\.env(?:\.|$)|node_modules(?:\/|$)|test(?:s)?(?:\/|$)|scripts(?:\/|$)|docs?(?:\/|$)|package(?:-lock)?\.json$|\.npmrc$|README(?:\.md)?$|CHANGELOG(?:\.md)?$|PRIVACY_POLICY(?:\.md)?$)/i;

function isAllowedEntry(name) {
    return STATIC_ENTRIES.has(name) || /^lib\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(name);
}

function readZipEntries(zipPath) {
    const buffer = fs.readFileSync(zipPath);
    const minimumEocdOffset = Math.max(0, buffer.length - 0xFFFF - 22);
    let eocdOffset = -1;

    for (let offset = buffer.length - 22; offset >= minimumEocdOffset; offset -= 1) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) {
            eocdOffset = offset;
            break;
        }
    }

    if (eocdOffset === -1) {
        throw new Error('Invalid ZIP: end of central directory record not found');
    }

    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
    let offset = buffer.readUInt32LE(eocdOffset + 16);
    const centralDirectoryEnd = offset + centralDirectorySize;

    if (centralDirectoryEnd > eocdOffset) {
        throw new Error('Invalid ZIP: central directory exceeds archive bounds');
    }

    const entries = [];
    for (let index = 0; index < entryCount; index += 1) {
        if (offset + 46 > centralDirectoryEnd || buffer.readUInt32LE(offset) !== 0x02014b50) {
            throw new Error('Invalid ZIP: malformed central directory entry');
        }

        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
        if (entryEnd > centralDirectoryEnd) {
            throw new Error('Invalid ZIP: central directory entry exceeds archive bounds');
        }

        const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
        const compressionMethod = buffer.readUInt16LE(offset + 10);
        const expectedCrc = buffer.readUInt32LE(offset + 16);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const uncompressedSize = buffer.readUInt32LE(offset + 24);
        const localOffset = buffer.readUInt32LE(offset + 42);
        if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
            throw new Error('Invalid ZIP: malformed local file header for ' + name);
        }
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const localName = buffer.subarray(localOffset + 30, localOffset + 30 + localNameLength).toString('utf8');
        if (localName !== name) throw new Error('Invalid ZIP: local and central names differ for ' + name);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const dataEnd = dataStart + compressedSize;
        if (dataEnd > buffer.length) throw new Error('Invalid ZIP: compressed data exceeds archive bounds for ' + name);
        const compressed = buffer.subarray(dataStart, dataEnd);
        let content;
        if (compressionMethod === 0) content = compressed;
        else if (compressionMethod === 8) content = zlib.inflateRawSync(compressed);
        else throw new Error('Invalid ZIP: unsupported compression method for ' + name);
        if (content.length !== uncompressedSize) throw new Error('Invalid ZIP: size mismatch for ' + name);
        let crc = 0xFFFFFFFF;
        for (const byte of content) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
        }
        if (((crc ^ 0xFFFFFFFF) >>> 0) !== expectedCrc) throw new Error('Invalid ZIP: CRC mismatch for ' + name);

        entries.push(name);
        offset = entryEnd;
    }

    if (offset !== centralDirectoryEnd) {
        throw new Error('Invalid ZIP: unexpected central directory data');
    }

    return entries;
}

function assertEntriesAllowed(entries, zipPath) {
    if (entries.length === 0) {
        throw new Error('ZIP must contain at least one file: ' + zipPath);
    }

    const seen = new Set();
    entries.forEach(function (entry) {
        if (!entry || entry.endsWith('/') || entry.includes('\\') || entry.startsWith('/') || entry.split('/').includes('..')) {
            throw new Error('ZIP contains an unsafe path: ' + entry);
        }
        if (seen.has(entry)) {
            throw new Error('ZIP contains a duplicate entry: ' + entry);
        }
        seen.add(entry);

        if (SENSITIVE_OR_DEVELOPMENT_PATH.test(entry)) {
            throw new Error('ZIP contains a sensitive or development file: ' + entry);
        }
        if (!isAllowedEntry(entry)) {
            throw new Error('ZIP contains a file outside the allowlist: ' + entry);
        }
    });

    return entries;
}

function assertZipAllowed(zipPath) {
    return assertEntriesAllowed(readZipEntries(zipPath), zipPath);
}

function findProductionZips() {
    return ['chrome', 'firefox'].flatMap(function (target) {
        const targetDir = path.join(__dirname, '..', 'dist', target);
        return fs.existsSync(targetDir) ? fs.readdirSync(targetDir)
            .filter(function (file) { return file.endsWith('.zip'); })
            .map(function (file) { return path.join(targetDir, file); }) : [];
    });
}

function main() {
    const zipPaths = process.argv.slice(2);
    const archives = zipPaths.length > 0 ? zipPaths : findProductionZips();
    if (archives.length === 0) {
        throw new Error('No production ZIP archives found; run npm run build:all first');
    }

    archives.forEach(function (zipPath) {
        assertZipAllowed(path.resolve(zipPath));
        console.log('Verified ZIP allowlist: ' + zipPath);
    });
}

if (require.main === module) {
    main();
}

module.exports = { assertEntriesAllowed, assertZipAllowed, isAllowedEntry, readZipEntries };
