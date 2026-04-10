'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const GAME_SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || 'wss://game.tut.house';
const GAME_API = process.env.NEXT_PUBLIC_GAME_API || 'https://game.tut.house';

type CardStatus = 'face_down' | 'flipping' | 'burn' | 'prize';

interface Card {
  tokenId: number;
  status: CardStatus;
  isPrize?: boolean;
  flippedBy?: string;
}

interface GameStats {
  totalCards: number;
  totalPrizes: number;
  prizesFound: number;
  cardsBurned: number;
  cardsRemaining: number;
}

interface PlayerCursor {
  username: string;
  x: number;
  y: number;
}

export default function ToastOrFineBooty() {
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [username, setUsername] = useState('');
  const [ownsNFT, setOwnsNFT] = useState<boolean | null>(null);
  const [cards, setCards] = useState<Record<number, Card>>({});
  const [cardOrder, setCardOrder] = useState<number[]>([]);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [cursors, setCursors] = useState<Record<string, PlayerCursor>>({});
  const [flipping, setFlipping] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{ tokenId: number; result: string; player: string } | null>(null);
  const [error, setError] = useState('');
  const [gamePhase, setGamePhase] = useState<'connect' | 'username' | 'playing' | 'gameover'>('connect');
  const wsRef = useRef<WebSocket | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Sound effects
  const playSound = useCallback((type: 'flip' | 'burn' | 'win' | 'hover') => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'flip':
        osc.frequency.value = 800;
        gain.gain.value = 0.1;
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
        break;
      case 'burn':
        osc.type = 'sawtooth';
        osc.frequency.value = 200;
        gain.gain.value = 0.15;
        osc.start();
        osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.3);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.stop(ctx.currentTime + 0.4);
        break;
      case 'win':
        osc.type = 'sine';
        osc.frequency.value = 523;
        gain.gain.value = 0.15;
        osc.start();
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          osc2.connect(gain);
          osc2.frequency.value = 659;
          osc2.start();
          osc2.stop(ctx.currentTime + 0.2);
        }, 100);
        setTimeout(() => {
          const osc3 = ctx.createOscillator();
          osc3.connect(gain);
          osc3.frequency.value = 784;
          osc3.start();
          osc3.stop(ctx.currentTime + 0.3);
        }, 200);
        osc.stop(ctx.currentTime + 0.1);
        break;
      case 'hover':
        osc.frequency.value = 1200;
        gain.gain.value = 0.03;
        osc.start();
        osc.stop(ctx.currentTime + 0.02);
        break;
    }
  }, []);

  // Connect wallet
  const connectWallet = async () => {
    if (!(window as any).ethereum) {
      setError('Install MetaMask');
      return;
    }
    try {
      const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      const addr = accounts[0];
      setWalletAddress(addr);

      // Verify ownership
      const res = await fetch(`${GAME_API}/api/game/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });
      const data = await res.json();
      setOwnsNFT(data.owns);
      if (data.owns) {
        setGamePhase('username');
      } else {
        setError('You need a Breadio NFT to play!');
      }
    } catch (err) {
      setError('Failed to connect wallet');
    }
  };

  // Join game
  const joinGame = () => {
    if (!username.trim()) return;

    const ws = new WebSocket(GAME_SERVER);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({
        type: 'join',
        address: walletAddress,
        username: username.trim(),
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'board':
          const newCards: Record<number, Card> = {};
          const order: number[] = [];
          for (const [id, card] of Object.entries(msg.cards) as any) {
            newCards[Number(id)] = { tokenId: Number(id), ...card };
            order.push(Number(id));
          }
          // Shuffle order for display
          order.sort(() => Math.random() - 0.5);
          setCards(newCards);
          setCardOrder(order);
          setStats(msg.stats);
          setGamePhase('playing');
          break;

        case 'flip_start':
          setFlipping(msg.tokenId);
          playSound('flip');
          break;

        case 'flip_result':
          setFlipping(null);
          setCards(prev => ({
            ...prev,
            [msg.tokenId]: {
              tokenId: msg.tokenId,
              status: msg.result,
              isPrize: msg.result === 'prize',
              flippedBy: msg.player,
            },
          }));
          setStats(msg.stats);
          setLastResult({ tokenId: msg.tokenId, result: msg.result, player: msg.player });
          playSound(msg.result === 'prize' ? 'win' : 'burn');
          setTimeout(() => setLastResult(null), 3000);
          break;

        case 'flip_revert':
          setFlipping(null);
          setCards(prev => ({
            ...prev,
            [msg.tokenId]: { ...prev[msg.tokenId], status: 'face_down' },
          }));
          break;

        case 'cursor':
          setCursors(prev => ({
            ...prev,
            [msg.address]: { username: msg.username, x: msg.x, y: msg.y },
          }));
          break;

        case 'player_joined':
        case 'player_left':
          break;

        case 'game_over':
          setGamePhase('gameover');
          break;

        case 'error':
          setError(msg.message);
          setTimeout(() => setError(''), 2000);
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };
  };

  // Flip card
  const flipCard = (tokenId: number) => {
    if (!wsRef.current || flipping) return;
    const card = cards[tokenId];
    if (!card || card.status !== 'face_down') return;

    wsRef.current.send(JSON.stringify({ type: 'flip', tokenId }));
  };

  // Track cursor
  useEffect(() => {
    if (!wsRef.current || gamePhase !== 'playing') return;
    const handleMove = (e: MouseEvent) => {
      if (!boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      wsRef.current?.send(JSON.stringify({ type: 'cursor', x, y }));
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [gamePhase]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: '#000',
      minHeight: '100vh',
      color: '#fff',
      fontFamily: "'Press Start 2P', monospace",
      overflow: 'hidden',
    }}>
      {/* Google Font */}
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: 'repeating-linear-gradient(45deg, #8B4513, #8B4513 10px, #D2691E 10px, #D2691E 20px)',
        padding: '4px',
      }}>
        <div style={{
          background: '#000',
          padding: '16px',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '20px', color: '#FFD700', marginBottom: '8px', textShadow: '2px 2px #8B4513' }}>
            🍞 TOAST OR FINE BOOTY 🏴‍☠️
          </h1>
          {stats && (
            <div style={{ fontSize: '8px', color: '#aaa', display: 'flex', justifyContent: 'center', gap: '20px' }}>
              <span>PRIZES: {stats.prizesFound}/{stats.totalPrizes}</span>
              <span>BURNED: {stats.cardsBurned}</span>
              <span>REMAINING: {stats.cardsRemaining}</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#ff4444', padding: '8px 16px', borderRadius: '4px', fontSize: '10px', zIndex: 100,
        }}>
          {error}
        </div>
      )}

      {/* Last Result Toast */}
      {lastResult && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: lastResult.result === 'prize' ? '#FFD700' : '#ff4444',
          color: lastResult.result === 'prize' ? '#000' : '#fff',
          padding: '12px 24px', borderRadius: '4px', fontSize: '10px', zIndex: 100,
          animation: 'fadeIn 0.3s',
        }}>
          {lastResult.result === 'prize'
            ? `🏴‍☠️ ${lastResult.player} found FINE BOOTY! #${lastResult.tokenId}`
            : `🔥 ${lastResult.player} got TOASTED! #${lastResult.tokenId}`}
        </div>
      )}

      {/* Connect Screen */}
      {gamePhase === 'connect' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '70vh', gap: '20px',
        }}>
          <div style={{ fontSize: '14px', color: '#FFD700', textAlign: 'center', lineHeight: '2' }}>
            FLIP CARDS.<br />FIND BOOTY.<br />BURN THE REST.
          </div>
          <div style={{ fontSize: '8px', color: '#888', textAlign: 'center' }}>
            Must own a Breadio NFT to play.<br />All burns and wins are on-chain. Gas sponsored.
          </div>
          <button onClick={connectWallet} style={{
            padding: '12px 24px', background: '#FFD700', color: '#000', border: 'none',
            fontFamily: "'Press Start 2P'", fontSize: '10px', cursor: 'pointer',
            boxShadow: '4px 4px 0 #8B4513',
          }}>
            CONNECT WALLET
          </button>
        </div>
      )}

      {/* Username Screen */}
      {gamePhase === 'username' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '70vh', gap: '20px',
        }}>
          <div style={{ fontSize: '10px', color: '#FFD700' }}>ENTER YOUR NAME</div>
          <input
            value={username}
            onChange={e => setUsername(e.target.value.slice(0, 12))}
            onKeyDown={e => e.key === 'Enter' && joinGame()}
            placeholder="PLAYER 1"
            maxLength={12}
            style={{
              padding: '10px', background: '#111', border: '2px solid #FFD700', color: '#fff',
              fontFamily: "'Press Start 2P'", fontSize: '10px', textAlign: 'center', width: '200px',
            }}
            autoFocus
          />
          <button onClick={joinGame} style={{
            padding: '10px 20px', background: '#FFD700', color: '#000', border: 'none',
            fontFamily: "'Press Start 2P'", fontSize: '10px', cursor: 'pointer',
            boxShadow: '4px 4px 0 #8B4513',
          }}>
            START
          </button>
        </div>
      )}

      {/* Game Board */}
      {gamePhase === 'playing' && (
        <div style={{ padding: '8px' }}>
          {/* Candy stripe border */}
          <div style={{
            background: 'repeating-linear-gradient(45deg, #8B4513, #8B4513 8px, #D2691E 8px, #D2691E 16px)',
            padding: '8px', borderRadius: '4px',
          }}>
            <div ref={boardRef} style={{
              background: '#000',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
              gap: '4px',
              padding: '8px',
              position: 'relative',
              minHeight: '60vh',
            }}>
              {cardOrder.map(tokenId => {
                const card = cards[tokenId];
                if (!card) return null;

                const isFaceDown = card.status === 'face_down';
                const isFlipping = flipping === tokenId;
                const isBurned = card.status === 'burn';
                const isPrize = card.status === 'prize';

                if (isBurned) return (
                  <div key={tokenId} style={{
                    width: '100%', aspectRatio: '1',
                    opacity: 0.1, background: '#1a0000',
                    borderRadius: '2px',
                  }} />
                );

                if (isPrize) return (
                  <div key={tokenId} style={{
                    width: '100%', aspectRatio: '1',
                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                    borderRadius: '2px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '6px', color: '#000',
                    textAlign: 'center', padding: '2px',
                    boxShadow: '0 0 8px rgba(255,215,0,0.5)',
                  }}>
                    🏴‍☠️<br />{card.flippedBy}
                  </div>
                );

                return (
                  <div
                    key={tokenId}
                    onClick={() => flipCard(tokenId)}
                    onMouseEnter={() => playSound('hover')}
                    style={{
                      width: '100%', aspectRatio: '1',
                      background: isFlipping ? '#333' : '#1a1a1a',
                      border: `2px solid ${isFlipping ? '#FFD700' : '#333'}`,
                      borderRadius: '2px',
                      cursor: isFaceDown ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px',
                      transition: 'all 0.15s',
                      transform: isFlipping ? 'rotateY(90deg)' : 'none',
                      boxShadow: isFlipping ? '0 0 12px #FFD700' : 'none',
                    }}
                  >
                    🍞
                  </div>
                );
              })}

              {/* Player cursors */}
              {Object.entries(cursors).map(([addr, cursor]) => (
                <div key={addr} style={{
                  position: 'absolute',
                  left: `${cursor.x}%`,
                  top: `${cursor.y}%`,
                  pointerEvents: 'none',
                  zIndex: 50,
                  fontSize: '7px',
                  color: '#FFD700',
                  transform: 'translate(-50%, -50%)',
                  textShadow: '1px 1px 0 #000',
                  whiteSpace: 'nowrap',
                }}>
                  ▶ {cursor.username}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {gamePhase === 'gameover' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '70vh', gap: '20px',
        }}>
          <div style={{ fontSize: '16px', color: '#FFD700' }}>ALL BOOTY FOUND!</div>
          <div style={{ fontSize: '10px', color: '#aaa' }}>GAME OVER</div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        div:hover { transition: all 0.1s; }
      `}</style>
    </div>
  );
}
