import pg from 'pg';import {readFileSync} from 'node:fs';
const url=new URL(process.env.MIGRATION_DATABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='7543'||url.pathname!=='/vila_sprint_01')throw Error('Sprint DB required');
const client=new pg.Client({connectionString:url.href});await client.connect();
try{await client.query(readFileSync('deploy/sprint-rls.sql','utf8'));console.log('Eight business tables protected in sprint DB only')}finally{await client.end()}
