'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Folder from './Folder';
import FolderWindow from './windows/FolderWindow';
import CollectionWindow from './windows/CollectionWindow';
import CollectorsHubWindow from './windows/CollectorsHubWindow';
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

interface PrefetchedArtwork {
  id: string;
  title: string;
  src: string;
  collection?: string;
  chain?: string;
  technique?: string;
  permalink?: string;
}

export default function Desktop() {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [openImages, setOpenImages] = useState<OpenImage[]>([]);
  const [openTexts, setOpenTexts] = useState<OpenText[]>([]);
  const [activeWindow, setActiveWindow] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [windowStack, setWindowStack] = useState<string[]>([]);
  const [prefetchedBySlug, setPrefetchedBySlug] = useState<Record<string, PrefetchedArtwork[]>>({});

  const folders = [
    { id: 'physical-art', name: 'Physical Art', contentType: 'folders' as const },
    { id: 'digital-art', name: 'Digital Art', contentType: 'folders' as const },
    { id: 'buy-art', name: 'Buy Art', contentType: 'folders' as const },
    { id: 'collectors-hub', name: 'Collectors Hub', contentType: 'collectors-hub' as const },
    { id: 'about', name: 'About', contentType: 'about' as const },
    { id: 'collection-01', name: 'Collection_01', contentType: 'images' as const, openseaSlug: 'obsessive-cycles-of-fiber' },
    { id: 'collection-02', name: 'Collection_02', contentType: 'images' as const, openseaSlug: 'tut-1-1' },
    { id: 'collection-03', name: 'Collection_03', contentType: 'images' as const, openseaSlug: 'kingtut-genesis' },
  ];

  useEffect(() => {
    let cancelled = false;
    const slugs = ['obsessive-cycles-of-fiber', 'tut-1-1', 'kingtut-genesis'];

    const run = async () => {
      await Promise.all(
        slugs.map(async (slug) => {
          try {
            const res = await fetch(`/api/opensea/collection?slug=${slug}`);
            if (!res.ok) return;
            const data = await res.json();
            const artworks = (data?.artworks ?? []) as PrefetchedArtwork[];
            if (!artworks.length || cancelled) return;

            setPrefetchedBySlug(prev => (prev[slug] ? prev : { ...prev, [slug]: artworks }));

            if (typeof window !== 'undefined') {
              artworks.slice(0, 8).forEach((a) => {
                const img = new window.Image();
                img.decoding = 'async';
                img.src = a.src;
              });
            }
          } catch {}
        })
      );
    };

    const ric = (window as Window & { requestIdleCallback?: (cb: IdleRequestCallback) => number })
      .requestIdleCallback;

    if (typeof window !== 'undefined' && ric) {
      ric(() => run());
    } else {
      const t = setTimeout(() => run(), 600);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const handleFolderClick = (folderId: string) => {
    const newOpenFolders = new Set(openFolders);
    if (!newOpenFolders.has(folderId)) {
      newOpenFolders.add(folderId);
      setOpenFolders(newOpenFolders);
    }
    setActiveWindow(folderId);
    setWindowStack(prev => [...prev.filter(id => id !== folderId), folderId]);
  };

  const handleCloseWindow = (folderId: string) => {
    const newOpenFolders = new Set(openFolders);
    newOpenFolders.delete(folderId);
    setOpenFolders(newOpenFolders);
    if (activeWindow === folderId) {
      setActiveWindow(null);
    }
    setWindowStack(prev => prev.filter(id => id !== folderId));
  };

  const handleWindowClick = (folderId: string) => {
    setActiveWindow(folderId);
    setWindowStack(prev => [...prev.filter(id => id !== folderId), folderId]);
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
    setWindowStack(prev => [...prev.filter(id => id !== imageId), imageId]);
  };

  const handleCloseImage = (imageId: string) => {
    setOpenImages(openImages.filter(img => img.id !== imageId));
    if (activeWindow === imageId) {
      setActiveWindow(null);
    }
    setWindowStack(prev => prev.filter(id => id !== imageId));
  };

  const handleTextClick = (textId: string, textContent: string, textTitle: string) => {
    const existingText = openTexts.find(txt => txt.id === textId);
    if (!existingText) {
      setOpenTexts([...openTexts, { id: textId, content: textContent, title: textTitle }]);
    }
    setActiveWindow(textId);
    setWindowStack(prev => [...prev.filter(id => id !== textId), textId]);
  };

  const handleCloseText = (textId: string) => {
    setOpenTexts(openTexts.filter(txt => txt.id !== textId));
    if (activeWindow === textId) {
      setActiveWindow(null);
    }
    setWindowStack(prev => prev.filter(id => id !== textId));
  };

  const getZIndex = (windowId: string) => {
    const index = windowStack.indexOf(windowId);
    return index === -1 ? 40 : 40 + index;
  };

  return (
    <div className="relative w-full h-[100svh] overflow-hidden bg-black">
      <Image
        src="/assets/images/tutWebsiteWallpaper.png"
        alt="Desktop Background"
        fill
        className="object-cover"
        priority
      />

      <div className="absolute top-6 lg:top-8 left-1/2 -translate-x-1/2 z-10">
        <Image
          src="/assets/images/tutLogo.png"
          alt="tut Logo"
          width={400}
          height={150}
          className="w-[240px] lg:w-[400px] h-auto"
          priority
        />
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-[calc(100vw-2rem)] lg:w-auto">
          <div className="grid grid-cols-2 gap-x-16 gap-y-12 place-items-center lg:flex lg:flex-nowrap lg:items-center lg:justify-center lg:gap-[200px]">
            {folders
              .filter(f => ['physical-art', 'digital-art', 'buy-art', 'collectors-hub', 'about'].includes(f.id))
              .map((folder) => (
                <Folder
                  key={folder.id}
                  id={folder.id}
                  name={folder.name}
                  onClick={() => handleFolderClick(folder.id)}
                />
              ))}
          </div>
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
              zIndex={getZIndex(folder.id)}
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
              zIndex={getZIndex(folder.id)}
              openseaSlug={folder.openseaSlug}
              prefetchedArtworks={folder.openseaSlug ? prefetchedBySlug[folder.openseaSlug] : undefined}
            />
          );
        }

        if (folder.contentType === 'collectors-hub') {
          return (
            <CollectorsHubWindow
              key={folder.id}
              id={folder.id}
              title={folder.name}
              onClose={() => handleCloseWindow(folder.id)}
              isActive={activeWindow === folder.id}
              onClick={() => handleWindowClick(folder.id)}
              zIndex={getZIndex(folder.id)}
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
            zIndex={getZIndex(folder.id)}
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
          onClick={() => handleWindowClick(image.id)}
          zIndex={getZIndex(image.id)}
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
          onClick={() => handleWindowClick(text.id)}
          zIndex={getZIndex(text.id)}
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
