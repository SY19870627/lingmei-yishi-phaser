#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_FILES = [
  {
    file: 'assets/data/spirits.json',
    backgroundField: '背景'
  },
  {
    file: 'assets/data/anchors.json',
    backgroundField: null
  }
];

let hasErrors = false;
let hasWarnings = false;

const logError = (message) => {
  hasErrors = true;
  console.error(`\uD83D\uDD34 ${message}`); // 🔴
};

const logWarning = (message) => {
  hasWarnings = true;
  console.warn(`\uD83D\uDFE1 ${message}`); // 🟡
};

function resolveFile(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}

function getUniqueKeys(entry) {
  const constraint = entry?.限制?.唯一性鍵;
  if (Array.isArray(constraint) && constraint.length > 0) {
    return constraint;
  }
  return ['id'];
}

function buildKeyDescriptor(entry, keys) {
  return keys
    .map((key) => `${key}=${String(entry?.[key] ?? '未填')}`)
    .join(', ');
}

function buildKey(entry, keys) {
  const keyValues = keys.map((key) => JSON.stringify(entry?.[key] ?? null));
  return `${keys.join('|')}::${keyValues.join('|')}`;
}

function sanitizeBackground(text) {
  if (!text) {
    return '';
  }
  return text
    .toString()
    .normalize('NFKC')
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}

function buildShingleSet(text, size = 3) {
  if (text.length < size) {
    return new Set();
  }
  const shingles = new Set();
  for (let i = 0; i <= text.length - size; i += 1) {
    shingles.add(text.slice(i, i + size));
  }
  return shingles;
}

function jaccardIndex(setA, setB) {
  if (setA.size === 0 && setB.size === 0) {
    return 0;
  }
  let intersection = 0;
  const union = new Set(setA);
  for (const item of setB) {
    if (setA.has(item)) {
      intersection += 1;
    }
    union.add(item);
  }
  return union.size === 0 ? 0 : intersection / union.size;
}

function checkUniqueness(data, fileLabel) {
  const seen = new Map();
  for (const entry of data) {
    const uniqueKeys = getUniqueKeys(entry);
    const bucketKey = buildKey(entry, uniqueKeys);
    const bucket = seen.get(bucketKey) ?? [];
    bucket.push(entry);
    seen.set(bucketKey, bucket);
  }

  for (const bucket of seen.values()) {
    if (bucket.length > 1) {
      const keys = getUniqueKeys(bucket[0]);
      const descriptor = buildKeyDescriptor(bucket[0], keys);
      const ids = bucket.map((item) => item?.id ?? '(無 id)').join(', ');
      logError(`${fileLabel} 重複條目 (${descriptor}) -> ids: ${ids}`);
    }
  }
}

function checkSimilarity(data, fileLabel, field) {
  if (!field) {
    return;
  }

  const processed = data
    .map((entry) => ({
      id: entry?.id ?? '(無 id)',
      text: sanitizeBackground(entry?.[field])
    }))
    .filter((item) => item.text.length >= 3);

  for (let i = 0; i < processed.length; i += 1) {
    for (let j = i + 1; j < processed.length; j += 1) {
      const left = processed[i];
      const right = processed[j];
      const leftSet = buildShingleSet(left.text);
      const rightSet = buildShingleSet(right.text);
      if (leftSet.size === 0 || rightSet.size === 0) {
        continue;
      }
      const score = jaccardIndex(leftSet, rightSet);
      if (score > 0.8) {
        logWarning(
          `${fileLabel} 背景近似 (${left.id} vs ${right.id}) -> Jaccard=${score.toFixed(2)}`
        );
      }
    }
  }
}

async function main() {
  for (const { file, backgroundField } of DATA_FILES) {
    const filePath = resolveFile(file);
    let raw;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch (error) {
      logError(`${file} 無法讀取: ${error.message ?? error}`);
      continue;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      logError(`${file} JSON 解析失敗: ${error.message ?? error}`);
      continue;
    }

    if (!Array.isArray(data)) {
      logError(`${file} 應為陣列`);
      continue;
    }

    checkUniqueness(data, file);
    checkSimilarity(data, file, backgroundField);
  }

  if (!hasErrors && !hasWarnings) {
    console.log('\uD83D\uDFE2 資料檢查通過'); // 🟢
  }

  if (hasErrors) {
    process.exitCode = 1;
  }
}

main();
