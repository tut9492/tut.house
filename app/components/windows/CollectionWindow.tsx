'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

interface ArtworkItem {
  id: string;
  title: string;
  src: string;
  collection?: string;
  chain?: string;
  technique?: string;
  permalink?: string;
}

interface CollectionWindowProps {
  id: string;
  title: string;
  onClose: () => void;
  isActive: boolean;
  onClick: () => void;
  zIndex: number;
  openseaSlug?: string;
  limit?: number;
  prefetchedArtworks?: ArtworkItem[];
  onArtworksLoaded?: (slug: string, artworks: ArtworkItem[]) => void;
}

export default function CollectionWindow({ 
  id,
  title, 
  onClose, 
  isActive, 
  onClick, 
  zIndex,
  openseaSlug,
  limit,
  prefetchedArtworks,
  onArtworksLoaded
}: CollectionWindowProps) {
  const isCompact = useIsMobile(1024);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => ({ x: 200, y: 150 }));
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMaximized, setIsMaximized] = useState(true);
  const [prevPosition, setPrevPosition] = useState({ x: 200, y: 150 });
  const windowRef = useRef<HTMLDivElement>(null);
  
  const [artworks, setArtworks] = useState<ArtworkItem[]>(prefetchedArtworks ?? []);
  const [selectedArtwork, setSelectedArtwork] = useState<ArtworkItem | null>(prefetchedArtworks?.[0] ?? null);
  const [isLoading, setIsLoading] = useState(!(prefetchedArtworks && prefetchedArtworks.length > 0));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefetchedArtworks && prefetchedArtworks.length > 0) {
      setArtworks(prefetchedArtworks);
      setSelectedArtwork((prev) => prev ?? prefetchedArtworks[0]);
      setIsLoading(false);
    }
  }, [prefetchedArtworks]);

  useLayoutEffect(() => {
    if (isCompact) return;
    const WINDOW_W = 1000;
    const WINDOW_H = 700;
    const margin = 50;

    const maxX = Math.max(1, window.innerWidth - WINDOW_W - margin * 2);
    const maxY = Math.max(1, window.innerHeight - WINDOW_H - margin * 2);

    const nextPos = {
      x: Math.floor(Math.random() * maxX) + margin,
      y: Math.floor(Math.random() * maxY) + margin,
    };

    setPosition(nextPos);
    setPrevPosition(nextPos);
  }, [isCompact]);

  useEffect(() => {
    const fetchArtworks = async () => {
      if (!openseaSlug) {
        setIsLoading(false);
        return;
      }
      const skipFetch = prefetchedArtworks && prefetchedArtworks.length > 0
        && openseaSlug !== 'abstractions'
        && openseaSlug !== 'tut-loudio';
      if (skipFetch) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        
        const url = `/api/opensea/collection?slug=${openseaSlug}${limit != null ? `&limit=${limit}` : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch collection');
        }

        const data = await response.json();
        if (data.artworks && data.artworks.length > 0) {
          setArtworks(data.artworks);
          setSelectedArtwork(data.artworks[0]);
          if (openseaSlug) onArtworksLoaded?.(openseaSlug, data.artworks);
        }
      } catch (err) {
        console.error('Error fetching artworks:', err);
        setError('Failed to load collection');
      } finally {
        setIsLoading(false);
      }
    };

    fetchArtworks();
    // Intentionally omit prefetchedArtworks so we only fetch once per slug/limit.
    // Re-running when prefetchedArtworks changed caused a second request that could fail (e.g. rate limit)
    // and was making NFTs disappear for Abstractions and Tut Loudio.
  }, [openseaSlug, limit]);

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
  }, [isDragging, dragOffset, isMaximized, isCompact]);

  const handleMaximize = () => {
    if (isMaximized) {
      setPosition(prevPosition);
    } else {
      if (position) setPrevPosition(position);
    }
    setIsMaximized(!isMaximized);
  };

  const windowStyle = isMaximized
    ? { top: 0, left: 0, width: '100%', height: 'calc(100% - 48px)' }
    : isCompact
      ? {
          top: '12px',
          left: '12px',
          right: '12px',
          bottom: '60px',
        }
      : position
      ? { top: position.y, left: position.x, width: '1000px', height: '700px' }
      : { top: 0, left: 0, width: '1000px', height: '700px', visibility: 'hidden' as const };

  const handleViewOriginal = () => {
    if (selectedArtwork?.permalink) {
      window.open(selectedArtwork.permalink, '_blank');
    }
  };

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
        className="px-6 py-4 cursor-move select-none"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleMaximize}
        style={{ borderBottom: '1px solid #F3F4F6' }}
      >
        <span className="text-gray-600 text-sm font-normal">{title}</span>
      </div>

      <div className="flex h-[calc(100%-57px)]">
        <div 
          className="w-44 border-r border-gray-100 overflow-y-auto py-4 px-3"
          style={{ backgroundColor: '#FAFAFA' }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-xs text-center p-4">{error}</div>
          ) : (
            <div className="space-y-4">
              {artworks.map((artwork, index) => (
                <div
                  key={artwork.id}
                  className={`cursor-pointer transition-all duration-200 rounded-lg overflow-hidden bg-white ${
                    selectedArtwork?.id === artwork.id 
                      ? 'ring-2 ring-slate-800 shadow-md' 
                      : 'hover:shadow-md hover:ring-1 hover:ring-gray-300'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedArtwork(artwork);
                  }}
                >
                  <div className="relative aspect-square w-full bg-gray-50">
                    <img
                      src={artwork.src}
                      alt={artwork.title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-2 bg-white">
                    <p className="text-xs text-gray-600 truncate text-center" title={artwork.title}>
                      {artwork.title || `artwork_${String(index + 1).padStart(2, '0')}.jpg`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
          {selectedArtwork ? (
            <>
              <div className="flex-1 min-h-0 overflow-auto mb-6 flex justify-center min-w-0">
                <img
                  key={selectedArtwork.src}
                  src={selectedArtwork.src}
                  alt={selectedArtwork.title}
                  className="block max-w-full w-auto h-auto object-contain min-w-0"
                  loading="eager"
                />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 lg:gap-8 text-center mb-4 py-3 border-t border-gray-100">
                <div className="min-w-0">
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Title</p>
                  <p
                    className="text-gray-700 text-xs lg:text-sm font-medium px-2 leading-snug"
                    title={selectedArtwork.title}
                    style={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {selectedArtwork.title}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Collection</p>
                  <p
                    className="text-gray-700 text-xs lg:text-sm font-medium px-2 leading-snug"
                    title={selectedArtwork.collection}
                    style={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {selectedArtwork.collection || '-'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Chain</p>
                  <p className="text-gray-700 text-xs lg:text-sm font-medium px-2 break-words leading-snug">
                    {selectedArtwork.chain || '-'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Technique</p>
                  <p className="text-gray-700 text-xs lg:text-sm font-medium px-2 break-words leading-snug">
                    {selectedArtwork.technique || '-'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleViewOriginal}
                disabled={!selectedArtwork.permalink}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                  />
                </svg>
                View Original
              </button>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              {isLoading ? (
                <div className="text-gray-400">Loading collection...</div>
              ) : (
                <div className="text-gray-400">Select an artwork to view</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

