'use client';

import Image from 'next/image';

interface FolderProps {
  id: string;
  name: string;
  onClick: () => void;
  /** Optional art/icon shown inside the folder. Falls back to the plain folder. */
  image?: string;
  /** When true, runs the idle light-sweep sheen across the folder. */
  shimmer?: boolean;
  /** Position in the row — staggers the sweep so the light travels across. */
  index?: number;
}

export default function Folder({ name, onClick, image, shimmer, index = 0 }: FolderProps) {
  return (
    <div
      className="flex flex-col items-center cursor-pointer group"
      onClick={onClick}
      onDoubleClick={onClick}
    >
      <div className="relative w-[58px] h-[58px] lg:w-36 lg:h-36 mb-1.5 lg:mb-3">
        <Image
          src="/assets/images/folderTut.png"
          alt={`${name} folder`}
          width={160}
          height={160}
          className="w-full h-full object-contain drop-shadow-xl transition-transform group-hover:scale-105"
        />
        {image && (
          <div className="absolute inset-0 flex items-end justify-center pb-[15%]">
            <div className="relative w-[64%] h-[54%] overflow-hidden rounded-md shadow-md ring-1 ring-black/10">
              <Image src={image} alt={name} fill sizes="160px" className="object-cover" />
            </div>
          </div>
        )}
        <div className={`folder-sheen${shimmer ? ' on' : ''}`} aria-hidden="true">
          <div className="band" style={{ animationDelay: `${index * 0.18}s` }} />
        </div>
      </div>

      <span className="text-white text-[11px] leading-tight lg:text-base lg:leading-normal font-semibold px-1 py-0.5 lg:py-1 text-center max-w-[100px] lg:max-w-[160px] break-words [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
        {name}
      </span>
    </div>
  );
}
