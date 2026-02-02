'use client';

import Image from 'next/image';

interface FolderProps {
  id: string;
  name: string;
  onClick: () => void;
}

export default function Folder({ name, onClick }: FolderProps) {
  return (
    <div
      className="flex flex-col items-center cursor-pointer group"
      onClick={onClick}
      onDoubleClick={onClick}
    >
      
      <div className="relative w-16 h-16 lg:w-20 lg:h-20 mb-2">
        <Image
          src="/assets/images/folderTut.png"
          alt={`${name} folder`}
          width={80}
          height={80}
          className="drop-shadow-lg transition-transform group-hover:scale-110"
        />
      </div>

      <span className="text-white text-xs lg:text-sm font-medium px-2 py-1 text-center max-w-[140px] break-words">
        {name}
      </span>
    </div>
  );
}
