'use client';

import FullscreenFrame from './FullscreenFrame';

interface DesignAgencyWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
}

const services = [
  {
    id: 'branding',
    name: 'Branding',
    description: 'Visual identity systems, logos, and brand guidelines that define your creative presence.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    id: 'web-design',
    name: 'Web Design',
    description: 'Custom websites and digital experiences built with modern frameworks and clean aesthetics.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </svg>
    ),
  },
  {
    id: 'ui-ux',
    name: 'UI/UX',
    description: 'Intuitive interfaces and user flows designed for seamless digital interactions.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'art-direction',
    name: 'Art Direction',
    description: 'Creative direction for campaigns, editorials, and visual storytelling projects.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    id: 'print',
    name: 'Print Design',
    description: 'Posters, packaging, zines, and tangible design pieces crafted with precision.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9V2h12v7" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
    ),
  },
  {
    id: 'packaging',
    name: 'Packaging',
    description: 'Product packaging and unboxing experiences that elevate your physical goods.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="M3.27 6.96L12 12.01l8.73-5.05" />
        <path d="M12 22.08V12" />
      </svg>
    ),
  },
];

export default function DesignAgencyWindow({ title, onClose, onClick, zIndex }: DesignAgencyWindowProps) {
  return (
    <FullscreenFrame title={title} onClose={onClose} onClick={onClick} zIndex={zIndex}>
      <div className="fsw-inner">
        <div className="mb-10 text-center">
          <h2 className="text-gray-800 text-2xl font-semibold mb-2">Creative Agency</h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Creative solutions for brands, products, and digital experiences.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((service) => (
            <div
              key={service.id}
              className="p-6 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-all cursor-default"
            >
              <div className="mb-3">{service.icon}</div>
              <h3 className="text-gray-800 text-sm font-semibold mb-1">{service.name}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <button
            onClick={() => window.open('https://x.com/Tuteth_', '_blank', 'noopener,noreferrer')}
            className="px-8 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Get in Touch
          </button>
        </div>
      </div>
    </FullscreenFrame>
  );
}
