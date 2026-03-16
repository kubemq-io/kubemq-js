import { readFile, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const versionFile = 'src/version.ts';
const content = `export const SDK_VERSION = '${pkg.version}' as const;\n`;

await writeFile(versionFile, content, 'utf8');
console.log(`Synced SDK_VERSION to ${pkg.version}`);
