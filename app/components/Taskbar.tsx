'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface TaskbarProps {
  openFolders: Array<{ id: string; name: string }>;
  activeWindow: string | null;
  onFolderClick: (folderId: string) => void;
  onMenuClick: () => void;
}

export default function Taskbar({ openFolders, activeWindow, onFolderClick, onMenuClick }: TaskbarProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-12 bg-white z-50 flex items-center justify-between px-4">
      <button
        onClick={onMenuClick}
        className="flex items-center gap-3 px-4 sm:px-6 py-2 bg-white hover:bg-gray-50 text-gray-900 transition-all border border-[#E5E7EB]"
        style={{ borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' }}
      >
        <div className="flex items-center justify-center">
          <Image
            src="/assets/images/taskBarMenuIcon.png"
            alt="Menu icon"
            width={16}
            height={16}
          />
        </div>
        <span className="text-base font-normal">Menu</span>
      </button>

      <div className="flex-1 hidden lg:flex items-center gap-2 px-4">
        {openFolders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => onFolderClick(folder.id)}
            className={`px-4 py-2 text-sm transition-colors w-32 h-9 text-left ${
              activeWindow === folder.id
                ? 'bg-gray-200 text-gray-900'
                : 'bg-transparent text-gray-600 hover:bg-gray-100'
            }`}
            style={
              activeWindow === folder.id
                ? { borderRadius: '10px' }
                : { borderRadius: '10px', border: '1px solid #E5E7EB' }
            }
          >
            {folder.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-gray-800">{time}</div>
      </div>
    </div>
  );
}
