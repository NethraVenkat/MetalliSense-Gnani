export function scale(s,x){return x.map((v,i)=>(v-s.mean[i])/s.scale[i]);}
export function leaf(t,x){let node=0,depth=0;while(t.left[node]!==-1){node=Math.fround(x[t.feature[node]])<=t.threshold[node]?t.left[node]:t.right[node];depth++;}return {node,depth};}
export function evaluate(m,x){if(m.kind==='linear')return m.coef.reduce((sum,v,i)=>sum+v*x[i],m.intercept[0]);if(m.kind==='multi')return m.models.map(t=>evaluate(t,x));if(m.kind==='boost')return m.initial+m.rate*m.trees.reduce((sum,t)=>sum+t.value[leaf(t,x).node][0],0);throw new Error('Unsupported model '+m.kind);}
const averagePath=n=>n<=1?0:n===2?1:2*(Math.log(n-1)+0.5772156649015329)-2*(n-1)/n;
export function isolation(m,x){const depth=m.trees.reduce((s,t,i)=>{const l=leaf(t,m.features[i].map(j=>x[j]));return s+l.depth+averagePath(t.samples[l.node]);},0)/m.trees.length;return -Math.pow(2,-depth/averagePath(m.maxSamples));}
