import {recordSchemas,documentKinds} from "./domain";
import {AppError} from "./security";
export function validateEndpoint(path:string[],method:string){
 const [kind,id,action]=path;
 const roots:Record<string,string[]>={auth:["POST"],health:["GET"],me:["GET"],dashboard:["GET"],lookup:["GET"],history:["GET"],organization:["POST"],profile:["POST"],password:["POST"],switch:["POST"],invites:["POST","DELETE"],members:["PATCH"],sessions:["GET","DELETE"],stock:["GET","POST"],movements:["GET"],finance:["GET","POST"],audit:["GET"]};
 const generic=!!recordSchemas[kind]||documentKinds.includes(kind);
 const methods=roots[kind]??(generic?["GET","POST","PATCH","DELETE"]:null);
 if(!methods)throw new AppError("Modül bulunamadı",404);
 if(!methods.includes(method))throw new AppError("HTTP yöntemi desteklenmiyor",405);
 let valid=false;
 if(kind==="auth")valid=path.length===2&&["login","register","logout"].includes(id);
 else if(kind==="history")valid=path.length===2;
 else if(kind==="members")valid=path.length===2;
 else if(kind==="invites"||kind==="sessions")valid=path.length===(method==="DELETE"?2:1);
 else if(kind==="finance")valid=path.length===1||(path.length===3&&action==="reverse"&&method==="POST");
 else if(generic){valid=path.length===1&&["GET","POST"].includes(method)||path.length===2&&["PATCH","DELETE"].includes(method);if(path.length===3){valid=(kind==="leads"&&action==="convert"&&method==="POST")||(documentKinds.includes(kind)&&(["confirm","convert","fulfill"].includes(action)&&method==="POST"||action==="deliveries"&&method==="GET"))}}
 else valid=path.length===1;
 if(!valid)throw new AppError("API adresi veya işlem bulunamadı",404);
}
