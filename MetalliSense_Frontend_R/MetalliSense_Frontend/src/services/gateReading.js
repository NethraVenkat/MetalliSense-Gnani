// A gate prediction is not a new measurement. Retain its actual gate time.
export function anomalyGateReading(flow) {
 return {metalGrade:flow.grade,composition:flow.predictedComposition,
  temperature:1480,pressure:1,source:`gate_prediction_${flow.gateId}`,
  timestamp:flow.passedAt||null};
}
export function readingTimestamp(value) {
 const parsed=value?new Date(value):null;
 return parsed&&Number.isFinite(parsed.getTime())?parsed.toLocaleString():'Not available';
}
export function anomalyPageState(flow) {
 const result=flow.heatId?flow.anomalyResult:null;
 return {result:result||null,reading:result?(result._reading||anomalyGateReading(flow)):null};
}
