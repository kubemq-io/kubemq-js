import { readdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const CJS_DIR = 'dist';

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function fixup() {
  const files = await walk(CJS_DIR);
  let fixed = 0;

  for (const file of files) {
    if (!file.endsWith('.cjs')) continue;

    let content = await readFile(file, 'utf8');
    const original = content;

    content = content.replace(/require\("(\.[^"]+)\.js"\)/g, 'require("$1.cjs")');

    if (content !== original) {
      await writeFile(file, content, 'utf8');
      fixed++;
    }
  }

  for (const file of files) {
    if (!file.endsWith('.d.cts')) continue;

    let content = await readFile(file, 'utf8');
    const original = content;

    content = content.replace(/from '(\.[^']+)\.js'/g, "from '$1.cjs'");

    if (content !== original) {
      await writeFile(file, content, 'utf8');
      fixed++;
    }
  }

  const cjsExists = files.some((f) => f.endsWith('.cjs'));
  const dtsExists = files.some((f) => f.endsWith('.d.cts'));

  if (!cjsExists) {
    console.warn('Warning: no .cjs files found in dist/');
  }
  if (!dtsExists) {
    console.warn('Warning: no .d.cts files found in dist/');
  }

  console.log(`CJS fixup complete. ${fixed} file(s) updated.`);
}

fixup().catch((err) => {
  console.error(err);
  process.exit(1);
});
