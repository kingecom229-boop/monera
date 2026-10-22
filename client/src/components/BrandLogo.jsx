import { useAuth } from '../context/AuthContext';

export default function BrandLogo({ variant = 'dark', size = 'md', className = '' }) {
  const { siteSettings } = useAuth();
  const customLogo = siteSettings?.customLogoUrl;

  const sizeMap = {
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-11',
    xl: 'h-14',
  };

  const src = customLogo
    ? customLogo
    : variant === 'light'
      ? '/assets/logo-navy.png'
      : '/assets/logo.png';

  return (
    <span className={`inline-flex items-center select-none ${className}`}>
      <img
        src={src}
        alt={siteSettings?.bankName || 'MONERA'}
        className={`${sizeMap[size] || sizeMap.md} w-auto object-contain`}
      />
    </span>
  );
}
