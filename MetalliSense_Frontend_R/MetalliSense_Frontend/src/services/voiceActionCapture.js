import {captureRunReply} from './runReplyCapture';
// Shared readiness; only RUN uses the short yes/no gate and utterance limit.
export function captureActionReply(options,onLevel=()=>{},dependencies={}){
 return captureRunReply({...options,runConfirmation:options.runConfirmation===true},onLevel,dependencies);
}
