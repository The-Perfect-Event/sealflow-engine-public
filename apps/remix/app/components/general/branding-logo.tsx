import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

/**
 * Sealflow wordmark. Embeds the logo PNG inside an SVG wrapper so callers can
 * keep using className-based sizing (e.g. h-6 w-auto, h-8) that the original
 * upstream inline-SVG wordmark relied on. viewBox matches the source PNG's
 * pixel dimensions so width auto-derives to the correct aspect ratio.
 *
 * The mark is a dark-purple PNG that blends into dark surfaces, so we swap to
 * a light (white, checkmark-cutout) variant in dark mode via display toggling —
 * the SVG wrapper (and therefore all caller sizing) is unchanged; only the
 * inner image swaps. Supersedes the runtime brightness/saturate hot-patch and
 * per-call-site filters (sealflow#19). `dark:` never applies in the light PDF
 * certificate context, so those keep the purple mark.
 */
export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 200" {...props}>
      <image className="dark:hidden" href="/static/logo.png" x="0" y="0" width="720" height="200" />
      <image className="hidden dark:block" href="/static/logo-dark.png" x="0" y="0" width="720" height="200" />
    </svg>
  );
};
