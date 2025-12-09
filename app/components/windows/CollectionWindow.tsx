'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface CollectionWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  onImageClick?: (imageId: string, imageSrc: string, imageTitle: string) => void;
}

export default function CollectionWindow({ title, onClose, isActive, onClick, onImageClick }: CollectionWindowProps) {
  const getRandomPosition = () => ({
    x: Math.floor(Math.random() * (window.innerWidth - 1000)) + 50,
    y: Math.floor(Math.random() * (window.innerHeight - 650)) + 50,
  });

  const [position, setPosition] = useState(getRandomPosition());
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevPosition, setPrevPosition] = useState({ x: 200, y: 150 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-controls')) return;

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
      if (isDragging && !isMaximized) {
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
  }, [isDragging, dragOffset, isMaximized]);

  const windowStyle = isMaximized
    ? { top: 0, left: 0, width: '100%', height: 'calc(100% - 48px)' }
    : { top: position.y, left: position.x, width: '1000px', height: '650px' };

  return (
    <div
      ref={windowRef}
      className={`absolute bg-white rounded-2xl shadow-2xl overflow-hidden transition-shadow ${
        isActive ? 'z-50 shadow-2xl' : 'z-40 opacity-95'
      }`}
      style={windowStyle}
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
      
      <div className="px-6 pb-6 h-full bg-white overflow-auto">
        <div className="flex gap-8 mt-8 ml-8">
          {[1, 2, 3, 4].map((num) => {
            const imageTitle = `artwork_0${num}.jpg`;
            const imageId = `${title.toLowerCase().replace(/\s+/g, '-')}-artwork-0${num}`;
            return (
              <div
                key={num}
                className="flex flex-col items-center cursor-pointer group"
                onClick={() => onImageClick?.(imageId, '/assets/images/placeholderImage.png', imageTitle)}
              >
                <div className="w-32 h-32 mb-2 overflow-hidden rounded-lg">
                  <Image
                    src="/assets/images/placeholderImage.png"
                    alt={imageTitle}
                    width={128}
                    height={128}
                    className="object-cover w-full h-full"
                  />
                </div>
                <span className="text-gray-600 text-xs">{imageTitle}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
