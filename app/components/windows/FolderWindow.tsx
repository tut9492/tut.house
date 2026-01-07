'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface FolderWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  onSubfolderClick?: (subfolderId: string) => void;
  zIndex: number;
}

export default function FolderWindow({ title, onClose, isActive, onClick, onSubfolderClick, zIndex }: FolderWindowProps) {
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

  const windowStyle = isMaximized
    ? { top: 0, left: 0, width: '100%', height: 'calc(100% - 48px)' }
    : { top: position.y, left: position.x, width: '1000px', height: '650px' };

  return (
    <div
      ref={windowRef}
      className={`absolute bg-white rounded-2xl shadow-2xl overflow-hidden transition-shadow ${
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
        <div className="flex gap-40 mt-8 ml-8">
          <div
            className="flex flex-col items-center cursor-pointer group"
            onClick={(e) => { e.stopPropagation(); onSubfolderClick?.('collection-01'); }}
          >
            <Image
              src="/assets/images/folderTut.png"
              alt="Collection_01"
              width={64}
              height={64}
              className="mb-2"
            />
            <span className="text-gray-600 text-xs">Collection_01</span>
          </div>
          <div
            className="flex flex-col items-center cursor-pointer group"
            onClick={(e) => { e.stopPropagation(); onSubfolderClick?.('collection-02'); }}
          >
            <Image
              src="/assets/images/folderTut.png"
              alt="Collection_02"
              width={64}
              height={64}
              className="mb-2"
            />
            <span className="text-gray-600 text-xs">Collection_02</span>
          </div>
          <div
            className="flex flex-col items-center cursor-pointer group"
            onClick={(e) => { e.stopPropagation(); onSubfolderClick?.('collection-03'); }}
          >
            <Image
              src="/assets/images/folderTut.png"
              alt="Collection_03"
              width={64}
              height={64}
              className="mb-2"
            />
            <span className="text-gray-600 text-xs">Collection_03</span>
          </div>
        </div>
      </div>
    </div>
  );
}
