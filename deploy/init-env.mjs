import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const origin=new URL(process.argv[2]??'http://localhost:3000');
if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Use an HTTP(S) origin without a path or credentials');
const path=process.argv[3]??'.env.deploy';
writeFileSync(path,`APP_ORIGIN=${origin.origin}\nPOSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nAPP_DB_PASSWORD=${randomBytes(32).toString('hex')}\nVILA_PORT=3000\nVILA_VERSION=local\n`,{flag:'wx',mode:0o600});
console.log('Deployment environment created. Keep this file private. Existing files are never overwritten.');
