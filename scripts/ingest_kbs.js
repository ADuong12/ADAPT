const path = require('path');

// Add server's node_modules to module search path so dotenv and deps resolve
const serverNodeModules = path.resolve(__dirname, '..', 'server', 'node_modules');
require.main.paths.unshift(serverNodeModules);

require('dotenv').config({ path: path.resolve(__dirname, '..', 'server', '.env') });

const fs = require('fs');
const pdfParse = require('pdf-parse');
const { chunkBySection } = require('../server/src/services/rag/chunker');
const { embed } = require('../server/src/services/rag/embedder');
const { upsertChunks, collectionForKb, deleteCollectionForKb } = require('../server/src/services/rag/store');

const KB_DIR = path.join(__dirname, '..', 'Knowledge Bases');

const FILE_MAP = {
  'KB_UDL_Table_accessible.pdf': 1,
  'KB_udlg3-graphicorganizer-digital-numbers-a11y.pdf': 2,
  'KB_CRP.txt': 3,
  'P_Spanish-MLL.txt': 4,
  'KB_mll combined.pdf': 4,
};

const KB_NAMES = {
  1: 'UDL (General)',
  2: 'UDL (CS)',
  3: 'CRP',
  4: 'MLL',
};

async function readText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buf = fs.readFileSync(filePath);
  if (ext === '.pdf') {
    const data = await pdfParse(buf);
    return data.text;
  }
  return buf.toString('utf-8');
}

async function ingestFile(filePath, kbId) {
  const label = path.basename(filePath);
  const fileSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  console.log(`  Reading ${label}...`);
  let text;
  try {
    text = await readText(filePath);
  } catch (err) {
    console.warn(`  SKIP ${label}: ${err.message}`);
    return;
  }
  if (!text || !text.trim()) {
    console.warn(`  SKIP ${label}: empty text`);
    return;
  }

  const chunks = chunkBySection(text);
  if (!chunks.length) {
    console.warn(`  SKIP ${label}: no chunks produced`);
    return;
  }
  console.log(`  Chunks: ${chunks.length}`);

  const BATCH = 20;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const texts = batch.map(c => c.text);
    console.log(`  Embedding batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(chunks.length / BATCH)}...`);
    const embeddings = await embed(texts);

    const ids = batch.map((c, j) => `kb${kbId}_${fileSlug}_chunk_${i + j}`);
    const documents = batch.map(c => c.text);
    const metadatas = batch.map(c => ({
      kb_id: String(kbId),
      section_title: c.section_title,
      order: String(c.order),
    }));

    await upsertChunks(kbId, ids, embeddings, documents, metadatas);
  }

  const coll = await collectionForKb(kbId);
  const count = await coll.count();
  console.log(`  Done — kb_${kbId} now has ${count} chunks`);
}

async function main() {
  const kbIdFilter = process.argv.find(a => a.startsWith('--kb-id'));
  const filterId = kbIdFilter ? parseInt(kbIdFilter.split('=')[1] || process.argv[process.argv.indexOf(kbIdFilter) + 1]) : null;
  const reset = process.argv.includes('--reset');

  if (!fs.existsSync(KB_DIR)) {
    console.error(`Knowledge Bases directory not found: ${KB_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(KB_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return (ext === '.txt' || ext === '.pdf') && f in FILE_MAP;
  });

  if (!files.length) {
    console.error('No matching KB files found. Update FILE_MAP in this script if you add new files.');
    process.exit(1);
  }

  const entries = files
    .map(f => ({ file: f, kbId: FILE_MAP[f] }))
    .filter(e => !filterId || e.kbId === filterId);

  console.log(`Ingesting ${entries.length} file(s) into ChromaDB...\n`);

  if (reset) {
    const kbIds = [...new Set(entries.map(e => e.kbId))];
    for (const kbId of kbIds) {
      await deleteCollectionForKb(kbId);
    }
    console.log(`Reset ${kbIds.length} collection(s).\n`);
  }

  for (const { file, kbId } of entries) {
    console.log(`[${KB_NAMES[kbId] || 'KB ' + kbId}] kb_id=${kbId}`);
    try {
      await ingestFile(path.join(KB_DIR, file), kbId);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
    console.log();
  }

  console.log('Ingestion complete.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
