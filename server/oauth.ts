import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import type {Config} from './config.js';
import {ApiError} from './errors.js';
export const randomToken=()=>randomBytes(32).toString('base64url');
export const sameToken=(a:string,b:string)=>Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export interface GoogleIdentity{sub:string;email:string|null;nickname:string;picture?:string|null}
export interface OAuthGateway{exchange(code:string,verifier:string,nonce:string):Promise<GoogleIdentity>}
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export function authorizationUrl(config:Config,state:string,verifier:string,nonce:string){const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:config.GOOGLE_CLIENT_ID!,redirect_uri:config.APP_ORIGIN+'/api/auth/google/callback',response_type:'code',scope:'openid email profile',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();return url.href;}
export function googleOAuth(config:Config,transport:typeof fetch=fetch):OAuthGateway{return {async exchange(code,verifier,nonce){
 let response:Response;try{response=await transport('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:config.GOOGLE_CLIENT_ID!,client_secret:config.GOOGLE_CLIENT_SECRET!,redirect_uri:config.APP_ORIGIN+'/api/auth/google/callback',grant_type:'authorization_code',code_verifier:verifier})});}catch{throw new ApiError(502,'Google 로그인 연결이 지연되고 있어요.');}
 if(!response.ok)throw new ApiError(401,'Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.');
 const result=await response.json() as {id_token?:string};if(typeof result.id_token!=='string')throw new ApiError(401,'Google 인증 응답을 확인할 수 없어요.');
 let claims;try{({payload:claims}=await jwtVerify(result.id_token,jwks,{audience:config.GOOGLE_CLIENT_ID,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256'],requiredClaims:['sub','exp','iat','nonce'],maxTokenAge:'10 minutes'}));}catch{throw new ApiError(401,'Google 인증 정보를 검증하지 못했어요.');}
 if(typeof claims.nonce!=='string'||!sameToken(claims.nonce,nonce)||!claims.sub||claims.email_verified!==true)throw new ApiError(401,'Google 인증 정보를 검증하지 못했어요.');
 return {picture:typeof claims.picture==='string'&&claims.picture.startsWith('https://')&&claims.picture.length<=2048?claims.picture:null,sub:claims.sub,email:typeof claims.email==='string'?claims.email:null,nickname:typeof claims.name==='string'?claims.name.slice(0,100):'지휘관'};
}};}
