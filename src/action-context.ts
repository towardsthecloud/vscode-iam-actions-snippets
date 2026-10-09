import * as vscode from 'vscode';

export interface ActionContext {
  range: vscode.Range;
  prefix: string;
  quote?: string;
  closedQuote: boolean;
  needsComma: boolean;
  commaPosition?: vscode.Position;
}

const actionKeys = new Set(['action', 'notaction', 'actions', 'notactions', 'not_actions']);
const tokenCharacter = /[A-Za-z0-9*?:-]/;

function yamlValueStart(text: string, offset: number): number | undefined {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const line = text.slice(lineStart, offset);
  const scalar = /^\s*(?:-\s*)?(?:Action|NotAction)\s*:\s*/i.exec(line);
  if (scalar) return lineStart + scalar[0].length;
  const item = /^\s*-\s+/.exec(line);
  const indent = /^\s*/.exec(line)![0].length;
  const lines = text.slice(0, lineStart).split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const parent = lines[i];
    if (!parent.trim() || parent.trimStart().startsWith('#')) continue;
    const parentIndent = /^\s*/.exec(parent)![0].length;
    if (parentIndent > indent || (parentIndent === indent && parent.trimStart().startsWith('-'))) continue;
    const key = /^\s*(?:-\s*)?([\w]+)\s*:\s*(?:#.*)?$/.exec(parent);
    if (key && parentIndent <= indent) {
      return actionKeys.has(key[1].toLowerCase()) && item ? lineStart + item[0].length : undefined;
    }
    if (parentIndent <= indent && !parent.trimStart().startsWith('-')) return undefined;
  }
  return undefined;
}

function structuredValue(
  text: string,
  offset: number,
  language: string,
): { start: number; quote?: string; array: boolean } | undefined {
  const frames: Array<{ action: boolean }> = [];
  let key = '';
  let actionValue = false;
  for (let i = 0; i < offset; i++) {
    const char = text[i];
    if (/\s/.test(char)) continue;
    if ((char === '#' && ['python', 'terraform', 'yaml'].includes(language)) || text.slice(i, i + 2) === '//') {
      const end = text.indexOf('\n', i);
      if (end < 0 || end >= offset) return undefined;
      i = end;
      continue;
    }
    if (text.slice(i, i + 2) === '/*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0 || end + 2 > offset) return undefined;
      i = end + 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      const start = i;
      for (i++; i < offset && text[i] !== char; i++) {
        if (text[i] === '\\') i++;
      }
      if (i >= offset) {
        if (char === '`') return undefined;
        return actionValue || frames.at(-1)?.action
          ? { start: start + 1, quote: char, array: !!frames.at(-1)?.action }
          : undefined;
      }
      key = text.slice(start + 1, i);
      actionValue = false;
      continue;
    }
    if (/[\w$-]/.test(char)) {
      const start = i;
      while (i + 1 < offset && /[\w$-]/.test(text[i + 1])) i++;
      key = text.slice(start, i + 1);
      continue;
    }
    if (char === ':' || char === '=') {
      actionValue = actionKeys.has(key.toLowerCase());
      key = '';
    } else if ('[{('.includes(char)) {
      frames.push({ action: char === '[' && actionValue });
      actionValue = false;
      key = '';
    } else if (']})'.includes(char)) {
      frames.pop();
      actionValue = false;
      key = '';
    } else if (char === ',') {
      actionValue = false;
      key = '';
    }
  }
  if (!actionValue && !frames.at(-1)?.action) return undefined;
  let start = offset;
  while (start > 0 && tokenCharacter.test(text[start - 1])) start--;
  if (start > 0 && ['"', "'", '`'].includes(text[start - 1])) return undefined;
  return { start, array: !!frames.at(-1)?.action };
}

export function getActionContext(document: vscode.TextDocument, position: vscode.Position): ActionContext | undefined {
  const text = document.getText();
  const offset = document.offsetAt(position);
  let value;
  if (document.languageId === 'yaml') {
    const flow = structuredValue(text, offset, document.languageId);
    if (flow?.array) {
      value = flow;
    } else {
      const start = yamlValueStart(text, offset);
      if (start === undefined) return undefined;
      const quote = ['"', "'"].includes(text[start]) ? text[start] : undefined;
      value = {
        start: start + (quote ? 1 : 0),
        quote,
        array: /^\s*-/.test(text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset)),
      };
    }
  } else {
    value = structuredValue(text, offset, document.languageId);
  }
  if (!value || !/^[A-Za-z0-9*?:-]*$/.test(text.slice(value.start, offset))) return undefined;
  let end = offset;
  while (end < text.length && tokenCharacter.test(text[end])) end++;
  const closedQuote = !!value.quote && text[end] === value.quote;
  const after = end + (closedQuote ? 1 : 0);
  const next = text.slice(after).trimStart()[0];
  const needsComma =
    value.array && document.languageId !== 'yaml' && next !== undefined && next !== ',' && next !== ']';
  return {
    range: new vscode.Range(document.positionAt(value.start), document.positionAt(end)),
    prefix: text.slice(value.start, offset),
    quote: value.quote,
    closedQuote,
    needsComma,
    commaPosition: needsComma && closedQuote ? document.positionAt(after) : undefined,
  };
}
