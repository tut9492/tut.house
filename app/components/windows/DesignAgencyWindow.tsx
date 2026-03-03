'use client';

import { useState, useRef, useEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

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

export default function DesignAgencyWindow({ title, onClose, isActive, onClick, zIndex }: DesignAgencyWindowProps) {
  const isCompact = useIsMobile(1024);
  const [position, setPosition] = useState(() => ({
    x: Math.floor(Math.random() * (window.innerWidth - 1000)) + 50,
    y: Math.floor(Math.random() * (window.innerHeight - 650)) + 50,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-controls')) return;
    if (isCompact) return;

    onClick();
    setIsDragging(true);
    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  useEffect(() => {
    if (isCompact) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, isCompact]);

  return (
    <div
      ref={windowRef}
      className={`${isCompact ? 'fixed' : 'absolute'} bg-white rounded-2xl shadow-2xl overflow-hidden transition-shadow ${
        isActive ? 'shadow-2xl' : 'opacity-95'
      }`}
      style={
        isCompact
          ? {
              top: '12px',
              left: '12px',
              right: '12px',
              bottom: '60px',
              zIndex,
            }
          : { top: position.y, left: position.x, width: '1000px', height: '650px', zIndex }
      }
      onClick={onClick}
    >
      <button
        className="absolute top-4 right-4 w-3 h-3 bg-red-500 hover:bg-red-600 rounded-full z-10 window-controls"
        onClick={onClose}
      />

      <div
        className="px-6 py-4 cursor-move select-none"
        onMouseDown={handleMouseDown}
        style={{ borderBottom: '1px solid #F3F4F6' }}
      >
        <span className="text-gray-600 text-sm font-normal">{title}</span>
      </div>

      <div className="px-6 pb-6 h-[calc(100%-56px)] bg-white overflow-auto">
        <div className="mt-8 mb-8 text-center">
          <h2 className="text-gray-800 text-xl font-medium mb-2">Design Agency</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Creative solutions for brands, products, and digital experiences.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <div
              key={service.id}
              className="p-5 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-default"
            >
              <div className="mb-3">{service.icon}</div>
              <h3 className="text-gray-700 text-sm font-medium mb-1">{service.name}</h3>
              <p className="text-gray-400 text-xs leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => window.open('https://x.com/Tuteth_', '_blank', 'noopener,noreferrer')}
            className="px-8 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Get in Touch
          </button>
        </div>
      </div>
    </div>
  );
}
