'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useIsMobile } from '../hooks/useIsMobile';

interface SubfolderItem {
  id: string;
  name: string;
  /** When set, clicking opens this URL in a new tab instead of calling onSubfolderClick */
  href?: string;
}

interface FolderWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  onSubfolderClick?: (subfolderId: string) => void;
  zIndex: number;
  subfolders?: SubfolderItem[];
}

const DEFAULT_SUBFOLDERS: SubfolderItem[] = [
  { id: 'collection-01', name: 'Collection_01' },
  { id: 'collection-02', name: 'Collection_02' },
  { id: 'collection-03', name: 'Collection_03' },
];

export default function FolderWindow({ title, onClose, isActive, onClick, onSubfolderClick, zIndex, subfolders }: FolderWindowProps) {
  const items = subfolders?.length ? subfolders : DEFAULT_SUBFOLDERS;
  const isCompact = useIsMobile(1024);
  const [position, setPosition] = useState(() => ({
    x: Math.floor(Math.random() * (window.innerWidth - 1000)) + 50,
    y: Math.floor(Math.random() * (window.innerHeight - 650)) + 50,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const isMaximized = false;
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

  const windowStyle = isMaximized
    ? { top: 0, left: 0, width: '100%', height: 'calc(100% - 48px)' }
    : isCompact
      ? {
          top: '12px',
          left: '12px',
          right: '12px',
          bottom: '60px',
        }
      : { top: position.y, left: position.x, width: '1000px', height: '650px' };

  return (
    <div
      ref={windowRef}
      className={`${isCompact ? 'fixed' : 'absolute'} bg-white rounded-2xl shadow-2xl overflow-hidden transition-shadow ${
        isActive ? 'shadow-2xl' : 'opacity-95'
      }`}
      style={{ ...windowStyle, zIndex }}
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
        <div
          className="grid grid-rows-2 place-items-center gap-10 mt-10 lg:mt-8"
          style={{
            gridTemplateColumns: `repeat(${Math.ceil(items.length / 2)}, 1fr)`,
          }}
        >
          {items.map((sub) => (
            <div
              key={sub.id}
              className="flex flex-col items-center cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                if (sub.href) {
                  window.open(sub.href, '_blank', 'noopener,noreferrer');
                } else {
                  onSubfolderClick?.(sub.id);
                }
              }}
            >
              <Image
                src="/assets/images/folderTut.png"
                alt={sub.name}
                width={64}
                height={64}
                className="mb-2"
              />
              <span className="text-gray-600 text-xs text-center">{sub.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
