import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

/**
 * Sealflow wordmark. Embeds /static/logo.png inside an SVG wrapper so
 * callers can keep using className-based sizing (e.g. h-6 w-auto, h-8)
 * that the original upstream inline-SVG wordmark relied on. viewBox
 * matches the source PNG's pixel dimensions so width auto-derives to
 * the correct aspect ratio.
 */
export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 200" {...props}>
      <image href="/static/logo.png" x="0" y="0" width="720" height="200" />
    </svg>
  );
};
