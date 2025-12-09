'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface FolderWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
}

export default function FolderWindow({ title, onClose, isActive, onClick }: FolderWindowProps) {
  const [position, setPosition] = useState({ x: 200, y: 150 });
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

  const handleMaximize = () => {
    if (!isMaximized) {
      setPrevPosition(position);
      setIsMaximized(true);
    } else {
      setPosition(prevPosition);
      setIsMaximized(false);
    }
  };

  const windowStyle = isMaximized
    ? { top: 0, left: 0, width: '100%', height: 'calc(100% - 48px)' }
    : { top: position.y, left: position.x, width: '600px', height: '400px' };

  return (
    <div
      ref={windowRef}
      className={`absolute bg-gray-100 rounded-t-lg shadow-2xl overflow-hidden transition-shadow ${
        isActive ? 'z-50 shadow-2xl' : 'z-40 opacity-95'
      }`}
      style={windowStyle}
      onClick={onClick}
    >

      <div
        className={`flex items-center justify-between px-3 py-2 cursor-move select-none ${
          isActive
            ? 'bg-gradient-to-r from-blue-600 to-blue-500'
            : 'bg-gradient-to-r from-gray-500 to-gray-400'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5">
            <Image
              src="/assets/images/folderTut.png"
              alt="Folder icon"
              width={20}
              height={20}
            />
          </div>
          <span className="text-white font-semibold text-sm">{title}</span>
        </div>
        <div className="flex gap-1 window-controls">
          <button
            className="w-6 h-6 bg-gray-300 hover:bg-gray-400 rounded flex items-center justify-center text-gray-700 font-bold text-xs"
            onClick={() => {}}
          >
            _
          </button>
          <button
            className="w-6 h-6 bg-gray-300 hover:bg-gray-400 rounded flex items-center justify-center text-gray-700 font-bold text-xs"
            onClick={handleMaximize}
          >
            {isMaximized ? '❐' : '□'}
          </button>
          <button
            className="w-6 h-6 bg-red-500 hover:bg-red-600 rounded flex items-center justify-center text-white font-bold text-xs"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="bg-gray-200 px-2 py-1 text-xs flex gap-3 border-b border-gray-300">
        <span className="hover:bg-blue-500 hover:text-white px-2 py-1 rounded cursor-pointer">File</span>
        <span className="hover:bg-blue-500 hover:text-white px-2 py-1 rounded cursor-pointer">Edit</span>
        <span className="hover:bg-blue-500 hover:text-white px-2 py-1 rounded cursor-pointer">View</span>
        <span className="hover:bg-blue-500 hover:text-white px-2 py-1 rounded cursor-pointer">Help</span>
      </div>
      
      <div className="p-6 h-full bg-white overflow-auto">
        <div className="flex flex-col items-center justify-center h-full text-gray-600">
          <div className="w-24 h-24 mb-4">
            <Image
              src="/assets/images/folderTut.png"
              alt="Empty folder"
              width={96}
              height={96}
            />
          </div>
          <p className="text-lg">This folder is empty</p>
          <p className="text-sm mt-2">Content will be added later</p>
        </div>
      </div>
    </div>
  );
}
