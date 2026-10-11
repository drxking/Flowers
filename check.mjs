import assert from 'node:assert/strict';
import {isPointing, flowerCluster} from './dist/engine.mjs';
const cluster=flowerCluster(20,'red',['red','pink','blue','green','purple'],()=>0.5);
assert.equal(cluster.length,5,'Each stamp contains five flowers');
assert.equal(cluster[0].size,20,'Main flower is normal sized');
assert.equal(cluster[0].color,'red','Main flower respects selected color');
assert.ok(cluster.slice(1).every(b=>b.size<20),'Companion flowers have smaller sizes');
assert.equal(new Set(cluster.map(b=>b.color)).size,5,'Cluster mixes different colors');
assert.ok(cluster.slice(1).every(b=>Math.hypot(b.x,b.y)>0),'Companions surround the main flower');
const hand = Array.from({length:21},()=>({x:0,y:0,z:0}));
hand[5]={x:0,y:.4}; hand[6]={x:0,y:.6}; hand[8]={x:0,y:1};
const otherFingers = [[9,10,12],[13,14,16],[17,18,20]];
for (const [i, [base,joint,tip]] of otherFingers.entries()) {
  const x=(i+1)*.1;
  hand[base]={x,y:.4}; hand[joint]={x,y:.6}; hand[tip]={x:x+.03,y:.3};
}
assert.equal(isPointing(hand),true,'Only the index extended draws');
for (const [base,joint,tip] of otherFingers) {
  const raised=hand.map(p=>({...p}));
  raised[tip]={x:raised[joint].x,y:1};
  assert.equal(isPointing(raised),false,`Raising finger at landmark ${base} stops drawing`);
}
const openPalm=hand.map(p=>({...p}));
for (const [,joint,tip] of otherFingers) openPalm[tip]={x:openPalm[joint].x,y:1};
assert.equal(isPointing(openPalm),false,'Open palm does not draw');
const uncertain=hand.map(p=>({...p})); uncertain[12]={...uncertain[10]};
assert.equal(isPointing(uncertain),false,'Unclear finger position does not draw');
const rotated=hand.map(p=>({x:p.y,y:-p.x}));
assert.equal(isPointing(rotated),true,'Pointing works when the hand rotates');
for (const scale of [.2,2]) assert.equal(isPointing(hand.map(p=>({x:p.x*scale,y:p.y*scale,z:(p.z ?? 0)*scale}))),true,'Pointing works at different distances');
hand[8]={x:.1,y:.35}; assert.equal(isPointing(hand),false,'Bent index stops');
assert.equal(isPointing(Array.from({length:21},()=>({x:0,y:0}))),false);
assert.equal(isPointing(null),false);
assert.equal(isPointing([]),false);

// Exercise actual app event handlers with a minimal DOM and canvas substitute.
let petals=0, clears=0, saved=false;
const rendered=[];
const context={save(){},restore(){},translate(){},rotate(){},beginPath(){},ellipse(x,y,rx,ry){petals++;rendered.push([rx,ry,this.fillStyle]);},fill(){},arc(){},clearRect(){clears++;},fillRect(){},drawImage(){},scale(){}};
class Element {
  constructor(){this.listeners={};this.children=[];this.attrs={};this.style={setProperty(){}};this.classList={toggle(){},add(){},remove(){}};this.width=1280;this.height=960;this.disabled=false;this.hidden=false;}
  addEventListener(name, fn){this.listeners[name]=fn;}
  setAttribute(name, value){this.attrs[name]=value;}
  append(child){this.children.push(child);}
  getContext(){return context;}
  getBoundingClientRect(){return {left:0,top:0,width:640,height:480};}
  setPointerCapture(){}
  toDataURL(){return 'data:image/png;base64,test';}
  click(){saved=true;}
}
const elements=new Map();
globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement(){return new Element();},addEventListener(){}};
globalThis.window={addEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});}}},configurable:true});
await import('./dist/app.mjs');
const get=id=>elements.get(id);
get('try').listeners.click(); assert.equal(get('welcome').hidden,true);
const canvas=get('canvas');
canvas.listeners.pointerdown({pointerId:1,pointerType:'mouse',button:0,clientX:50,clientY:50});
const initial=petals; assert.equal(initial,30);
assert.equal(new Set(rendered.map(p=>p[2])).size,5,'Actual canvas stamp has mixed colors');
assert.ok(new Set(rendered.map(p=>p[0])).size>1,'Actual canvas stamp has mixed sizes');
canvas.listeners.pointermove({pointerId:1,clientX:50,clientY:50}); assert.equal(petals,initial,'Stationary pointer does not pile up flowers');
canvas.listeners.pointermove({pointerId:1,clientX:150,clientY:50}); assert.ok(petals>initial,'Moving pointer creates a trail');
canvas.listeners.pointerup(); assert.equal(get('save').disabled,false);
get('save').listeners.click(); assert.equal(saved,true);
const firstStroke=rendered.slice();
canvas.listeners.pointerdown({pointerId:3,pointerType:'mouse',button:0,clientX:200,clientY:200});
canvas.listeners.pointerup();
const beforeRedraw=rendered.length;
get('undo').listeners.click();
assert.deepEqual(rendered.slice(beforeRedraw),firstStroke,'Redraw preserves cluster colors and sizes');
get('undo').listeners.click(); assert.equal(get('save').disabled,true,'Undo removes the whole stroke');
canvas.listeners.pointerdown({pointerId:2,pointerType:'touch',clientX:100,clientY:50});
get('clear').listeners.click(); assert.equal(get('save').disabled,true); assert.ok(clears>0);
get('palette').children[2].listeners.click(); assert.equal(get('palette').children[2].attrs['aria-pressed'],'true');
await get('start').listeners.click();
assert.match(get('error').textContent,/permission was denied/);
assert.equal(get('start').disabled,false,'Camera can be retried after permission denial');
assert.equal(get('error').hidden,false);
console.log('Passed: mixed flower clusters, stable redraw, gestures, rotation, mouse/touch drawing, stationary pointer, undo, clear, palette, PNG export, and camera permission recovery.');
