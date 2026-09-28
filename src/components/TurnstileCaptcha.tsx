import React from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

export function resetTurnstile(widgetId?: string) {
  if (typeof window !== 'undefined' && window.turnstile) {
    try {
      window.turnstile.reset(widgetId);
    } catch (e) {
      console.warn('Error resetting Turnstile widget:', e);
    }
  }
}

type Props = { 
  onToken: (token: string) => void;
  resetTrigger?: number;
};

/** Cloudflare Turnstile uses a public site key; its secret remains in Edge Function secrets. */
export default function TurnstileCaptcha({ onToken, resetTrigger }: Props) {
  const container = React.useRef<HTMLDivElement>(null);
  const widgetId = React.useRef<string | undefined>(undefined);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  React.useEffect(() => {
    if (!siteKey || !container.current) return;
    const render = () => {
      if (!container.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
        'refresh-expired': 'auto',
      });
    };
    const existing = document.querySelector('script[data-turnstile]');
    if (existing) render();
    else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.defer = true; script.dataset.turnstile = 'true';
      script.onload = render; document.head.appendChild(script);
    }
    return () => { if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current); };
  }, [siteKey, onToken]);

  // Tự động yêu cầu mã bảo mật mới khi resetTrigger thay đổi
  React.useEffect(() => {
    if (resetTrigger && widgetId.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetId.current);
      } catch (e) {
        console.warn('Turnstile reset error:', e);
      }
    }
  }, [resetTrigger]);

  if (!siteKey) return null;
  return <div ref={container} aria-label="Xác minh bảo mật" />;
}
