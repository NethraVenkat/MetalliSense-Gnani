// Test-only audio selection. Private fixture audio is never an ordinary queue item.
export function selectFixtureAudioLabel(prompt,privateCapture,queued='silence'){
 if(privateCapture)return 'approval';
 if(/materialType|Material type/.test(prompt))return 'material';
 if(/receivedKg|Received kg/.test(prompt))return 'weight';
 return queued==='approval'?'silence':queued;
}
export function publicFixtureTranscript(value){
 const text=String(value||'');
 return /receive|truck|lot|iron|kilo|ton/i.test(text)&&!/(?<!\d)\d(?:[\s.,-]*\d){5}(?!\d)/.test(text)?text:'[response omitted]';
}
