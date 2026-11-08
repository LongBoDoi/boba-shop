/* Title motion uses one wrist bend and return, fixed anchors and one continuous sign chain. */
const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const previous=require.extensions['.ts'];
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},fileName:filename,
}).outputText,filename);
try{
 const{fortuneCatPose,FORTUNE_CAT_PERIOD:period,FORTUNE_CAT_FRAMES:frames}=require('../src/ui/fortuneCat.ts');
 const{titleTransform}=require('../src/ui/storefrontMotion.ts');const{SIGN_ANCHOR}=require('../src/ui/storefrontArt.ts');
 let previousFrame=0;const visited=new Set();
 for(let i=0;i<=500;i++){
  const time=i*period/500,{frame}=fortuneCatPose(time);visited.add(frame);
  assert(Number.isInteger(frame)&&frame>=0&&frame<frames,'Only raised-palm-to-folded wrist poses');
  assert.equal(fortuneCatPose(time+period).frame,frame,'The bend loops continuously');
  assert.equal(fortuneCatPose(period-time).frame,frame,'The wrist returns through the same poses');
  if(i>0)assert(i<=250?frame>=previousFrame:frame<=previousFrame,'Exactly one bend and one extension per loop');
  assert(Math.abs(frame-previousFrame)<=1,'No skipped wrist poses');previousFrame=frame;
 }
 assert.equal(visited.size,frames,'The whole simple wrist bend is used');
 assert(frames<=5,'A single simple bend uses a small pose sequence');
 const apply=(m,p)=>({x:m.a*p.x+m.c*p.y+m.tx,y:m.b*p.x+m.d*p.y+m.ty});
 for(const angle of [-.055,0,.055]){
  const matrix=titleTransform(SIGN_ANCHOR,angle),top=apply(matrix,SIGN_ANCHOR),bottom=apply(matrix,{x:166,y:254});
  assert(Math.hypot(top.x-SIGN_ANCHOR.x,top.y-SIGN_ANCHOR.y)<1e-10,'The chain always remains attached to its bracket');
  assert(Math.abs(Math.hypot(bottom.x-top.x,bottom.y-top.y)-42)<1e-10,'The sign and its chain rotate as one rigid object');
 }
 for(const pivot of [{x:808,y:165},{x:685,y:493},{x:195,y:887},{x:1468,y:580}]){
  const root=apply(titleTransform(pivot,.006,1,1.04),pivot);
  assert(Math.hypot(root.x-pivot.x,root.y-pivot.y)<1e-10,'Breathing keeps each cat in contact with its support');
 }
 const{storefrontLayout,storefrontBox,subjectTransform,UPPER_STOREY}=require('../src/ui/storefrontLayout.ts');
 const{skyMotion}=require('../src/ui/storefrontSky.ts');
 const wings=new Set();
 for(let i=0;i<180;i++){
  const p=skyMotion(i/60,1);wings.add(p.wing);
  assert(p.cloudX>=0&&p.cloudX<1&&p.birdX>=0&&p.birdX<1,'Cloud and bird routes wrap outside the viewport');
 }
 assert.equal(wings.size,8,'Birds flap through the full wing cycle');
 assert.notEqual(skyMotion(0,0).cloudX,skyMotion(2,0).cloudX,'Clouds visibly travel across the sky');
 assert.notEqual(skyMotion(0,0).birdX,skyMotion(2,0).birdX,'Birds fly independently of wing motion');
 const subjects=[
  ['roof',{x:605,y:0,w:404,h:180}],['baker',{x:600,y:410,w:166,h:91}],
  ['sleep-left',{x:65,y:742,w:267,h:155}],['sleep-right',{x:1382,y:484,w:178,h:105}],
  ['cup',{x:1427,y:479,w:190,h:400}],['easel',{x:203,y:546,w:257,h:324}],
 ];
 for(const [width,height] of [[329,738],[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1024,768],[1672,941],[2560,1080],[600,610]]){
  const layout=storefrontLayout(width,height);
  {
  const houseRoof=subjectTransform(layout,'upper');
  const peak=houseRoof.ty+UPPER_STOREY.peakY*houseRoof.d;
  assert((layout.floor-peak)/layout.h>(layout.portrait ? .55 : .6),'The shared cottage occupies most of the screen height');
  const roofToFrame=(UPPER_STOREY.baseY-UPPER_STOREY.peakY)*houseRoof.d/(676*layout.shop.d);
  assert(roofToFrame>=.8&&roofToFrame<=.9,'Keep the preferred tall gable');
  const leftOverhang=UPPER_STOREY.wallLeft-UPPER_STOREY.eaveLeft,rightOverhang=UPPER_STOREY.eaveRight-UPPER_STOREY.wallRight;
  assert(Math.abs(leftOverhang-rightOverhang)<=3,'Both roof eaves extend the same amount beyond the walls');
  assert(Math.max(leftOverhang,rightOverhang)<30,'Keep the eave tips close to the wall posts');
  const awning=subjectTransform(layout,'awning');
  assert.equal(awning.a,layout.shop.a,'The centered awning keeps its painted size');
  assert.equal(awning.ty,layout.shop.ty,'The awning remains attached to its beam');
  assert(Math.abs(apply(awning,{x:876.5,y:280}).x-apply(layout.shop,{x:843.5,y:280}).x)<=3*layout.shop.a,
    'The scalloped hem is centered over the two facade posts');
  const canopy=subjectTransform(layout,'canopy');
  assert(canopy.tx/layout.unit<=-30,'The trunk source edge stays outside the screen');
  assert((269*canopy.a+canopy.ty)/layout.unit>70,'A substantial leafy canopy remains visible');
  assert((houseRoof.ty+UPPER_STOREY.peakY*houseRoof.d)/layout.unit>=(layout.portrait ? 55 : 23),'Whole roof and sky fit in both orientations');
  for(const [x,lowerX]of [[UPPER_STOREY.wallLeft,320],[UPPER_STOREY.wallRight,1367]]){
   const a=apply(houseRoof,{x,y:UPPER_STOREY.baseY}),b=apply(layout.shop,{x:lowerX,y:148});
   assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,'Roof walls join both cafe posts without a seam');
  }
  }
  for(const [id,source]of subjects){
   const box=storefrontBox(layout,id,source);
   assert(box.left>=0&&box.top>=-1e-8&&box.left+box.width<=width+.01&&box.top+box.height<=height+.01,`${id} remains visible at ${width}x${height}`);
   assert(Math.abs(box.width/box.height-source.w/source.h)<1e-8,'Subjects keep their original aspect ratios');
   if(layout.portrait)assert(box.top+box.height<height-145,`${id} stays clear of portrait controls`);
  }
  {
   const cup=storefrontBox(layout,'cup',subjects[4][1]),floor=layout.floor/layout.unit;
   const doorPaw=storefrontBox(layout,'door',{x:1187,y:610,w:76,h:75});
   const clear=(a,b)=>a.left>=b.left+b.width||a.left+a.width<=b.left||a.top>=b.top+b.height||a.top+a.height<=b.top;
   for(const part of [{x:1427,y:583,w:190,h:296},{x:1527,y:479,w:49,h:123}]){
    assert(clear(storefrontBox(layout,'cup',part),doorPaw),'The cup and straw clear the lower door artwork');
   }
   assert(cup.top-floor<height*.1,'The shop and foreground do not split across a large empty yard');
   assert(floor>=height*.44,'The shop occupies enough of a portrait screen');
   assert(height-floor<=220,'Keep only a short forecourt below the close storefront');
   assert(layout.upperBottom>layout.shop.ty,'An upper-storey painting fills the area above the original roof');
   if(layout.portrait)assert(1047*layout.shop.a/layout.w>.74,'The close facade fills most of the portrait width');
   const upper=subjectTransform(layout,'upper');
   assert.equal(upper.a,upper.d,'The upper building keeps its own aspect ratio');
   assert(Math.abs(UPPER_STOREY.baseY*upper.d+upper.ty-layout.upperBottom)<1e-8,'Wall tucks behind the original awning');
   for(const [x,lowerX]of [[UPPER_STOREY.wallLeft,320],[UPPER_STOREY.wallRight,1367]]){
    const a=apply(upper,{x,y:UPPER_STOREY.baseY}),b=apply(layout.shop,{x:lowerX,y:148});
    assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,'Roof walls join both cafe posts without a seam');
   }
   assert((upper.ty+UPPER_STOREY.peakY*upper.d)/layout.unit>=(layout.portrait ? 55 : 23),'Whole roof and open sky remain visible');
   for(const id of ['facade','case','door','roof','baker','mat','plant-shelf','pot-shelf','lamp-left','lamp-right']){
    assert.deepEqual(subjectTransform(layout,id),layout.shop,'Keep the original storefront and fixtures on one uniform transform');
   }
   const garden=layout.groups.cup;
   for(const id of ['plant-front','plant-right','pot-front','pot-right','paw-stand']){
    assert.deepEqual(layout.groups[id],garden,'Keep the native cup, plants and round sign as one coherent arrangement');
   }
   const leftCat=storefrontBox(layout,'sleep-left',subjects[2][1]);
   const rightCluster=storefrontBox(layout,'paw-stand',{x:1254,y:735,w:134,h:130});
   assert(rightCluster.left-(leftCat.left+leftCat.width)>Math.min(width*.2,400*layout.shop.a/layout.unit),'Keep an open path between the two garden clusters');
   const perch=layout.groups.bench,sleeper=layout.groups['sleep-right'];
   assert.deepEqual(perch,sleeper,'The sleeping cat stays attached to its supporting ledge');
   assert(garden.a<=layout.shop.a*1.16,'Garden props should remain in proportion to the storefront');
   const pot=storefrontBox(layout,'pot-left',{x:42,y:700,w:134,h:166}),board=storefrontBox(layout,'easel',{x:203,y:546,w:257,h:324});
   assert(pot.left+pot.width<board.left,'The complete left pot clears the easel, including its feet');
   for(const [id,foot]of [['pot-left',866],['pot-front',861],['pot-right',859],['cup',879],['paw-stand',865],['sleep-left',887],['easel',870],['bench',832]]){
    const m=subjectTransform(layout,id),contact=m.d*foot+m.ty;
    assert(Math.abs(contact-layout.floor)<=Math.max(65*layout.shop.a,45*layout.unit),`${id} must stay at the facade foot, not in the middle of the courtyard`);
   }
  }
 }
 console.log('check-title-motion: one wrist bend, fixed contacts, attached sign chain, full subjects in both orientations and undistorted responsive art.');
}finally{if(previous)require.extensions['.ts']=previous;else delete require.extensions['.ts'];}
