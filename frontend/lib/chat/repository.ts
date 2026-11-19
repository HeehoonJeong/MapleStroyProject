import type { SupabaseClient } from "@supabase/supabase-js";
import type { CharacterSnapshot } from "@/components/character/dashboard";

export type ChatRoom = { id: string; title: string; created_at: string; updated_at: string };
export type ChatMessage = { id?: string; role: "user" | "assistant"; content: string; created_at: string; sources?: unknown[]; character_snapshot_ids?: number[]; executed_tools?: string[]; snapshots?: CharacterSnapshot[] };
export interface ChatRepository {
  listRooms(): Promise<ChatRoom[]>;
  getMessages(roomId: string): Promise<ChatMessage[]>;
  createRoom(title: string): Promise<ChatRoom>;
  saveMessage(roomId: string, message: ChatMessage): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  getLastCharacter<T>(): Promise<T | null>;
  saveLastCharacter<T>(character: T): Promise<void>;
}

type LocalRoom = ChatRoom & { messages: ChatMessage[] };
const snapshotRetentionMs = 29 * 24 * 60 * 60 * 1000;
function pruneMessages(messages: ChatMessage[]) {
  return messages.map(message => ({ ...message, snapshots: message.snapshots?.filter(snapshot => Date.parse(snapshot.created_at) >= Date.now() - snapshotRetentionMs && Date.parse(snapshot.created_at) <= Date.now()) }));
}
const databaseName = "maple-ai-guest";
function request<T>(req: IDBRequest<T>): Promise<T> { return new Promise((resolve,reject) => { req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error ?? new Error("브라우저 저장소 오류")); }); }
function transactionDone(tx: IDBTransaction): Promise<void> { return new Promise((resolve,reject) => { tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error ?? new Error("브라우저 저장소 오류")); tx.onabort=()=>reject(tx.error ?? new Error("브라우저 저장이 취소됐습니다.")); }); }
function open(): Promise<IDBDatabase> { return new Promise((resolve,reject)=>{ const req=indexedDB.open(databaseName,1); req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains("rooms")) db.createObjectStore("rooms",{keyPath:"id"}); if(!db.objectStoreNames.contains("settings")) db.createObjectStore("settings"); }; req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error ?? new Error("브라우저 저장소를 열 수 없습니다.")); req.onblocked=()=>reject(new Error("다른 탭에서 브라우저 저장소를 사용 중입니다.")); }); }
export class LocalChatRepository implements ChatRepository {
  async listRooms() { const db=await open(); try { const tx=db.transaction(["rooms","settings"],"readwrite"); const store=tx.objectStore("rooms"); const rooms=await request(store.getAll()) as LocalRoom[]; for(const room of rooms){const cleaned=pruneMessages(room.messages); if(room.messages.some((m,i)=>(m.snapshots?.length??0)!==(cleaned[i].snapshots?.length??0))){room.messages=cleaned;store.put(room);}} const settings=tx.objectStore("settings");const last=await request(settings.get("lastCharacter")) as {savedAt?:number}|undefined;if(last && (!last.savedAt || last.savedAt<Date.now()-snapshotRetentionMs))settings.delete("lastCharacter");await transactionDone(tx);return rooms.map(({messages: _messages,...room})=>room).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)); } finally { db.close(); } }
  async getMessages(id:string) { const db=await open(); try { const tx=db.transaction("rooms","readonly"); const room=await request(tx.objectStore("rooms").get(id)) as LocalRoom|undefined; return pruneMessages(room?.messages ?? []); } finally { db.close(); } }
  async createRoom(title:string) { const now=new Date().toISOString();const room:LocalRoom={id:crypto.randomUUID(),title,created_at:now,updated_at:now,messages:[]};const db=await open();try {const tx=db.transaction("rooms","readwrite");tx.objectStore("rooms").add(room);await transactionDone(tx);return {id:room.id,title:room.title,created_at:now,updated_at:now};} finally {db.close();} }
  async saveMessage(id:string,message:ChatMessage) { const db=await open();try {const tx=db.transaction("rooms","readwrite");const store=tx.objectStore("rooms");const room=await request(store.get(id)) as LocalRoom|undefined;if(!room){tx.abort();throw new Error("대화를 찾을 수 없습니다.");}room.messages.push({...message,id:message.id ?? crypto.randomUUID()});room.updated_at=new Date().toISOString();store.put(room);await transactionDone(tx);}finally{db.close();} }
  async getCharacterSnapshots(ocid:string, before:string) { const db=await open();try{const tx=db.transaction("rooms","readonly");const rooms=await request(tx.objectStore("rooms").getAll()) as LocalRoom[];return rooms.flatMap(room=>pruneMessages(room.messages).flatMap(message=>message.snapshots??[])).filter(snapshot=>snapshot.ocid===ocid && snapshot.created_at<=before).sort((a,b)=>a.created_at.localeCompare(b.created_at));}finally{db.close();} }
  async deleteRoom(id:string) {const db=await open();try{const tx=db.transaction("rooms","readwrite");tx.objectStore("rooms").delete(id);await transactionDone(tx);}finally{db.close();} }
  async getLastCharacter<T>() {const db=await open();try{const tx=db.transaction("settings","readonly");const stored=await request(tx.objectStore("settings").get("lastCharacter")) as {value:T; savedAt:number}|undefined;return stored && stored.savedAt >= Date.now()-snapshotRetentionMs ? stored.value : null;}finally{db.close();} }
  async saveLastCharacter<T>(character:T) {const db=await open();try{const tx=db.transaction("settings","readwrite");tx.objectStore("settings").put({value:character,savedAt:Date.now()},"lastCharacter");await transactionDone(tx);}finally{db.close();} }
}
export class RemoteChatRepository implements ChatRepository {
  constructor(private client:SupabaseClient,private userId:string) {}
  async listRooms(){const {data,error}=await this.client.from("maple_chat_rooms").select("id,title,created_at,updated_at").eq("user_id",this.userId).order("updated_at",{ascending:false});if(error)throw error;return (data??[]) as ChatRoom[];}
  async getMessages(roomId:string){const {data,error}=await this.client.from("maple_chat_messages").select("id,role,content,sources,created_at,character_snapshot_ids,executed_tools").eq("room_id",roomId).eq("user_id",this.userId).order("created_at",{ascending:true});if(error)throw error;const messages=(data??[]) as ChatMessage[];const ids=[...new Set(messages.flatMap(m=>m.character_snapshot_ids??[]))];if(ids.length){const {data:snapshots,error:se}=await this.client.from("maple_character_snapshots").select("id,ocid,character_name,data_date,responses,failures,created_at").in("id",ids).eq("user_id",this.userId);if(se)throw se;const byId=new Map(((snapshots??[]) as CharacterSnapshot[]).map(s=>[s.id,s]));for(const m of messages)m.snapshots=(m.character_snapshot_ids??[]).flatMap(id=>byId.has(id)?[byId.get(id)!]:[]);}return messages;}
  async createRoom(title:string){const {data,error}=await this.client.from("maple_chat_rooms").insert({user_id:this.userId,title}).select("id,title,created_at,updated_at").single();if(error)throw error;return data as ChatRoom;}
  async saveMessage(roomId:string,message:ChatMessage){const {error}=await this.client.from("maple_chat_messages").insert({room_id:roomId,user_id:this.userId,role:message.role,content:message.content,sources:message.sources??[],character_snapshot_ids:message.character_snapshot_ids??[],executed_tools:message.executed_tools??[],response_schema_version:message.character_snapshot_ids?.length?1:null});if(error)throw error;}
  async deleteRoom(id:string){const {error}=await this.client.from("maple_chat_rooms").delete().eq("id",id).eq("user_id",this.userId);if(error)throw error;}
  async getLastCharacter<T>(){const {data,error}=await this.client.from("maple_user_representative_characters").select("character_name,world_name,character_class,character_level,character_exp_rate,character_guild_name,character_image,combat_power,boss_damage,ignore_defense,union_level,union_artifact_level,dojang_best_floor,data_date").eq("user_id",this.userId).maybeSingle();if(error)throw error;return data as T|null;}
  async saveLastCharacter<T>(_character:T){/* The authenticated Edge Function stores this server-side. */}
}
