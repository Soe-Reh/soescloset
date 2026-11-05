import sharp from 'sharp';
// grid of transparent images over bg colour, labelled; used for QA and research/contact.png
export async function sheet(files, out, {bg='#f3f1ec',cols=6,cell=480,labels=null,pad=10,under=null}={}) {
  const rows=Math.ceil(files.length/cols), W=cols*(cell+pad)+pad, H=rows*(cell+pad)+pad;
  const comps=[];
  for (let i=0;i<files.length;i++){
    const x=pad+(i%cols)*(cell+pad), y=pad+Math.floor(i/cols)*(cell+pad);
    if(under) comps.push({input:await sharp(under[i]).resize(cell,cell).png().toBuffer(),left:x,top:y});
    comps.push({input:await sharp(files[i]).resize(cell,cell,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(),left:x,top:y});
    if(labels) comps.push({input:Buffer.from(`<svg width="${cell}" height="24"><text x="2" y="16" font-family="Helvetica" font-size="15" fill="#111">${labels[i].replace(/&/g,'&amp;')}</text></svg>`),left:x,top:y});
  }
  await sharp({create:{width:W,height:H,channels:3,background:bg}}).composite(comps).png().toFile(out);
}
