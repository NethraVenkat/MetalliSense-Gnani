// Meter the existing PTT stream only. Never requests a microphone or records PCM.
export function attachMicLevel(stream,onLevel,{Context=globalThis.AudioContext||globalThis.webkitAudioContext,requestFrame=globalThis.requestAnimationFrame,cancelFrame=globalThis.cancelAnimationFrame}={}){
 if(!Context||!requestFrame)return()=>{};
 let context,source,analyser,frame,stopped=false,last=0;
 const stop=()=>{if(stopped)return;stopped=true;cancelFrame?.(frame);try{source?.disconnect();analyser?.disconnect();}catch{/* disconnected */}void context?.close().catch(()=>{});onLevel(0);};
 try{context=new Context();source=context.createMediaStreamSource(stream);analyser=context.createAnalyser();analyser.fftSize=256;source.connect(analyser);const values=new Float32Array(256);
 const sample=at=>{if(stopped)return;if(at-last>=80){last=at;analyser.getFloatTimeDomainData(values);onLevel(Math.min(1,8*Math.sqrt(values.reduce((n,x)=>n+x*x,0)/values.length)));}frame=requestFrame(sample);};
 void context.resume().catch(stop);frame=requestFrame(sample);return stop;
 }catch{stop();return()=>{};}
}
