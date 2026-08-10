'use client';

import Image from 'next/image';
import FullscreenFrame from './FullscreenFrame';

interface PhysicalArtWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
}

export default function PhysicalArtWindow({ title, onClose, onClick, zIndex }: PhysicalArtWindowProps) {
  return (
    <FullscreenFrame title={title} onClose={onClose} onClick={onClick} zIndex={zIndex}>
      <div className="fsw-center">
        <div>
          <Image
            src="/assets/images/folderTut.png"
            alt="Physical Art"
            width={110}
            height={110}
            className="mx-auto mb-4"
            style={{ opacity: 0.55 }}
          />
          <p style={{ font: '600 15px/1 "Segoe UI",sans-serif', letterSpacing: '.04em', color: '#9a9aa2', textTransform: 'uppercase' }}>
            Coming Soon
          </p>
        </div>
      </div>
    </FullscreenFrame>
  );
}
