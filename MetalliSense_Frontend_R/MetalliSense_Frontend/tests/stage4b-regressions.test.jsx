import React from 'react';
import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import RecommendationReasoning from '../src/components/common/RecommendationReasoning';
import {anomalyGateReading,anomalyPageState,readingTimestamp} from '../src/services/gateReading';
import {menuViewportTop,collisionOffset} from '../src/components/voice/KuralWakePanel';

it('gate-derived anomaly reading retains the gate timestamp and composition without inventing a new measurement',()=>{
 const flow={grade:'SG-IRON',predictedComposition:{C:3.31},gateId:'G-TEST',passedAt:'2026-11-12T10:00:00Z'};
 const reading=anomalyGateReading(flow);
 expect(reading.timestamp).toBe(flow.passedAt);
 expect(reading.composition).toBe(flow.predictedComposition);
 expect(reading.source).toBe('gate_prediction_G-TEST');
 expect(readingTimestamp(reading.timestamp)).not.toBe('Invalid Date');
 expect(anomalyGateReading({...flow,passedAt:null}).timestamp).toBeNull();
 expect(readingTimestamp(null)).toBe('Not available');
 expect(readingTimestamp('bad timestamp')).toBe('Not available');
});
it('collision-raised menu remains inside the viewport and ready orb uses its own footprint',()=>{
 expect(menuViewportTop(280,400,720)).toBe(24);
 expect(menuViewportTop(800,400,900)).toBe(388);
 const ready={left:664,right:744,top:796,bottom:876};
 expect(collisionOffset(ready,[{left:600,right:750,top:400,bottom:500}],900)).toBe(0);
 const top=menuViewportTop(280,600,768);expect(top).toBeGreaterThanOrEqual(24);expect(top+600).toBeLessThanOrEqual(744);
});
it('revisiting anomaly restores its existing result and reading without rerunning prediction',()=>{
 const reading={metalGrade:'SG-IRON',composition:{C:3.31},timestamp:'2026-11-12T10:00:00Z'};
 const result={severity:'LOW',_reading:reading};
 const state=anomalyPageState({heatId:'TEST-HEAT',anomalyResult:result});
 expect(state.result).toBe(result);expect(state.reading).toBe(reading);
 expect(anomalyPageState({anomalyResult:result})).toEqual({result:null,reading:null});
});
it('recommendation reasoning remains reachable without an applied-deviation list',()=>{
 const html=renderToStaticMarkup(<RecommendationReasoning loadingExplanation={false} handleGetAIExplanation={()=>{}}/>);
 expect(html).toContain('Get AI Reasoning');
 expect(html).not.toContain('disabled=""');
});
it('recommendation reasoning keeps existing loading and regeneration behavior',()=>{
 const html=renderToStaticMarkup(<RecommendationReasoning loadingExplanation aiExplanation="Retained explanation"/>);
 expect(html).toContain('disabled=""');
 expect(html).toContain('Regenerate AI Reasoning');
 expect(html).toContain('Retained explanation');
});
