/**
 * Splits a DayZ launch parameter string into arguments.
 *
 * Quotes only group characters; they are removed wherever they appear, so both
 * `"-mod=@A;@B"` and `-mod="@A;@B"` produce `-mod=@A;@B`. The previous regex copies
 * only stripped the outer quotes and turned the second form into `-mod="@A;@B`.
 */
export function splitLaunchParams(params: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  let hasToken = false;
  for (const char of params) {
    if (char === '"') {
      inQuotes = !inQuotes;
      hasToken = true;
      continue;
    }
    if (!inQuotes && /\s/.test(char)) {
      if (hasToken) tokens.push(current);
      current = "";
      hasToken = false;
      continue;
    }
    current += char;
    hasToken = true;
  }
  if (hasToken) tokens.push(current);
  return tokens;
}
