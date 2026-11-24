// Shared motion helpers (round 3). Frame-rate independent damping in the style of maath easing.damp: the same pull per second at 30, 60 or 120 fps.
// dt is in seconds and capped at 1/30, so a stalled frame never makes anything leap.
export const MAXDT=1/30;
export const sec=ms=>Math.min(MAXDT,Math.max(0,ms/1000));
// The fraction of the remaining distance covered in dt at rate lambda (per second).
export const dk=(lambda,dt)=>1-Math.exp(-lambda*Math.min(MAXDT,Math.max(0,dt)));
export const damp=(x,target,lambda,dt)=>x+(target-x)*dk(lambda,dt);
// Past an edge a pull moves the thing at a quarter of the hand's speed, as shoe-finder's rig does.
export const RUBBER=.25,rubber=(v,a,b,r=RUBBER)=>v<a?a-(a-v)*r:v>b?b+(v-b)*r:v;
// Velocity tilt and grab scale shared by everything you can drag: degrees per 1000 px/s, capped, and a 2% lift while held.
export const TILT=.08*180/Math.PI/1000,TILT_MAX=10,GRAB=1.02;
// Wheel deltas in pixels, whatever unit the device reports (Lenis normalises the same way).
export const wheelPx=(e,page=innerHeight)=>{const k=e.deltaMode===1?16:e.deltaMode===2?page:1;return [e.deltaX*k,e.deltaY*k]};

// self-check: two half steps land where one whole step does, so the feel does not depend on the frame rate
{const a=damp(damp(0,100,9,.008),100,9,.008),b=damp(0,100,9,.016);console.assert(Math.abs(a-b)<1e-9,'damp is not frame-rate independent');
 console.assert(rubber(-40,0,10)===-10&&rubber(50,0,10)===20&&rubber(5,0,10)===5,'rubber');}
