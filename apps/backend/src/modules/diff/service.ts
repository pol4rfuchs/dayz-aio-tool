export type DiffLine = { type: "same" | "add" | "remove"; line: string; oldLine?: number; newLine?: number };

const MAX_LCS_CELLS = 250_000;

function lcsDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      out.push({ type: "same", line: oldLines[i], oldLine: oldNo++, newLine: newNo++ });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "remove", line: oldLines[i], oldLine: oldNo++ });
      i++;
    } else {
      out.push({ type: "add", line: newLines[j], newLine: newNo++ });
      j++;
    }
  }
  while (i < m) out.push({ type: "remove", line: oldLines[i++], oldLine: oldNo++ });
  while (j < n) out.push({ type: "add", line: newLines[j++], newLine: newNo++ });
  return out;
}

function linearFallbackDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;

  let oldSuffix = oldLines.length - 1;
  let newSuffix = newLines.length - 1;
  while (oldSuffix >= prefix && newSuffix >= prefix && oldLines[oldSuffix] === newLines[newSuffix]) {
    oldSuffix--;
    newSuffix--;
  }

  const out: DiffLine[] = [];
  let oldNo = 1;
  let newNo = 1;
  for (let i = 0; i < prefix; i++) out.push({ type: "same", line: oldLines[i], oldLine: oldNo++, newLine: newNo++ });
  for (let i = prefix; i <= oldSuffix; i++) out.push({ type: "remove", line: oldLines[i], oldLine: oldNo++ });
  for (let j = prefix; j <= newSuffix; j++) out.push({ type: "add", line: newLines[j], newLine: newNo++ });

  const suffixStartOld = oldSuffix + 1;
  const suffixStartNew = newSuffix + 1;
  oldNo = suffixStartOld + 1;
  newNo = suffixStartNew + 1;
  for (let i = suffixStartOld, j = suffixStartNew; i < oldLines.length && j < newLines.length; i++, j++) {
    out.push({ type: "same", line: oldLines[i], oldLine: oldNo++, newLine: newNo++ });
  }
  return out;
}

export function lineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  const cells = oldLines.length * newLines.length;
  if (cells <= MAX_LCS_CELLS) return lcsDiff(oldLines, newLines);
  return linearFallbackDiff(oldLines, newLines);
}
