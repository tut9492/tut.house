'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useIsMobile } from '../hooks/useIsMobile';

interface AboutWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  onImageClick?: (imageId: string, imageSrc: string, imageTitle: string) => void;
  onTextClick?: (textId: string, textContent: string, textTitle: string) => void;
  zIndex: number;
}

export default function AboutWindow({ title, onClose, isActive, onClick, onImageClick, onTextClick, zIndex }: AboutWindowProps) {
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
        className={`px-6 py-4 select-none ${isCompact ? '' : 'cursor-move'}`}
        onMouseDown={handleMouseDown}
        style={{ borderBottom: '1px solid #F3F4F6' }}
      >
        <span className="text-gray-600 text-sm font-normal">{title}</span>
      </div>

      <div className="px-6 pb-6 h-full bg-white overflow-auto">
        <div className="grid grid-cols-2 gap-x-16 gap-y-12 place-items-center mt-10 lg:flex lg:gap-16 lg:mt-8 lg:ml-8">

          <div
            className="flex flex-col items-center cursor-pointer group"
            onClick={(e) => { e.stopPropagation(); onImageClick?.('about-profile', '/assets/images/aboutProfilePicture.png', 'profile.jpg'); }}
          >
            <div className="w-28 h-28 lg:w-32 lg:h-32 mb-2 overflow-hidden rounded-lg">
              <Image
                src="/assets/images/aboutProfilePicture.png"
                alt="profile.jpg"
                width={128}
                height={128}
                className="object-cover w-full h-full"
              />
            </div>
            <span className="text-gray-600 text-xs">profile.jpg</span>
          </div>
          
          <div
            className="flex flex-col items-center cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              const bioContent = `EARLY DAYS

Since childhood, I’ve been captivated by the act of creation, from making music 
to crafting imaginative worlds with Lego. As a teenager, I transformed 
this passion into a new medium, building skateboard ramps and learning design. 
As I grew older, my focus shifted towards functional art, primarily 
woodworking projects and furniture.

HOME DESIGN

Over time, my professional career led me towards architecture and home design, 
where I honed my design skills and eventually began designing and building homes.

PHOTOGRAPHY

In 2013 I discovered a new passion for photography, particularly shooting 
film. As I delved deeper into the craft, I began to take it more seriously, 
entering competitions and learning new techniques using software like Photoshop and Lightroom.
I started getting some local recognition after placing in some gallery contests.

WEB 3

In 2019, I embarked on my web 3 journey, exploring the potential impact 
that this space could have on art. After a year of studying the space, I 
decided to mint my own genesis collection: Tut Genesis

My goal is to create art that sparks the imagination and evokes powerful emotions.

MY ART NOW

Currently, I’m experimenting with a process that involves creating AI images 
from my photos and then layering digital art elements to produce a new, 
cohesive artwork. This body of work centers around a central figure in a 
brutalist landscape, prompting viewers to explore their own existence. 
Through my art, I’ve come to realize that we often fail to truly explore 
ourselves until we’re alone with our thoughts and feelings.

This is an evolving document that will showcase my work as I experience my time as an artist.

I hope you have enjoyed learning a bit more about me and how I became an artist.
`;
              onTextClick?.('about-bio', bioContent, 'bio.txt');
            }}
          >
            <div className="w-28 h-28 lg:w-32 lg:h-32 mb-2 flex items-center justify-center">
              <Image
                src="/assets/images/fileIcon.png"
                alt="bio.txt"
                width={80}
                height={80}
                className="object-contain"
              />
            </div>
            <span className="text-gray-600 text-xs">bio.txt</span>
          </div>

          <div
            className="flex flex-col items-center cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              window.open('https://x.com/Tuteth_', '_blank', 'noopener,noreferrer');
            }}
          >
            <div className="w-28 h-28 lg:w-32 lg:h-32 mb-2 flex items-center justify-center">
              <Image
                src="/assets/images/x.png"
                alt="x.link"
                width={80}
                height={80}
                className="object-contain"
              />
            </div>
            <span className="text-gray-600 text-xs">x.link</span>
          </div>
        </div>
      </div>
    </div>
  );
}
