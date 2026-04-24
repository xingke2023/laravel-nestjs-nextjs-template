'use strict';
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC_DIR   = '/home/ubuntu/static/avatars';
const THUMB_DIR = '/home/ubuntu/static/avatars/thumbs';
const CONCURRENCY = 12;

fs.mkdirSync(THUMB_DIR, { recursive: true });

const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.png'));
let done = 0, skipped = 0;

async function processFile(file) {
  const src = path.join(SRC_DIR, file);
  const dst = path.join(THUMB_DIR, file.replace(/\.png$/, '.webp'));
  if (fs.existsSync(dst)) { skipped++; done++; return; }
  await sharp(src)
    .resize(80, 107, { fit: 'cover', position: 'top' })
    .webp({ quality: 75 })
    .toFile(dst);
  done++;
  if (done % 200 === 0) console.log(`  ${done}/${files.length}...`);
}

async function run() {
  console.log(`Converting ${files.length} PNGs → WebP 80×107px ...`);
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    await Promise.all(files.slice(i, i + CONCURRENCY).map(processFile));
  }
  console.log(`Done: ${done} total, ${skipped} skipped (already existed)`);

  // Update index.json with WebP thumb paths
  const indexPath = path.join(SRC_DIR, 'index.json');
  const list = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  for (const item of list) {
    // thumb currently: /avatars/asset-xxx_%E4%B8%AD...png
    // new:             /avatars/thumbs/asset-xxx_%E4%B8%AD...webp
    item.thumb = item.thumb
      .replace('/avatars/', '/avatars/thumbs/')
      .replace(/\.png$/, '.webp');
  }
  fs.writeFileSync(indexPath, JSON.stringify(list, null, 0), 'utf8');
  console.log(`index.json updated with WebP paths.`);
}

run().catch(err => { console.error(err); process.exit(1); });
