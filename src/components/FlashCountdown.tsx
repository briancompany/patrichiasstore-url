import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { formatCountdown } from '@/lib/flash-sales';

interface FlashCountdownProps {
  endsAt: string;
  className?: string;
  showIcon?: boolean;
  onEnd?: () => void;
}

/** Live ticking countdown to the end of a flash sale. */
export function FlashCountdown({ endsAt, className = '', showIcon = true, onEnd }: FlashCountdownProps) {
  const [text, setText] = useState<string | null>(() => formatCountdown(endsAt));

  useEffect(() => {
    setText(formatCountdown(endsAt));
    const id = setInterval(() => {
      const next = formatCountdown(endsAt);
      setText(next);
      if (next === null) {
        clearInterval(id);
        onEnd?.();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums ${className}`}>
      {showIcon && <Timer className="h-3.5 w-3.5" />}
      {text ?? 'Ended'}
    </span>
  );
}
