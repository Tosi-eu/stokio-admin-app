export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14 18c0-2.2 1.8-4 4-4h28c2.2 0 4 1.8 4 4v28c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4V18Z"
        stroke="hsl(var(--border))"
        strokeWidth="2"
      />
      <path
        d="M22 40c6.5 0 10.5-4.5 10.5-10.5S28.5 19 22 19h-2v21h2Zm18.5 0c6.5 0 10.5-4.5 10.5-10.5S47 19 40.5 19h-2v21h2Z"
        fill="url(#g)"
        opacity="0.95"
      />
      <defs>
        <linearGradient id="g" x1="18" y1="18" x2="50" y2="50">
          <stop stopColor="hsl(222 48% 22%)" />
          <stop offset="0.45" stopColor="hsl(210 48% 40%)" />
          <stop offset="1" stopColor="hsl(191 78% 48%)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

