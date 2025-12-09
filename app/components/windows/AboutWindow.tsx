'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface AboutWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  onImageClick?: (imageId: string, imageSrc: string, imageTitle: string) => void;
  onTextClick?: (textId: string, textContent: string, textTitle: string) => void;
}

export default function AboutWindow({ title, onClose, isActive, onClick, onImageClick, onTextClick }: AboutWindowProps) {
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
        <div className="flex gap-16 mt-8 ml-8">

          <div
            className="flex flex-col items-center cursor-pointer group"
            onClick={() => onImageClick?.('about-profile', '/assets/images/aboutProfilePicture.png', 'profile.jpg')}
          >
            <div className="w-32 h-32 mb-2 overflow-hidden rounded-lg">
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
            onClick={() => {
              const bioContent = `Artist Biography

Hello! I'm a contemporary artist working across physical and digital mediums.

My work explores the intersection of traditional techniques and modern technology, creating pieces that challenge conventional boundaries between the tangible and the virtual.

Education:
- MFA in Fine Arts, 2018
- BFA in Digital Media, 2015

Selected Exhibitions:
- "Digital Dreams" - Contemporary Art Museum, 2023
- "Physical Meets Digital" - Gallery Modern, 2022
- "New Perspectives" - Art Space Gallery, 2021

My art is available for collection through various platforms including SuperRare, Foundation, and ExchangeArt. I'm always excited to connect with collectors and fellow artists.

For commissions and inquiries, please reach out through my website or social media channels.

Thank you for visiting my portfolio!`;
              onTextClick?.('about-bio', bioContent, 'bio.txt');
            }}
          >
            <div className="w-32 h-32 mb-2 flex items-center justify-center">
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
        </div>
      </div>
    </div>
  );
}
