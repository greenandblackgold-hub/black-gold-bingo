import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

type Row = { id:string; amount:number; method:string; destination:string; status:string; userName:string; userPhone:string; at:number };
const TEXT = {
 am:{title:'طلبات السحب المعلّقة (Simulation)',empty:'لا توجد طلبات معلّقة',player:'اللاعب',method:'الطريقة',destination:'بيانات الاستلام',approve:'موافقة',reject:'رفض',reload:'تحديث',notice:'للاختبار فقط: لا يتم إرسال أموال حقيقية. الموافقة تغيّر حالة الطلب فقط؛ والرفض يعيد رصيد Simulation.',err:'حدث خطأ'},
 ti:{title:'ምስጢር ሕቶታት ምውጻእ (Simulation)',empty:'ዝጽበ ሕቶ የለን',player:'ተጻዋታይ',method:'መንገዲ',destination:'መረዳእታ ተቐባሊ',approve:'ኣጽድቕ',reject:'ንጸግ',reload:'ኣሐድስ',notice:'ፈተነ ጥራይ፦ ሓቀኛ ገንዘብ ኣይስደድን። ምጽዳቕ ኩነታት ጥራይ ይቕይር፤ ምንጻግ ድማ Simulation ሒሳብ ይመልስ።',err:'ጌጋ ተፈጢሩ'},
 en:{title:'Pending withdrawals (Simulation)',empty:'No pending requests',player:'Player',method:'Method',destination:'Test destination',approve:'Approve',reject:'Reject',reload:'Reload',notice:'TEST ONLY: no real money is sent. Approval only marks this simulation request approved; rejection refunds the simulation balance.',err:'Something went wrong'}
} as const;
export function AdminSimulationWithdrawals(){
 const {lang}=useLanguage(); const t=TEXT[lang]??TEXT.en;
 const [rows,setRows]=useState<Row[]>([]); const [error,setError]=useState('');
 const load=useCallback(async()=>{try{setRows(await api.get<Row[]>('/api/admin/withdrawals/simulation?status=pending'));setError('')}catch(e){setError(e instanceof ApiError?e.message:t.err)}},[t.err]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),15000);return()=>clearInterval(timer)},[load]);
 const act=async(id:string,a:'approve'|'reject')=>{try{await api.post('/api/admin/withdrawals/simulation/'+encodeURIComponent(id)+'/'+a,{});await load()}catch(e){setError(e instanceof ApiError?e.message:t.err)}};
 const btn='rounded-lg px-3 py-2 text-sm font-semibold ring-1 active:scale-95';
 return <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
  <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-gold-300">{t.title}</h2><button onClick={()=>void load()} className="text-sm text-gold-400 underline">{t.reload}</button></div>
  <p className="mb-3 text-xs text-gold-500">{t.notice}</p>{error&&<p role="alert" className="mb-2 text-sm text-red-300">{error}</p>}
  {!rows.length?<p className="py-3 text-center text-sm text-gold-700">{t.empty}</p>:<ul className="space-y-2">{rows.map(w=><li key={w.id} className="rounded-xl bg-white/[0.04] p-3">
   <div className="flex justify-between gap-2"><b className="text-lg text-gold-400">{w.amount.toFixed(2)} ETB</b><span className="text-xs text-gold-500">Pending</span></div>
   <p className="mt-1 text-sm text-gold-300">{t.player}: {w.userName} · {w.userPhone}</p>
   <p className="mt-1 text-xs text-gold-500">{t.method}: {w.method||'—'} · {t.destination}: {w.destination||'—'}</p>
   <p className="mt-1 break-all font-mono text-[11px] text-gold-700">{w.id}</p>
   <div className="mt-3 flex gap-2"><button onClick={()=>void act(w.id,'approve')} className={btn+' flex-1 bg-gold-500 text-darkbg ring-gold-400'}>{t.approve}</button><button onClick={()=>void act(w.id,'reject')} className={btn+' flex-1 text-gold-300 ring-gold-700/60'}>{t.reject}</button></div>
  </li>)}</ul>}
 </section>
}
