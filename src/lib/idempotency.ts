import { Prisma } from "@prisma/client";
import { db } from "./db";
import { transaction } from "./service";
import { AppError, hash, type Actor } from "./security";
export async function idempotent<T>(a:Actor,scope:string,key:string|null,body:unknown,fn:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
 if(!key)return transaction(fn);
 if(!/^[a-zA-Z0-9_-]{16,128}$/.test(key))throw new AppError("Geçersiz işlem anahtarı.");
 const requestHash=hash(JSON.stringify(body));const where={orgId_scope_key:{orgId:a.orgId,scope,key}};
 const replay=(receipt:{requestHash:string;result:unknown})=>{if(receipt.requestHash!==requestHash)throw new AppError("İşlem anahtarı farklı içerikle kullanılamaz.",409);return receipt.result as T};
 try{return await transaction(async tx=>{const prior=await tx.mutationReceipt.findUnique({where});if(prior)return replay(prior);const result=await fn(tx);await tx.mutationReceipt.create({data:{orgId:a.orgId,scope,key,requestHash,result:JSON.parse(JSON.stringify(result))}});return result})}
 catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError && e.code==="P2002"){const prior=await db.mutationReceipt.findUnique({where});if(prior)return replay(prior)}throw e}
}
