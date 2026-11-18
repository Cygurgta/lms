import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { api, getData } from '../lib/api';
import { Empty, Loading, PageHead } from '../components/ui';

type Notice = { id: string; title: string; body: string; readAt?: string | null; createdAt: string; conversationId?: string | null };
export default function Notifications() {
  const queryClient=useQueryClient();
  const {data=[],isLoading,isError,refetch}=useQuery({queryKey:['notifications'],queryFn:()=>getData<Notice[]>('/notifications'),refetchInterval:30000});
  const read=useMutation({mutationFn:(id:string)=>api.patch(`/notifications/${id}/read`),onSuccess:()=>{void queryClient.invalidateQueries({queryKey:['notifications']});void queryClient.invalidateQueries({queryKey:['notification-count']});}});
  return <><PageHead eyebrow="Stay informed" title="Notifications"/>{isLoading?<Loading/>:isError?<div className="card p-6"><p>Notifications are temporarily unavailable.</p><button className="btn-soft mt-3" onClick={()=>void refetch()}>Try again</button></div>:!data.length?<Empty title="You’re all caught up" body="New course and group activity will appear here."/>:<div className="card divide-y divide-ink/10">{data.map(notice=><div className={`p-5 ${!notice.readAt?'bg-mint/30':''}`} key={notice.id}><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="mt-0.5 rounded-lg bg-mint p-2 text-forest"><Bell size={17}/></div><div><p className="font-bold">{notice.title}</p><p className="mt-1 text-sm text-ink/65">{notice.body}</p><time className="mt-2 block text-xs text-ink/50">{new Date(notice.createdAt).toLocaleString()}</time>{notice.conversationId&&<Link onClick={()=>!notice.readAt&&read.mutate(notice.id)} to={`/chat?conversationId=${encodeURIComponent(notice.conversationId)}`} className="mt-3 inline-flex text-sm font-bold text-forest hover:underline">Open discussion</Link>}</div></div>{!notice.readAt&&<button onClick={()=>read.mutate(notice.id)} disabled={read.isPending} aria-label="Mark as read" className="rounded-lg p-2 text-forest hover:bg-mint"><Check size={17}/></button>}</div></div>)}</div>}</>;
}
