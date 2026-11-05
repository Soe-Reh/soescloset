// Hand retouch per garment. All coordinates are source pixels of assets/raw/<id>.
// cut/keep: polygons forced out of / into the matte. cutLate: after the peel. cutPath: after the clipping path. smooth: {x,y,r,sigma} path clean-up.
// heal: {poly,from:[dx,dy]} clone. tone: {poly,ceil,gain,color} squeeze luma, optionally tinted towards the fabric. grade: overrides. rimFabric: rim only borrows cloth colour.
export default {
  // named grey by the feed: both land on one shared warm neutral instead of keeping the frame's cast
  'casablanca-eveil-marle':{grade:{wb:[0,0.006]}},'ksubi-snow-marle':{grade:{wb:[0,0.006],exposure:-0.015}},
  // near-clipped pale cloth: pull the highlights down so pocket and folds still read on a pale ground
    // the source cloth is clean and soft: the old fold lift and grain were what mottled it. The band on the hood edge is the garment's floral trim, not a stain, so it stays.
  'nahmias-powder-pink':{rim:8,pull:0.7,rimFabric:40,grade:{exposure:-0.03,gMid:1,gFine:1.2,grain:0.003,rim:0.012,burn:0.028,demoire:{lo:2.5,hi:14,tau:0.012,k:0.7}}},
  // exposure only: the shared light landed these a touch under their source fabric
  'essentials-panel-seal':{noGaps:true,grade:{exposure:0.03,gFine:-0.4,kBand:0.45,demoire:{lo:1.5,hi:8,tau:0.07,k:0.45,win:0.3}}},'madhappy-cabernet':{grade:{exposure:0.025}},'madhappy-lakers-grape':{grade:{exposure:0.02}},
  // shadow smudges on the hood crown in the source photo: even them out, pinstripes are not cloth and stay
  'essentials-yankees-pin':{grade:{exposure:0.012,gMid:0.55,clean:true,rim:0.012,burn:0.018,demoire:{lo:6,hi:60,tau:0.08,k:0.95,win:0.3,box:[560,80,1040,440]}}},
  // heavy pique plus wash clouds: the fold lift was amplifying the clouds into a stain
  'ald-marina-crown':{grade:{gMid:1,kLow:0.8,gFine:-0.68,demoire:{lo:14,hi:70,tau:0.028,k:0.85}},heal:[{poly:[2280,2865,2370,2865,2370,2935,2280,2935],from:[0,-100],feather:10}]},
  // the peel and gap steps chewed the right cuff on both: no cast shadow to remove in this studio's vowels shots
  'vowels-blur-yellow':{noGaps:true,rimFabric:120},'vowels-collegiate-green':{noGaps:true,rimFabric:120},
  // ripple in the source photo
  'rhude-desert':{grade:{gFine:-0.42,chroma:{sigma:32},demoire:[{lo:1.4,hi:7,tau:0.02,k:0.95},{lo:7,hi:28,tau:0.012,k:0.85}]}},
  'loewe-cotton-blue':{noGaps:true},
  // exposure only: the source's most common bin sits apart from its median, so the fabric median alone would overshoot the colour cap
  'uniqlo-sweat-oversized-beige':{grade:{exposure:0.012}},'ksubi-kaliba-deep':{grade:{exposure:-0.012}},
  // a studio reflection on the left sleeve above the cuff
  'arcteryx-covert-jade':{grade:{exposure:0.008,gFine:-0.42,kBand:0.2,destripe:{len:240,lo:4,hi:30,tau:0.03,k:0.95},demoire:{lo:1.8,hi:10,tau:0.08,k:0.55,win:0.3}},heal:[{poly:[396,1585,446,1585,452,1690,398,1690],from:[70,0],feather:7}]},
  // 600px sources: smooth fleece, so no grain floor and no sharpening; both invented a heathered texture and lifted compression blocks
  'hollister-boxy-black':{grade:{gFine:0,grain:0}},
  // same, plus an olive AVIF chroma blotch on the left sleeve that is not in the garment
  'abercrombie-essential-popover-black':{grade:{gFine:0,grain:0},neutral:[{poly:[95,185,150,215,150,620,110,695,25,645,25,500],feather:12},{poly:[135,585,470,585,470,665,135,665],feather:10}]},
  // a lint speck on the pocket
  'lucid-heather-grey':{heal:[{poly:[1537,2481,1561,2481,1561,2505,1537,2505],from:[60,0],feather:5}]},
};
