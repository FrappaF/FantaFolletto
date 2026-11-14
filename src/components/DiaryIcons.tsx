import type { ReactNode, SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
  size?: number
}

function Frame({
  size = 24,
  strokeWidth = 1.7,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  const labelled = Boolean(props['aria-label'] || props['aria-labelledby'])
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? 'img' : undefined}
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/** Quattro punte curve, come la scintilla del marchio. */
function Spark({ x = 12, y = 12, r = 4 }: { x?: number; y?: number; r?: number }) {
  return (
    <path
      d={`M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`}
    />
  )
}

export function DiaryIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M12 6.5C9.4 4.8 6.1 4.5 3 5.2v14c3.1-.7 6.4-.4 9 1.3 2.6-1.7 5.9-2 9-1.3v-7.4M12 6.5v14M6.2 9.3c.9 0 1.8.2 2.6.5m-2.6 3c.9 0 1.8.2 2.6.5" />
      <g className="diary-icon-accent">
        <Spark x={18.5} y={6} r={3.6} />
      </g>
    </Frame>
  )
}

export function RecordIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="m8 15-1.3 6 5.3-2.4 5.3 2.4-1.3-6" />
      <circle cx="12" cy="9.5" r="6.5" />
      <g className="diary-icon-accent">
        <Spark x={12} y={9.5} r={3.2} />
      </g>
    </Frame>
  )
}

export function GiftIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4.5 11v7.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V11M12 8v12.5" />
      <rect x="3" y="8" width="18" height="4" rx="1.3" />
      <path className="diary-icon-accent" d="M12 8C8.6 8 6 7 6 4.9 6 2 11.1 2.4 12 8Zm0 0c3.4 0 6-1 6-3.1 0-2.9-5.1-2.5-6 3.1Z" />
    </Frame>
  )
}

export function SparkleIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <Spark x={10} y={14} r={8} />
      <g className="diary-icon-accent">
        <Spark x={19} y={5} r={3} />
      </g>
    </Frame>
  )
}

export function CoffeeIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M5 8.5h11v6.2a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14.7ZM16 10h1.5a3 3 0 0 1 0 6H16M3.5 21h15" />
      <path className="diary-icon-accent" d="M8.5 5.5c-1.7-1.2 1.7-2.3 0-3.5M13 5.5c-1.7-1.2 1.7-2.3 0-3.5" />
    </Frame>
  )
}

export function PawIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M7 14c1.9-3.8 8.1-3.8 10 0l1 2a3 3 0 0 1-3.5 4.2l-1.6-.5a3 3 0 0 0-1.8 0l-1.6.5A3 3 0 0 1 6 16Z" />
      <ellipse cx="5" cy="10" rx="1.8" ry="2.4" transform="rotate(-25 5 10)" />
      <ellipse cx="9.5" cy="5.5" rx="1.8" ry="2.4" transform="rotate(-8 9.5 5.5)" />
      <ellipse cx="14.5" cy="5.5" rx="1.8" ry="2.4" transform="rotate(8 14.5 5.5)" />
      <ellipse cx="19" cy="10" rx="1.8" ry="2.4" transform="rotate(25 19 10)" />
    </Frame>
  )
}

export function SmileIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.7 14c1.8 4.2 6.8 4.2 8.6 0M7.6 9.5q.9-1.2 1.8 0m5.2 0q.9-1.2 1.8 0" />
    </Frame>
  )
}

export function NameIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M14.5 4.5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8M6.5 10h4m-4 4h10m-10 3.5H13" />
      <g className="diary-icon-accent">
        <Spark x={18.5} y={5.5} r={3.5} />
      </g>
    </Frame>
  )
}

export function RainIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M7 14H6a3.5 3.5 0 0 1-.5-7A5.5 5.5 0 0 1 16 5.5 4.3 4.3 0 1 1 18 14h-1" />
      <path className="diary-icon-accent" d="m8 17-1 3m5-4-1 3m5-2-1 3" />
    </Frame>
  )
}
