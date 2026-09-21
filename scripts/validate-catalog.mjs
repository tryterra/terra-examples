import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(resolve(root, 'examples.schema.json'), 'utf8'));
const validateSchema = new Ajv({ allErrors: true }).compile(schema);

export function portablePath(value) {
  if (!value || value === '.' || posix.normalize(value) !== value || value.startsWith('/')) return false;
  return value.split('/').every(part => {
    if (part === '..' || part.toLowerCase() === '.git' || /[. ]$/.test(part)) return false;
    if (/[^\x20-\x7e]|[<>:"\\|?*]/.test(part)) return false;
    return !/^(CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(part);
  });
}

export function validateCatalog(catalog, files) {
  if (!validateSchema(catalog)) throw new Error(JSON.stringify(validateSchema.errors));
  const names = new Set();
  const spellings = new Map();
  const directories = new Set();
  let total = 0;
  for (const [name, entry] of files) {
    if (!portablePath(name) || !['100644', '100755'].includes(entry.mode)) throw new Error(`Unsafe file: ${name}`);
    total += entry.size;
    for (let p = name; p !== '.'; p = posix.dirname(p)) {
      const key = p.toLowerCase();
      if (spellings.has(key) && spellings.get(key) !== p) throw new Error(`Colliding path: ${p}`);
      spellings.set(key, p);
      if (p !== name) directories.add(p);
    }
  }
  if (total > 128 * 1024 * 1024 || files.size + directories.size + 1 > 10000) throw new Error('Repository exceeds CLI archive limits');
  for (const example of catalog.examples) {
    if (names.has(example.name)) throw new Error(`Duplicate example: ${example.name}`);
    names.add(example.name);
    if (example.path !== `examples/${example.name}`) throw new Error(`Invalid example path: ${example.path}`);
    for (const value of [example.title, example.description, ...example.next_steps.map(step => step.instruction)]) {
      if (!value.trim() || /[\p{Cc}\p{Cf}]/u.test(value)) throw new Error(`Invalid text: ${example.name}`);
    }
    if (!files.has(`${example.path}/README.md`)) throw new Error(`Missing README: ${example.name}`);
    for (const step of example.next_steps) {
      if (step.directory !== '.' && !portablePath(step.directory)) throw new Error(`Unsafe next-step directory: ${step.directory}`);
      if (!directories.has(posix.join(example.path, step.directory))) throw new Error(`Missing next-step directory: ${step.directory}`);
    }
  }
  const folders = new Set([...files.keys()].filter(name => name.startsWith('examples/')).map(name => name.split('/')[1]));
  for (const folder of folders) if (!names.has(folder)) throw new Error(`Unlisted example: ${folder}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = readFileSync(resolve(root, 'examples.json'));
  if (raw.length > 1024 * 1024) throw new Error('Catalog exceeds CLI size limit');
  const tracked = execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: root, encoding: 'utf8' });
  const files = new Map(tracked.split('\0').filter(Boolean).map(line => {
    const [metadata, name] = line.split('\t');
    return [name, { mode: metadata.split(' ')[0], size: lstatSync(resolve(root, name)).size }];
  }));
  validateCatalog(JSON.parse(raw), files);
  // GitHub adds a repository directory to its archive; budget for its headers.
  const archive = execFileSync('git', ['archive', '--format=zip', '--prefix=terra-examples-main/', 'HEAD'], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  if (archive.length > 31 * 1024 * 1024) throw new Error('Repository exceeds compressed archive budget');
  console.log('Example catalog is valid.');
}
