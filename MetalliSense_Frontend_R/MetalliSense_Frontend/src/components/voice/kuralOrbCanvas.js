// Approved final draw functions ported from docs/design/kural-orb-reference.html.
export const orbPaletteKey=state=>({waiting:'ready',listening:'listen',processing:'think',speaking:'speak',error:'err',unavailable:'err'})[state]||'off';
export const ORB_PALETTE={
  ready:{c:['rgb(14,138,85)','rgb(61,220,147)','rgb(185,245,212)'],rim:'#063f28',bar:'#b9ffd9',gl:'#5cf0a8'},
  off:{c:['rgb(10,92,58)','rgb(36,150,100)','rgb(120,200,160)'],rim:'#042a1a',bar:'#9fe8c2',gl:'rgba(92,240,168,.5)'},
  err:{c:['rgb(181,112,28)','rgb(240,169,74)','rgb(255,225,176)'],rim:'#5a3608',bar:'#ffe7c2',gl:'#f0a94a'}
};
export function drawOrb(o,time=0,level=0,{card=false,reduced=false}={}){
 const B=.9,BW=.7,OW=.15,t=reduced?0:time,P=ORB_PALETTE;
 const lvl=()=>reduced?0:Math.max(0,Math.min(1,Number(level)||0));
function orb(x,W,R,pal,spd,dark){
  const cx=W/2,cy=W/2,C=pal.c,tt=t*spd;
  x.save();x.beginPath();x.arc(cx,cy,R,0,Math.PI*2);x.clip();
  const b=x.createRadialGradient(cx-R*.3,cy-R*.35,R*.1,cx,cy,R*1.05);
  b.addColorStop(0,C[1]);b.addColorStop(.55,C[0]);b.addColorStop(1,dark?'#04261a':pal.rim);
  x.fillStyle=b;x.fillRect(0,0,W,W);
  x.globalCompositeOperation='screen';x.filter=`blur(${W*.045}px)`;
  [[0,C[2],.42],[2.1,C[1],.5],[4.2,C[2],.36],[1,C[1],.3]].forEach(([ph,c2,r],i)=>{
    const a=tt*(.6+i*.17)+ph,bb=tt*(.43+i*.11)+ph*1.3;
    const lx=cx+Math.cos(a)*R*.45,ly=cy+Math.sin(bb)*R*.42;
    const g=x.createRadialGradient(lx,ly,0,lx,ly,R*r);g.addColorStop(0,c2);g.addColorStop(1,'rgba(0,0,0,0)');
    x.globalAlpha=.85;x.fillStyle=g;x.fillRect(0,0,W,W)});
  x.filter='none';x.globalAlpha=1;x.globalCompositeOperation='source-over';
  const sh=x.createRadialGradient(cx+R*.35,cy+R*.45,R*.2,cx,cy,R*1.05);
  sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,20,10,.45)');x.fillStyle=sh;x.fillRect(0,0,W,W);x.restore();
  x.lineWidth=W*.008;x.strokeStyle=`rgba(255,255,255,${dark?.35:.55})`;x.beginPath();x.arc(cx,cy,R,0,Math.PI*2);x.stroke();
}
function hl(x,W,R){const cx=W/2,cy=W/2;const g=x.createRadialGradient(cx-R*.38,cy-R*.45,0,cx-R*.38,cy-R*.45,R*.38);
  g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;
  x.beginPath();x.ellipse(cx-R*.36,cy-R*.44,R*.3,R*.17,-.6,0,Math.PI*2);x.fill()}
function bars(x,W,R,s,pal){
  const cx=W/2,cy=W/2,n=5,gap=R*.2*B,bw=R*.11*B,base=[.35,.6,.9,.6,.35];
  x.save();x.lineCap='round';x.lineWidth=bw;x.strokeStyle=pal.bar;x.shadowColor=pal.gl;x.shadowBlur=W*.06;
  for(let i=0;i<n;i++){const k=i-2;let h;
    if(s==='ready'){const tr=Math.sin(t*5-i*.9)*.5+.5;h=R*B*(base[i]*.55*(1-BW*.35)+BW*.55*base[i]*tr+.06)}
    else if(s==='listen'){const v=lvl();h=R*B*(.08+base[i]*(.25+.6*v*(.5+.5*Math.abs(Math.sin(t*9+i*1.7)))))}
    else if(s==='think'){const p=((t*1.6)%1)*7-1;const d=Math.max(0,1-Math.abs(i-p));h=R*B*(.08+.35*d)}
    else if(s==='speak'){const p=Math.sin(t*7)*.5+.5;h=R*B*(.1+base[i]*.5*p)}
    else h=R*B*.06;
    x.beginPath();x.moveTo(cx+k*gap,cy-h);x.lineTo(cx+k*gap,cy+h);x.stroke()}
  x.restore()}
function waves(x,W,R){const cx=W/2,cy=W/2;for(let k=0;k<3;k++){const p=((t*.55+k/3)%1);
  x.strokeStyle=`rgba(92,240,168,${(1-p)*.5})`;x.lineWidth=W*.008;x.beginPath();x.arc(cx,cy,R*(1.02+p*.16),0,Math.PI*2);x.stroke()}}
function ribbons(x,W){const cy=W/2;x.save();x.beginPath();x.arc(W/2,cy,W*.42,0,Math.PI*2);x.clip();
  for(let k=0;k<5;k++){x.beginPath();
    for(let i=0;i<=40;i++){const px=i/40*W;const y=cy+Math.sin(i/40*Math.PI*2*1.2+t*(2+k*.3)+k)*W*(.1+k*.02)*Math.sin(i/40*Math.PI);i?x.lineTo(px,y):x.moveTo(px,y)}
    for(let i=40;i>=0;i--){const px=i/40*W;const y=cy+Math.sin(i/40*Math.PI*2*1.2+t*(2+k*.3)+k+.5)*W*(.1+k*.02)*Math.sin(i/40*Math.PI)+W*.03*Math.sin(i/40*Math.PI);x.lineTo(px,y)}
    x.closePath();x.fillStyle=`rgba(${k%2?'185,255,217':'92,240,168'},.35)`;x.fill()}
  x.restore()}
function frame({c,x,s,dark}){
  const W=c.width;x.clearRect(0,0,W,W);
  const pal=s==='off'?P.off:s==='err'?P.err:P.ready;
  const w=Math.sin(t*2.2)*.6+Math.sin(t*3.7+1)*.4;let R;
  if(s==='off')R=W*.42*(1+Math.sin(t*.9)*.02);
  else if(s==='err')R=W*.42;
  else{R=W*.42*(1-OW/2+OW/2*(w+1));if(s==='listen')R*=1+lvl()*.04}
  orb(x,W,R,pal,s==='off'?.25:s==='err'?0:1,dark);
  if(s==='speak')waves(x,W,R);
  if(s==='think'&&card)ribbons(x,W);else bars(x,W,R,s,pal);
  hl(x,W,R)}
 frame(o);
}
