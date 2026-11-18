import { UserRound } from 'lucide-react';

export function UserAvatar({ src, name = 'User', size = 'md', className = '' }: { src?: string | null; name?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const dimensions = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-16 w-16', xl: 'h-24 w-24' }[size];
  return <div className={`${dimensions} grid shrink-0 place-items-center overflow-hidden rounded-full bg-mint font-bold text-forest ${className}`} aria-label={name}>
    {src ? <img src={src.startsWith('http') ? src : `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:4000'}${src}`} alt="" className="h-full w-full object-cover"/> : <span>{name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || <UserRound size={20}/>}</span>}
  </div>;
}
