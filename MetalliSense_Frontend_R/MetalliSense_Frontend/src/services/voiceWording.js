export function holdStartMessage(heat,lang='en'){
 return {en:`${heat} is on HOLD. Normal start is blocked. A Unit Controller can say 'hold override start'.`,ta:`${heat} HOLD நிலையில் உள்ளது. வழக்கமான தொடக்கம் தடுக்கப்பட்டுள்ளது. Unit Controller 'hold override start' என்று சொல்லலாம்.`,hi:`${heat} HOLD पर है। सामान्य शुरुआत अवरुद्ध है। Unit Controller 'hold override start' बोल सकते हैं।`}[lang]||holdStartMessage(heat,'en');
}
export function spokenOnly(text){
 return String(text??'').replace(/\s*\((?:see|view|check)\s+(?:the\s+)?(?:details|page|screen)[^)]*\)/giu,'')
  .replace(/(?:[;,]\s*)?(?:see|view|check)\s+(?:the\s+)?(?:details|page|screen)(?:\s+for\s+(?:more\s+)?details)?[.!]?/giu,'')
  .replace(/\s{2,}/g,' ').trim();
}
