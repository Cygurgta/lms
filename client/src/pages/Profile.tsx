import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, MessageCircle, Save, Trash2 } from 'lucide-react';
import { api, getData } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { BackButton, Breadcrumbs } from '../components/navigation';
import { UserAvatar } from '../components/UserAvatar';
import { useToast } from '../components/Toast';
import { Loading, PageHead } from '../components/ui';

type ProfileData = { id: string; email?: string; role: string; status?: string; createdAt: string; profile?: { firstName: string; lastName: string; phone?: string | null; bio?: string | null; avatarUrl?: string | null; themePreference?: string }; learner?: { registrationNo: string; programme?: { name: string }; currentYear?: { name: string }; currentSemester?: { name: string }; enrollments: Array<{ status: string }>; courseEnrollments: Array<{ course: { id: string; code: string; title: string } }> }; lecturer?: { staffNo: string; courses: Array<{ id: string; code: string; title: string }> } };

export default function Profile() {
  const { id } = useParams();
  const { session, refreshSession } = useAuth();
  const ownProfile = !id || id === session?.user.id;
  const canEditProfile = ownProfile || session?.user.role === 'ADMIN';
  const adminEditing = !ownProfile && session?.user.role === 'ADMIN';
  const queryClient = useQueryClient();
  const toast = useToast();
  const queryKey = ownProfile ? ['profile'] : ['person-profile', id];
  const { data, isLoading, isError, refetch } = useQuery({ queryKey, queryFn: () => getData<ProfileData>(ownProfile ? '/profile' : adminEditing ? `/profile/admin/users/${id}` : `/profile/people/${id}`) });
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', bio: '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { if (data?.profile) setForm({ firstName: data.profile.firstName || '', lastName: data.profile.lastName || '', phone: data.profile.phone || '', bio: data.profile.bio || '' }); }, [data]);
  useEffect(() => { if (!file) { setPreview(null); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const save = useMutation({ mutationFn: (body: typeof form) => api.patch(adminEditing ? `/profile/admin/users/${id}` : '/profile', body), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey }); if(ownProfile) await refreshSession(); toast('Profile updated successfully'); }, onError: () => toast('Could not save profile changes', 'error') });
  const upload = useMutation({ mutationFn: (image: File) => { const body = new FormData(); body.append('file', image); return api.post('/profile/avatar', body); }, onSuccess: async () => { setFile(null); await queryClient.invalidateQueries({ queryKey: ['profile'] }); await refreshSession(); toast('Profile photo updated'); }, onError: () => toast('Image upload failed. Choose a JPG, PNG, or WebP under 5 MB.', 'error') });
  const removeAvatar = useMutation({ mutationFn: () => api.delete('/profile/avatar'), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['profile'] }); await refreshSession(); toast('Profile photo removed'); }, onError: () => toast('Could not remove profile photo', 'error') });
  const name = `${data?.profile?.firstName || ''} ${data?.profile?.lastName || ''}`.trim() || 'Institute member';
  const avatar = preview || data?.profile?.avatarUrl;
  const courses = data?.learner?.courseEnrollments.map(item => item.course) || data?.lecturer?.courses || [];
  const onImage = (event: ChangeEvent<HTMLInputElement>) => { const selected = event.target.files?.[0]; if (selected) setFile(selected); event.target.value = ''; };
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.firstName.trim() || !form.lastName.trim()) { toast('First and last name are required', 'error'); return; } save.mutate(form); };
  if (isLoading) return <Loading/>;
  if (!data || isError) return <div><BackButton/><PageHead title="Profile unavailable"/><div className="card p-6"><p>We couldn’t load this profile.</p><button onClick={() => void refetch()} className="btn-soft mt-4">Try again</button></div></div>;
  return <div><BackButton to="/" label="Back"/><Breadcrumbs items={[{label:'Dashboard',href:'/'},{label:ownProfile?'My profile':name}]}/><PageHead eyebrow={ownProfile ? 'Your account' : 'Institute member'} title={ownProfile ? 'My profile' : name}/><div className="grid gap-6 xl:grid-cols-[340px_1fr]">
    <section className="card p-6"><div className="flex flex-col items-center text-center"><UserAvatar src={avatar} name={name} size="xl"/><h2 className="mt-4 font-serif text-2xl font-bold">{name}</h2><p className="mt-1 text-sm text-ink/60">{data.role.toLowerCase()} · {data.status?.toLowerCase() || 'active'}</p>{(ownProfile||adminEditing)&&<p className="mt-1 text-sm text-ink/60">{data.email}</p>}<Link to={`/chat`} className="btn-soft mt-5"><MessageCircle size={17}/>Open Rhyme Community</Link></div>
      <div className="mt-7 space-y-4 border-t border-ink/10 pt-5 text-sm">{canEditProfile && data.learner && <><Info label="Admission number" value={data.learner.registrationNo}/><Info label="Programme" value={data.learner.programme?.name || 'Not assigned'}/><Info label="Academic year" value={data.learner.currentYear?.name || 'Not assigned'}/><Info label="Academic period" value={data.learner.currentSemester?.name || 'Not assigned'}/><Info label="Enrollment status" value={data.learner.enrollments[0]?.status.toLowerCase() || 'Not enrolled'}/></>}{canEditProfile&&data.lecturer&&<Info label="Staff number" value={data.lecturer.staffNo}/>}<Info label="Member since" value={new Date(data.createdAt).toLocaleDateString()}/>{data.profile?.bio&&<div><p className="label">About</p><p className="mt-1 whitespace-pre-wrap text-ink/75">{data.profile.bio}</p></div>}</div>
    </section>
    <section className="space-y-6">{canEditProfile&&<form onSubmit={submit} className="card p-6"><h2 className="font-serif text-2xl font-bold">{adminEditing?'Manage profile':'Personal details'}</h2><p className="mt-1 text-sm text-ink/60">{adminEditing?'Edit permitted profile information for this account.':'Your name and biography are visible to members signed into the LMS.'}</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="First name" value={form.firstName} maxLength={80} onChange={value=>setForm({...form,firstName:value})} required/><Field label="Last name" value={form.lastName} maxLength={80} onChange={value=>setForm({...form,lastName:value})} required/><Field label="Phone number" value={form.phone} maxLength={32} onChange={value=>setForm({...form,phone:value})}/><label className="text-sm font-semibold sm:col-span-2">About you<textarea value={form.bio} onChange={event=>setForm({...form,bio:event.target.value})} maxLength={500} rows={4} className="focus-ring mt-1.5 w-full resize-y rounded-xl border border-ink/15 bg-white p-3 font-normal dark:border-white/15 dark:bg-sand" placeholder="Share a short introduction"/><span className="mt-1 block text-right text-xs text-ink/45">{form.bio.length}/500</span></label></div><div className="mt-5 flex flex-wrap gap-3"><button disabled={save.isPending} className="btn-primary"><Save size={17}/>{save.isPending?'Saving…':'Save changes'}</button><button type="button" disabled={save.isPending} onClick={()=>setForm({firstName:data.profile?.firstName||'',lastName:data.profile?.lastName||'',phone:data.profile?.phone||'',bio:data.profile?.bio||''})} className="btn-soft">Cancel</button></div></form>}
      <div className="card p-6"><h2 className="font-serif text-2xl font-bold">{ownProfile?'Profile photo':'Courses'}</h2>{ownProfile?<><p className="mt-1 text-sm text-ink/60">JPG, PNG, or WebP. Maximum size 5 MB.</p><div className="mt-5 flex flex-wrap items-center gap-3"><label className="btn-soft cursor-pointer"><Camera size={17}/>{file?'Upload selected photo':'Choose photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onImage}/></label>{file&&<button onClick={()=>upload.mutate(file)} disabled={upload.isPending} className="btn-primary">{upload.isPending?'Uploading…':'Save photo'}</button>}{data.profile?.avatarUrl&&<button onClick={()=>removeAvatar.mutate()} disabled={removeAvatar.isPending} className="btn-soft"><Trash2 size={17}/>Remove photo</button>}</div></>:<p className="mt-1 text-sm text-ink/60">{data.role.toLowerCase()} learning and teaching activity.</p>}{courses.length>0?<div className="mt-5 grid gap-3 sm:grid-cols-2">{courses.map(course=><div key={course.id} className="rounded-xl border border-ink/10 p-4"><p className="label">{course.code}</p><p className="mt-1 font-semibold">{course.title}</p></div>)}</div>:<p className="mt-4 text-sm text-ink/55">No courses assigned yet.</p>}</div>
    </section>
  </div></div>;
}

function Field({ label, value, onChange, maxLength, required }: { label: string; value: string; onChange: (value: string) => void; maxLength: number; required?: boolean }) { const id = useMemo(() => label.toLowerCase().replace(/\s+/g, '-'), [label]); return <label htmlFor={id} className="text-sm font-semibold">{label}{required&&<span className="ml-1 text-coral">*</span>}<input id={id} value={value} required={required} maxLength={maxLength} onChange={event=>onChange(event.target.value)} className="focus-ring mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 font-normal dark:border-white/15 dark:bg-sand"/></label>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="label">{label}</p><p className="mt-1 font-medium">{value}</p></div>; }
