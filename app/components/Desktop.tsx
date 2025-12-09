'use client';

import { useState } from 'react';
import Image from 'next/image';
import Folder from './Folder';
import FolderWindow from './windows/FolderWindow';
import CollectionWindow from './windows/CollectionWindow';
import ImageViewerWindow from './windows/ImageViewerWindow';
import TextViewerWindow from './windows/TextViewerWindow';
import AboutWindow from './windows/AboutWindow';
import Taskbar from './Taskbar';
import Menu from './Menu';

interface OpenImage {
  id: string;
  src: string;
  title: string;
}

interface OpenText {
  id: string;
  content: string;
  title: string;
}

export default function Desktop() {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [openImages, setOpenImages] = useState<OpenImage[]>([]);
  const [openTexts, setOpenTexts] = useState<OpenText[]>([]);
  const [activeWindow, setActiveWindow] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const folders = [
    { id: 'physical-art', name: 'Physical Art', contentType: 'folders' as const },
    { id: 'digital-art', name: 'Digital Art', contentType: 'folders' as const },
    { id: 'buy-art', name: 'Buy Art', contentType: 'folders' as const },
    { id: 'collectors-hub', name: 'Collectors Hub', contentType: 'folders' as const },
    { id: 'about', name: 'About', contentType: 'about' as const },
    { id: 'collection-01', name: 'Collection_01', contentType: 'images' as const },
    { id: 'collection-02', name: 'Collection_02', contentType: 'images' as const },
    { id: 'collection-03', name: 'Collection_03', contentType: 'images' as const },
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

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleMenuClose = () => {
    setIsMenuOpen(false);
  };

  const handleImageClick = (imageId: string, imageSrc: string, imageTitle: string) => {
    const existingImage = openImages.find(img => img.id === imageId);
    if (!existingImage) {
      setOpenImages([...openImages, { id: imageId, src: imageSrc, title: imageTitle }]);
    }
    setActiveWindow(imageId);
  };

  const handleCloseImage = (imageId: string) => {
    setOpenImages(openImages.filter(img => img.id !== imageId));
    if (activeWindow === imageId) {
      setActiveWindow(null);
    }
  };

  const handleTextClick = (textId: string, textContent: string, textTitle: string) => {
    const existingText = openTexts.find(txt => txt.id === textId);
    if (!existingText) {
      setOpenTexts([...openTexts, { id: textId, content: textContent, title: textTitle }]);
    }
    setActiveWindow(textId);
  };

  const handleCloseText = (textId: string) => {
    setOpenTexts(openTexts.filter(txt => txt.id !== textId));
    if (activeWindow === textId) {
      setActiveWindow(null);
    }
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
          {folders.filter(f => ['physical-art', 'digital-art', 'buy-art', 'collectors-hub', 'about'].includes(f.id)).map((folder) => (
            <Folder
              key={folder.id}
              id={folder.id}
              name={folder.name}
              onClick={() => handleFolderClick(folder.id)}
            />
          ))}
        </div>
      </div>

      {folders.map((folder) => {
        if (!openFolders.has(folder.id)) return null;

        if (folder.contentType === 'about') {
          return (
            <AboutWindow
              key={folder.id}
              id={folder.id}
              title={folder.name}
              onClose={() => handleCloseWindow(folder.id)}
              isActive={activeWindow === folder.id}
              onClick={() => handleWindowClick(folder.id)}
              onImageClick={handleImageClick}
              onTextClick={handleTextClick}
            />
          );
        }

        if (folder.contentType === 'images') {
          return (
            <CollectionWindow
              key={folder.id}
              id={folder.id}
              title={folder.name}
              onClose={() => handleCloseWindow(folder.id)}
              isActive={activeWindow === folder.id}
              onClick={() => handleWindowClick(folder.id)}
              onImageClick={handleImageClick}
            />
          );
        }

        return (
          <FolderWindow
            key={folder.id}
            id={folder.id}
            title={folder.name}
            onClose={() => handleCloseWindow(folder.id)}
            isActive={activeWindow === folder.id}
            onClick={() => handleWindowClick(folder.id)}
            onSubfolderClick={handleFolderClick}
          />
        );
      })}

      {openImages.map((image) => (
        <ImageViewerWindow
          key={image.id}
          id={image.id}
          title={image.title}
          imageSrc={image.src}
          onClose={() => handleCloseImage(image.id)}
          isActive={activeWindow === image.id}
          onClick={() => setActiveWindow(image.id)}
        />
      ))}
      
      {openTexts.map((text) => (
        <TextViewerWindow
          key={text.id}
          id={text.id}
          title={text.title}
          content={text.content}
          onClose={() => handleCloseText(text.id)}
          isActive={activeWindow === text.id}
          onClick={() => setActiveWindow(text.id)}
        />
      ))}

      <Taskbar
        openFolders={[
          ...Array.from(openFolders).map(id => {
            const folder = folders.find(f => f.id === id);
            return { id, name: folder?.name || '' };
          }),
          ...openImages.map(img => ({ id: img.id, name: img.title })),
          ...openTexts.map(txt => ({ id: txt.id, name: txt.title }))
        ]}
        activeWindow={activeWindow}
        onFolderClick={handleWindowClick}
        onMenuClick={handleMenuToggle}
      />

      <Menu
        isOpen={isMenuOpen}
        onClose={handleMenuClose}
        onFolderClick={handleFolderClick}
      />
    </div>
  );
}
