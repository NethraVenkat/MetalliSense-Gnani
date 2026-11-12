import {afterEach,it,expect,vi} from 'vitest';
import {registeredVoiceAction,prepareVoiceAction} from '../src/services/voiceActionRegistry';
import {createTranscriptHandler} from '../src/services/voiceTranscript';
afterEach(()=>vi.unstubAllEnvs());

it.each(['gate check pannu H-1051','run gate check for H-1051','கேட் செக் பண்ணு H-1051','gate check करो H-1051','गेट चेक करो H-1051'])('dispatches %s to the gate service with the explicit loaded heat',async text=>{
 const runGateCheck=vi.fn().mockResolvedValue({status:200,data:{data:{heatId:'H-1051',decision:'GO'}}});
 const context={route:'/premelt-gate',selected:{heatId:'H-1053'},loaded:{heats:[{heatId:'H-1051',status:'PLANNED'},{heatId:'H-1053',status:'PLANNED'}]},notifyAction:vi.fn()};
 expect(registeredVoiceAction(text,context.route)?.id).toBe('gate_check');
 const action=prepareVoiceAction(text,context,{runGateCheck});
 expect(action.level).toBe('ASK');await action.precheck();await action.execute({});
 expect(runGateCheck).toHaveBeenCalledExactlyOnceWith('H-1051','Melt shop');
 expect(context.notifyAction).toHaveBeenCalledWith({id:'gate_check',data:{heatId:'H-1051',decision:'GO'}});
});

it('hands receiving to Stock without waiting for a navigation speech or provider answer',async()=>{
 vi.stubEnv('VITE_VOICE_ACTIONS','true');
 const queueAction=vi.fn(),say=vi.fn(),actionControl=vi.fn().mockResolvedValue(false);
 const handler=createTranscriptHandler({lang:'hi',setHeard:()=>{},say,actionControl,pageContext:{route:'/dashboard',queueAction},navigate:vi.fn()});
 await handler('truck receive करो');
 expect(queueAction).toHaveBeenCalledWith(expect.objectContaining({id:'receive_lot',page:'/raw-material-stock',text:'truck receive करो'}));
 expect(say).not.toHaveBeenCalled();
});
