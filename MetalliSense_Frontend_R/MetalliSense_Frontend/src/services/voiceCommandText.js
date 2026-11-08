import {normalizeSpokenNumbers} from './spokenNumbers';
export function normalizeCommandText(text){
 let value=String(text||'').normalize('NFKC').toLowerCase()
  .replace(/\b(connect|disconnect)\s+the\s+/gu,'$1 ')
  .replace(/\b(approve|reject)\s+(?:the\s+)?(?:selected|this)\s+(?:pr|purchase request)\b/gu,'$1 pr')
  .replace(/\b(approve|reject)\s+(?:the\s+)?selected one\b/gu,'$1 pr')
  .replace(/\bp\s+r\b/gu,'pr');
 value=normalizeSpokenNumbers(value)
  .replace(/(?:பி\s*ஆர்|पी\s*आर)(?=\s*\d)/gu,'pr')
  .replace(/\b(pr|h|qa)(?=\d)/gu,'$1 ')
  .replace(/(?<!\d)\.|\.(?!\d)|[!?।]/gu,'').replace(/\s+/g,' ').trim();
 return value;
}
