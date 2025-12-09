'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface ImageViewerWindowProps {
  id: string;
  title: string;
  imageSrc: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
}

export default function ImageViewerWindow({ title, imageSrc, onClose, isActive, onClick }: ImageViewerWindowProps) {
  const getRandomPosition = () => ({
    x: Math.floor(Math.random() * (window.innerWidth - 900)) + 50,
    y: Math.floor(Math.random() * (window.innerHeight - 700)) + 50,
  });

  const [position, setPosition] = useState(getRandomPosition());
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-controls')) return;
    if ((e.target as HTMLElement).closest('.view-original-btn')) return;

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
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={windowRef}
      className={`absolute bg-white rounded-2xl shadow-2xl overflow-hidden transition-shadow ${
        isActive ? 'z-50 shadow-2xl' : 'z-40 opacity-95'
      }`}
      style={{ top: position.y, left: position.x, width: '900px', height: '700px' }}
      onClick={onClick}
    >

      <button
        className="absolute top-4 right-4 w-3 h-3 bg-red-500 hover:bg-red-600 rounded-full z-10 window-controls"
        onClick={onClose}
      />

      <div
        className="px-6 py-4 cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <span className="text-gray-600 text-sm font-normal">{title}</span>
      </div>

      <div className="flex items-center justify-center" style={{ height: 'calc(100% - 120px)' }}>
        <div className="relative w-full h-full flex items-center justify-center p-8">
          <Image
            src={imageSrc}
            alt={title}
            width={500}
            height={500}
            className="object-contain max-w-full max-h-full"
          />
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900 px-6 py-4">
        <button
          className="w-full flex items-center justify-center gap-2 text-white text-sm font-medium hover:text-gray-300 transition-colors view-original-btn"
          onClick={() => window.open(imageSrc, '_blank')}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          View Original
        </button>
      </div>
    </div>
  );
}
