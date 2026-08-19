'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Folder from './Folder';
import CollectionWindow from './windows/CollectionWindow';
import CollectorsHubWindow from './windows/CollectorsHubWindow';
import AbstractProviders from './AbstractProviders';
import PhysicalArtWindow from './windows/PhysicalArtWindow';
import ImageViewerWindow from './windows/ImageViewerWindow';
import TextViewerWindow from './windows/TextViewerWindow';
import AboutWindow from './windows/AboutWindow';
import DesignAgencyWindow from './windows/DesignAgencyWindow';
import Taskbar from './Taskbar';
import { AudioProvider } from './audio/AudioProvider';
import AudioControls from './audio/AudioControls';
import GalleryFolderWindow, { type GalleryCollection } from './windows/GalleryFolderWindow';
import LeaderboardWindow from './windows/LeaderboardWindow';
import PublicProfileWindow from './windows/PublicProfileWindow';
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
  const [collectionNamesBySlug, setCollectionNamesBySlug] = useState<Record<string, string>>({});
  const [openProfile, setOpenProfile] = useState<{ wallet: string; username: string } | null>(null);
  const [prefetchDone, setPrefetchDone] = useState(false);
  const [stale, setStale] = useState(false);

  const handleOpenProfile = (wallet: string, username: string) => {
    setOpenProfile({ wallet, username });
    setActiveWindow('public-profile');
    setWindowStack(prev => [...prev.filter(id => id !== 'public-profile'), 'public-profile']);
  };

  // Idle detection: after 5s of no interaction the desktop is "stale" and the folders run a
  // light-sweep sheen. Any activity cancels it and restarts the countdown.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const markActive = () => {
      setStale(false);
      clearTimeout(timer);
      timer = setTimeout(() => setStale(true), 5000);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    markActive();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, markActive));
    };
  }, []);

  const folders = [
    { id: 'collectors-hub', name: 'Collectors Hub', contentType: 'collectors-hub' as const },
    { id: 'leaderboard', name: 'Leaderboard', contentType: 'leaderboard' as const },
    { id: 'digital-art', name: 'Digital Art', contentType: 'folders' as const },
    { id: 'design-agency', name: 'Creative Agency', contentType: 'design-agency' as const },
    { id: 'physical-art', name: 'Physical Art', contentType: 'physical-art' as const },
    { id: 'about', name: 'About', contentType: 'about' as const },
    { id: 'collection-01', name: 'Collection_01', contentType: 'images' as const, openseaSlug: 'obsessive-cycles-of-fiber' },
    { id: 'collection-02', name: 'Collection_02', contentType: 'images' as const, openseaSlug: 'tut-1-1' },
    { id: 'collection-03', name: 'Collection_03', contentType: 'images' as const, openseaSlug: 'kingtut-genesis' },
    { id: 'abstractions', name: 'Abstractions', contentType: 'images' as const, openseaSlug: 'abstractions', limit: 20 },
    { id: 'tut-editions', name: 'TUT EDITIONS', contentType: 'images' as const, openseaSlug: 'tut-editions', limit: 2 },
    { id: 'tut-loudio', name: 'Tut Loudio', contentType: 'images' as const, openseaSlug: 'tut-loudio', limit: 20 },
  ];

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch('/api/opensea/prefetch');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          collections?: Record<string, { artworks?: PrefetchedArtwork[]; collectionName?: string | null }>;
        };
        const collections = data?.collections ?? {};
        if (cancelled) return;

        const nextBySlug: Record<string, PrefetchedArtwork[]> = {};
        const nextNames: Record<string, string> = {};
        for (const [slug, entry] of Object.entries(collections)) {
          const artworks = (entry?.artworks ?? []) as PrefetchedArtwork[];
          if (artworks.length) nextBySlug[slug] = artworks;
          if (entry?.collectionName) nextNames[slug] = entry.collectionName;
        }
        setPrefetchedBySlug(prev => ({ ...prev, ...nextBySlug }));
        setCollectionNamesBySlug(prev => ({ ...prev, ...nextNames }));

        if (typeof window !== 'undefined') {
          Object.values(nextBySlug).flat().slice(0, 24).forEach((a) => {
            const img = new window.Image();
            img.decoding = 'async';
            img.src = a.src;
          });
        }
      } catch {
        // ignore — covers just fall back to placeholders
      } finally {
        if (!cancelled) setPrefetchDone(true);
      }
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

  // A mobile Discord OAuth return lands on "/?discord_code=…" (no popup opener to hand off to).
  // Auto-open the Collectors Hub so it mounts, reads the code off the URL, and finishes the role
  // grant. Without this the Hub stays closed and the redirected code is never picked up.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!new URLSearchParams(window.location.search).has('discord_code')) return;
    setOpenFolders(prev => (prev.has('collectors-hub') ? prev : new Set(prev).add('collectors-hub')));
    setActiveWindow('collectors-hub');
    setWindowStack(prev => [...prev.filter(id => id !== 'collectors-hub'), 'collectors-hub']);
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
    <AudioProvider>
    <div className="relative w-full h-[100svh] overflow-hidden bg-black">
      {/* dusk background: cloud photo base + pink gradient blended above (matches the Hub) */}
      <div
        className="absolute inset-0"
        style={{ background: '#c3b8cb url(/assets/images/hubClouds.jpg) center/cover no-repeat' }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'url(/assets/images/hubPink.jpg) center/cover no-repeat', opacity: 0.6, mixBlendMode: 'multiply' }}
      />

      {/* music: play / skip, top-right (shared across every fullscreen window) */}
      <AudioControls className="absolute top-6 right-6 lg:top-8 lg:right-8 z-30" />

      {/* small black tut wordmark + identity tagline, top-left (matches the Hub). The tagline states
          plainly this is an artist's portfolio — visible to first-time visitors and crawlers alike. */}
      <div className="absolute top-6 left-6 lg:top-8 lg:left-8 z-10">
        <Image
          src="/assets/images/tutLogo.png"
          alt="Tut — digital artist"
          width={120}
          height={52}
          className="w-[92px] lg:w-[110px] h-auto"
          style={{ filter: 'brightness(0)' }}
          priority
        />
        <p className="mt-1.5 font-mono text-[9.5px] lg:text-[11px] font-bold uppercase tracking-[0.16em] text-black/75 whitespace-nowrap">
          Digital Artist · Official Portfolio
        </p>
      </div>

      <div className="absolute inset-x-0 top-0 bottom-12 z-10 flex items-center justify-center pt-24 pb-6 lg:inset-0 lg:bottom-0 lg:py-0">
        <div className="w-[calc(100vw-4rem)] lg:w-auto">
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 place-items-center lg:flex lg:flex-nowrap lg:items-center lg:justify-center lg:gap-[72px]">
            {folders
              .filter(f => ['physical-art', 'digital-art', 'collectors-hub', 'leaderboard', 'about', 'design-agency'].includes(f.id))
              .map((folder, i) => (
                <Folder
                  key={folder.id}
                  id={folder.id}
                  name={folder.name}
                  onClick={() => handleFolderClick(folder.id)}
                  shimmer={stale}
                  index={i}
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
          const slugFolder = folder as typeof folder & { openseaSlug?: string; limit?: number };
          const collectionTitle = slugFolder.openseaSlug
            ? (collectionNamesBySlug[slugFolder.openseaSlug] || folder.name)
            : folder.name;
          return (
            <CollectionWindow
              key={folder.id}
              id={folder.id}
              title={collectionTitle}
              onClose={() => handleCloseWindow(folder.id)}
              isActive={activeWindow === folder.id}
              onClick={() => handleWindowClick(folder.id)}
              zIndex={getZIndex(folder.id)}
              openseaSlug={slugFolder.openseaSlug}
              limit={slugFolder.limit}
              prefetchedArtworks={slugFolder.openseaSlug ? prefetchedBySlug[slugFolder.openseaSlug] : undefined}
              onArtworksLoaded={(slug, artworks) => {
                setPrefetchedBySlug(prev => (prev[slug] ? prev : { ...prev, [slug]: artworks }));
              }}
            />
          );
        }

        if (folder.contentType === 'collectors-hub') {
          // AbstractProviders (wagmi + AGW) is scoped to the Hub so it only loads when this window
          // opens — the landing page never mounts the AGW stack, containing any provider fault here.
          return (
            <AbstractProviders key={folder.id}>
              <CollectorsHubWindow
                id={folder.id}
                title={folder.name}
                onClose={() => handleCloseWindow(folder.id)}
                isActive={activeWindow === folder.id}
                onClick={() => handleWindowClick(folder.id)}
                zIndex={getZIndex(folder.id)}
              />
            </AbstractProviders>
          );
        }

        if (folder.contentType === 'leaderboard') {
          return (
            <LeaderboardWindow
              key={folder.id}
              id={folder.id}
              title={folder.name}
              onClose={() => handleCloseWindow(folder.id)}
              isActive={activeWindow === folder.id}
              onClick={() => handleWindowClick(folder.id)}
              zIndex={getZIndex(folder.id)}
              onOpenProfile={handleOpenProfile}
            />
          );
        }

        if (folder.contentType === 'physical-art') {
          return (
            <PhysicalArtWindow
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

        if (folder.contentType === 'design-agency') {
          return (
            <DesignAgencyWindow
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

        // Digital Art: fullscreen browser of collection cards (heading + cover art). Clicking a
        // card opens that collection's fullscreen viewer (CollectionWindow), which has a Back button.
        const collections: GalleryCollection[] = [
          ...folders
            .filter((f): f is typeof f & { openseaSlug: string } => f.contentType === 'images' && !!f.openseaSlug)
            .map((f) => ({
              id: f.id,
              name: collectionNamesBySlug[f.openseaSlug] || f.name,
              cover: prefetchedBySlug[f.openseaSlug]?.[0]?.src,
            })),
          // Breadio lives on MegaETH (no OpenSea) — show its on-chain logo and link out.
          { id: 'breadio', name: 'Breadio', cover: 'https://breadio.tuthopium.store/logo.jpg', href: 'https://breadio.tuthopium.store' },
          { id: 'digital-soon', name: 'Coming Soon', comingSoon: true },
        ];

        return (
          <GalleryFolderWindow
            key={folder.id}
            id={folder.id}
            title={folder.name}
            collections={collections}
            loading={!prefetchDone}
            onOpen={handleFolderClick}
            onClose={() => handleCloseWindow(folder.id)}
            isActive={activeWindow === folder.id}
            onClick={() => handleWindowClick(folder.id)}
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

      {openProfile && (
        <PublicProfileWindow
          id="public-profile"
          wallet={openProfile.wallet}
          username={openProfile.username}
          onClose={() => { setOpenProfile(null); if (activeWindow === 'public-profile') setActiveWindow(null); setWindowStack(prev => prev.filter(id => id !== 'public-profile')); }}
          isActive={activeWindow === 'public-profile'}
          onClick={() => handleWindowClick('public-profile')}
          zIndex={getZIndex('public-profile')}
        />
      )}

      <Taskbar
        openFolders={[
          ...Array.from(openFolders).map(id => {
            const folder = folders.find(f => f.id === id);
            const slugFolder = folder as typeof folder & { openseaSlug?: string } | undefined;
            const name = folder && slugFolder?.openseaSlug
              ? (collectionNamesBySlug[slugFolder.openseaSlug] || folder.name)
              : (folder?.name || '');
            return { id, name };
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
    </AudioProvider>
  );
}
