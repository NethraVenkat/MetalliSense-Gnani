"""Five generated Tanglish round trips; no action execution."""
import contextlib,io,json,os,sys,tempfile,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'app'))
def main():
 from dotenv import load_dotenv
 load_dotenv(ROOT/'.env')
 from tools.stage1_wake_diagnostic import retry_transport,convert
 from app.copilot import gnani_client
 from app.copilot.provider_calls import post
 out=ROOT/'tools/local_wake_data'/('v23-tanglish-'+uuid.uuid4().hex);out.mkdir(parents=True)
 prompts=[('H-1053 status enna?','heat_status','/premelt-gate'),('latest reading enna','spectrometer_heat_reading','/spectrometer'),('oru reading edu','request_reading','/spectrometer'),('gate check pannu H-1051','gate_check','/premelt-gate'),('spectrometer ku po','open_screen','/dashboard')]
 with tempfile.TemporaryDirectory(prefix='v23-tanglish-agent-') as temp:
  os.environ.update(DATA_DIR=temp,GNANI_TTS_CACHE_DIR=temp,GNANI_MOCK='false',LANG_BRIDGE='false')
  transport=retry_transport(post);gnani_client.provider_post=transport
  with contextlib.redirect_stdout(io.StringIO()):client=gnani_client.GnaniClient()
  rows=[]
  for index,(text,intent,route) in enumerate(prompts):
   payload={'text':text,'model':client.tts_model,'voice':client.tts_voice,'language':'ta-IN','audio_config':{'sample_rate':16000,'encoding':'linear_pcm','num_channels':1,'sample_width':2,'container':'wav'}}
   response=transport(client.base_url+'/api/v1/tts/inference',headers=client._headers(json_body=True),json=payload,timeout=client.tts_timeout_s)
   if response.status_code!=200:raise RuntimeError('TTS HTTP '+str(response.status_code))
   audio=convert(gnani_client._finalize_wav(response.content));(out/f'clip-{index}.wav').write_bytes(audio);time.sleep(1.1)
   result=client.transcribe(audio,'ta-IN,en-IN',max_attempts=1,output_format='codemix')
   if not result.get('success'):raise RuntimeError('STT failed endpoint=/stt/v3')
   rows.append(dict(prompt=text,expected=intent,route=route,transcript=result['text']));(out/'transcripts.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8');time.sleep(1.1)
 print(out/'transcripts.json')
if __name__=='__main__':main()
