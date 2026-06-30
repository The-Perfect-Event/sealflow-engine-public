import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

/**
 * Sealflow icon (square / favicon-style mark). Embeds /static/logo_icon.png
 * inside an SVG wrapper for className-based sizing parity with the original
 * upstream inline-SVG icon.
 */
export const BrandingLogoIcon = ({ ...props }: LogoProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 84" {...props}>
      <image href="/static/logo_icon.png" x="0" y="0" width="84" height="84" />
    </svg>
  );
};
