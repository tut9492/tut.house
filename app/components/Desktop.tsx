'use client';

import { useState } from 'react';
import Image from 'next/image';
import Folder from './Folder';
import FolderWindow from './FolderWindow';
import Taskbar from './Taskbar';

export default function Desktop() {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [activeWindow, setActiveWindow] = useState<string | null>(null);

  const folders = [
    { id: 'physical-art', name: 'Physical Art' },
    { id: 'digital-art', name: 'Digital Art' },
    { id: 'buy-art', name: 'Buy Art' },
    { id: 'collectors-hub', name: 'Collectors Hub' },
    { id: 'about', name: 'About' },
  ];

  const handleFolderClick = (folderId: string) => {
    const newOpenFolders = new Set(openFolders);
    if (!newOpenFolders.has(folderId)) {
      newOpenFolders.add(folderId);
      setOpenFolders(newOpenFolders);
    }
    setActiveWindow(folderId);
  };

  const handleCloseWindow = (folderId: string) => {
    const newOpenFolders = new Set(openFolders);
    newOpenFolders.delete(folderId);
    setOpenFolders(newOpenFolders);
    if (activeWindow === folderId) {
      setActiveWindow(null);
    }
  };

  const handleWindowClick = (folderId: string) => {
    setActiveWindow(folderId);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <Image
        src="/assets/images/tutWebsiteWallpaper.png"
        alt="Desktop Background"
        fill
        className="object-cover"
        priority
      />

      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
        <Image
          src="/assets/images/tutLogo.png"
          alt="tut Logo"
          width={400}
          height={150}
          priority
        />
      </div>
      
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="flex items-center justify-center gap-50">
          {folders.map((folder) => (
            <Folder
              key={folder.id}
              id={folder.id}
              name={folder.name}
              onClick={() => handleFolderClick(folder.id)}
            />
          ))}
        </div>
      </div>

      {folders.map((folder) =>
        openFolders.has(folder.id) ? (
          <FolderWindow
            key={folder.id}
            id={folder.id}
            title={folder.name}
            onClose={() => handleCloseWindow(folder.id)}
            isActive={activeWindow === folder.id}
            onClick={() => handleWindowClick(folder.id)}
          />
        ) : null
      )}

      <Taskbar />
    </div>
  );
}
