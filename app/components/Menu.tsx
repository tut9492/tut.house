'use client';

import Image from 'next/image';

interface MenuProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderClick: (folderId: string) => void;
}

export default function Menu({ isOpen, onClose, onFolderClick }: MenuProps) {
  if (!isOpen) return null;

  const menuItems = [
    { id: 'physical-art', name: 'Physical Art', icon: '/assets/images/folderTut.png' },
    { id: 'digital-art', name: 'Digital Art', icon: '/assets/images/folderTut.png' },
    { id: 'buy-art', name: 'Buy Art', icon: '/assets/images/folderTut.png' },
    { id: 'collectors-hub', name: 'Collectors Hub', icon: '/assets/images/folderTut.png' },
    { id: 'about', name: 'About', icon: '/assets/images/folderTut.png' },
  ];

  const handleItemClick = (folderId: string) => {
    onFolderClick(folderId);
    onClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      <div className="absolute bottom-14 left-4 w-96 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
            <Image
              src="/assets/images/tutLogo.png"
              alt="User"
              width={48}
              height={48}
              className="rounded-full"
            />
            <div>
              <div className="text-gray-900 font-medium">User</div>
              <div className="text-gray-500 text-sm">tut fam</div>
            </div>
          </div>

          <div className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <Image
                  src={item.icon}
                  alt={item.name}
                  width={24}
                  height={24}
                />
                <span className="text-gray-700">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
