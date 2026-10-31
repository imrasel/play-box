import { isInstalled } from './install';

// Inside a browser, iPhones blur the page beneath the status area and the bottom bar, and
// report no space for them. These are the smallest clear margins there, in screen pixels.
const IOS_TOP = 58;
const IOS_BOTTOM_UPRIGHT = 34;
const IOS_BOTTOM_SIDEWAYS = 20;

/**
 * Publishes the space the browser chrome really takes on this phone, as it stands right
 * now, so the layout follows it across models, rotation and bars sliding in and out.
 */
export function trackSafeSpace() {
  const root = document.documentElement.style;
  const measure = () => {
    const view = visualViewport;
    let top = view?.offsetTop ?? 0;
    let bottom = view ? Math.max(0, innerHeight - view.height - view.offsetTop) : 0;
    if (/iPhone|iPod/.test(navigator.userAgent) && !isInstalled()) {
      const upright = innerHeight > innerWidth;
      top = Math.max(top, upright ? IOS_TOP : 0);
      bottom = Math.max(bottom, upright ? IOS_BOTTOM_UPRIGHT : IOS_BOTTOM_SIDEWAYS);
    }
    root.setProperty('--floor-top', `${Math.round(top)}px`);
    root.setProperty('--floor-bottom', `${Math.round(bottom)}px`);
  };
  measure();
  visualViewport?.addEventListener('resize', measure);
  visualViewport?.addEventListener('scroll', measure);
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', () => setTimeout(measure, 300));
}
