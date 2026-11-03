import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
const output='public/brand/';
for(const size of [16,32,48,180,192,512]) {
  const name=size===180?'apple-touch-icon':size>=192?`pwa-${size}`:`icon-${size}`;
  await sharp(output+'icon.svg').resize(size,size).png().toFile(output+name+'.png');
}
for(const size of [192,512])await sharp('.local/maskable.svg').resize(size,size).png().toFile(output+`pwa-maskable-${size}.png`);
await sharp('.local/og.svg').png().toFile(output+'og.png');
const sizes=[16,32,48], images=sizes.map(n=>readFileSync(output+`icon-${n}.png`));
const header=Buffer.alloc(6+16*3);header.writeUInt16LE(1,2);header.writeUInt16LE(3,4);let offset=header.length;
images.forEach((image,i)=>{const p=6+i*16;header[p]=sizes[i];header[p+1]=sizes[i];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(image.length,p+8);header.writeUInt32LE(offset,p+12);offset+=image.length});
writeFileSync(output+'favicon.ico',Buffer.concat([header,...images]));
const result=[];
for(const file of ['icon-16.png','icon-32.png','icon-48.png','apple-touch-icon.png','pwa-192.png','pwa-512.png','pwa-maskable-192.png','pwa-maskable-512.png','og.png','icon.svg']) {
  const m=await sharp(output+file).metadata();result.push({file,format:m.format,width:m.width,height:m.height});
}
for(let i=0;i<3;i++){const m=await sharp(images[i]).metadata();if(m.width!==sizes[i]||m.height!==sizes[i])throw Error('ICO size mismatch')}
writeFileSync('docs/verification/seo-brand-assets.json',JSON.stringify({assets:result,ico:{format:'ICO',sizes,embeddedFormat:'PNG'},source:'Urbanist variable 700, existing .brand VILA, -0.02em tracking'},null,2));
console.log(result);
