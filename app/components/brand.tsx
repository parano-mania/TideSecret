import type { SVGProps } from 'react'

export function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M12 3 4 6v6c0 4 4.5 7.5 8 9 3.5-1.5 8-5 8-9V6l-8-3Z" />
    <path d="m8.5 12 2.3 2.3 4.7-4.7" />
  </svg>
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" {...props}>
    <rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
  </svg>
}

export function Brand() {
  return <span className="brand"><span className="brand-mark"><LockIcon /></span><span>Tide<span className="brand-accent">Secret</span></span></span>
}
