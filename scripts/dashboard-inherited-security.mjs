import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const u=new URL(process.env.DATABASE_URL);if(u.hostname!=='127.0.0.1'||u.port!=='9543'||u.pathname!=='/vila_dashboard_v1'||process.env.VILA_TEST_ORIGIN!=='http://localhost:3500')throw Error('Dashboard isolated target required');
mkdirSync('.local',{recursive:true});
for(const [source,output] of [['finance-legacy-rls.mjs','dashboard-legacy-rls.json'],['finance-security.mjs','dashboard-finance-security.json']]){
 const sourceText=readFileSync('scripts/'+source,'utf8');const adjusted=sourceText.replaceAll('/vila_finance_v1','/vila_dashboard_v1').replaceAll('docs/verification/finance-legacy-rls.json','docs/verification/'+output).replaceAll('docs/verification/finance-security.json','docs/verification/'+output);
 const target='.local/inherited-'+source;writeFileSync(target,adjusted);const result=spawnSync(process.execPath,[target],{stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status??1);
}
