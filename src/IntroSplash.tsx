import { useState } from 'react';
import { GlassIconReveal } from './components/ui/liquid-glass-logo-reveal';

// Opening screen: the app icon is revealed by a liquid-glass tile (WebGL) while the app loads underneath.
// TEST MODE: only shown when the address has `?intro=1` (so real users are not affected yet).
// To make it permanent change TEST_ONLY to false; `?intro=0` then turns it off. Tap skips it; skipped for reduced-motion users.
const TEST_ONLY = true;
const BG = '#05070c';
const skip = (() => {
  try {
    const q = new URLSearchParams(window.location.search).get('intro');
    return q === '0' || (TEST_ONLY && q !== '1')
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
})();

export default function IntroSplash() {
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>(skip ? 'gone' : 'show');
  if (phase === 'gone') return null;
  const fade = () => { setPhase(p => (p === 'show' ? 'fade' : p)); window.setTimeout(() => setPhase('gone'), 450); };
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100000, background: BG,
        opacity: phase === 'fade' ? 0 : 1, transition: 'opacity 0.45s ease',
        pointerEvents: phase === 'fade' ? 'none' : 'auto',
      }}
      onClick={fade}
    >
      <GlassIconReveal
        logo="/logo-splash.png"
        label="אוהל סמרט"
        look="dark"
        loop={false}
        speed={1.2}
        originalColors
        background={BG}
        plateColor="#0a1030"
        tileSize={380}
        logoScale={0.62}
        finalScale={1}
        onFinished={() => window.setTimeout(fade, 600)}
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  );
}
