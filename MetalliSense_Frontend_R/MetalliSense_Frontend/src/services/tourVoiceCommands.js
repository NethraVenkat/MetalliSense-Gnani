export const tourVoiceCommandsEnabled=()=>import.meta.env?.VITE_VOICE_TOUR_COMMANDS==='true';
const groups={
 'voice-next':['அடுத்து','அடுத்து போ','அடுத்த பக்கம் போ','aduthu po','next','go next','आगे जाओ','अगला पेज'],
 'voice-back':['பின்னாடி போ','முந்தைய பக்கம் போ','pinnadi po','go back','previous page','पीछे जाओ'],
 'voice-pause':['நிறுத்து','கொஞ்சம் நிறுத்து','niruthu','pause','pause pannu','रुको'],
 'voice-continue':['தொடரு','continue பண்ணு','resume பண்ணு','thodaru','continue','resume','जारी रखो'],
 stop:['tour முடி','டூர் முடி','tour mudichidu','close tour','exit tour','टूर बंद करो'],
};
export function prefixedTourCommand(value){
 const text=String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
 const prefix=text.match(/^(?:குரல்|kural)\s+(.+)$/u);
 if(!prefix)return null;
 return Object.entries(groups).find(([,phrases])=>phrases.includes(prefix[1]))?.[0]||null;
}
