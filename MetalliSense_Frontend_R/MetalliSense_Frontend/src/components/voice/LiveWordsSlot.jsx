import React from 'react';
import {liveWordsEnabled} from '../../services/liveWords';
import KuralWords from './KuralWords';
export default function LiveWordsSlot({value,reduced=false}){if(!liveWordsEnabled()||!value?.text)return null;return <div className="kural-live-words" role="status" aria-live="polite"><small>{value.mock?'MOCK — final transcript replay':'Live transcript'}</small><KuralWords text={value.text} mode="listening" reduced={reduced}/></div>;}
