import clips from '../assets/approvedTourTamil.json';
export const approvedTourAssetsEnabled=()=>import.meta.env?.VITE_VOICE_TOUR_APPROVED_TAMIL==='true';
export const approvedTamilClip=id=>clips.find(clip=>clip.id===id);
export const approvedTourAsset=(id,lang)=>approvedTourAssetsEnabled()&&lang==='ta'
  ? {url:approvedTamilClip(id)?`${import.meta.env.BASE_URL || './'}audio/kural-tour-ta-v1/${approvedTamilClip(id).file}`:null}
  : undefined;

// Runs on useSpeak's shared queue. Completion means ended, never play() resolution.
export function playApprovedTourAsset(asset,timing={},AudioClass=globalThis.Audio) {
  return new Promise(resolve=>{
    let audio,finished=false,timer;
    const current=()=>!timing.signal?.aborted&&timing.isCurrent?.()!==false;
    const finish=(failed=false)=>{
      if(finished)return;finished=true;clearTimeout(timer);
      timing.signal?.removeEventListener('abort',cancel);
      if(audio){audio.pause();audio.onended=null;audio.onerror=null;audio.onplaying=null;audio.removeAttribute?.('src');audio.load?.();}
      if(failed&&current())timing.onUnavailable?.();
      resolve();
    };
    const cancel=()=>finish();
    const play=()=>{if(!finished&&current()){clearTimeout(timer);timer=setTimeout(()=>finish(true),120000);Promise.resolve(audio.play()).catch(()=>finish(true));}};
    if(!current())return finish();
    if(!asset?.url)return finish(true);
    try{
      audio=new AudioClass(asset.url);
      audio.onended=()=>finish();audio.onerror=()=>finish(true);
      audio.onplaying=()=>{if(timing.isPaused?.()){audio.pause();timing.onAudioPause?.();return;}if(current())timing.onAudioStart?.();else finish();};
      timing.signal?.addEventListener('abort',cancel,{once:true});
      timing.onPlaybackReady?.({pause:()=>{clearTimeout(timer);audio.pause();timing.onAudioPause?.();},resume:play,cancel});
      if(!timing.isPaused?.())play();
    }catch{finish(true);}
  });
}
