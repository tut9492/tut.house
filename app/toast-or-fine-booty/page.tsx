'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const GAME_SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || 'wss://breadiogame.tuthopium.store';
const GAME_API = process.env.NEXT_PUBLIC_GAME_API || 'https://breadiogame.tuthopium.store';
const ADMIN_WALLETS = ['0x75775181080b3684cc3be770ba070d1ecc1ec50d'];

// ─── Typewriter text component with beep sound ─────────────────────────────
function Typewriter({ text, speed = 40, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const i = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);

  const beep = useCallback(() => {
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      // Alternate between two pitches for "beep bop" feel
      osc.frequency.value = Math.random() > 0.5 ? 440 : 520;
      gain.gain.value = 0.04;
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch {}
  }, []);

  useEffect(() => {
    setDisplayed('');
    i.current = 0;
    const interval = setInterval(() => {
      if (i.current < text.length) {
        setDisplayed(text.slice(0, i.current + 1));
        if (text[i.current] !== ' ') beep();
        i.current++;
      } else {
        clearInterval(interval);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return <>{displayed}<span style={{ opacity: 0.5 }}>_</span></>;
}

// ─── Landing Dialogue (SMB3 style) ─────────────────────────────────────────
function LandingDialogue({ phase, ownsNFT, username, setUsername, onConnect, onJoin, error }: {
  phase: string;
  ownsNFT: boolean | null;
  username: string;
  setUsername: (s: string) => void;
  onConnect: () => void;
  onJoin: () => void;
  error: string;
}) {
  const [dialogueStep, setDialogueStep] = useState(0);
  const [typeDone, setTypeDone] = useState(false);

  // Reset when phase changes
  useEffect(() => {
    setDialogueStep(0);
    setTypeDone(false);
  }, [phase]);

  const messages = phase === 'connect'
    ? [
        "I HAVE A LOT OF BREAD TO BURN, PLEASE HELP ME. IF YOU FIND SPECIAL BREAD YOU CAN KEEP IT. GAS ON ME. BREADIO",
        "YOU MUST HAVE BREAD TO PARTICIPATE, LETS CHECK YOUR WALLET.",
      ]
    : phase === 'verified'
    ? [
        "VERY NICE BOOTY... BREAD. YOU CAN HELP ME BURN BREAD. WHATS YOUR NAME?",
      ]
    : phase === 'rejected'
    ? [
        "WTF, YOU HAVE NO BREAD. GTFO. DON'T TALK TO ME UNTIL YOU HAVE BREAD.",
      ]
    : [
        "GIVE ME YOUR NAME.",
      ];

  const currentMsg = messages[dialogueStep] || messages[messages.length - 1];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '80vh', padding: '20px',
    }}>
      {/* Landing image */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: '700px',
      }}>
        <img src="/breadio-landing.png" alt="Breadio" style={{
          width: '100%', imageRendering: 'pixelated', borderRadius: '8px',
        }} />

        {/* Dialogue text overlay — fits inside the pink box */}
        <div style={{
          position: 'absolute', top: '12%', left: '22%', right: '4%', height: '16%',
          display: 'flex', alignItems: 'flex-start', padding: '10px 14px',
          fontFamily: "'Press Start 2P'", fontSize: '8px', color: '#000',
          lineHeight: '2.2', overflow: 'hidden', wordBreak: 'break-word',
        }}>
          <Typewriter
            key={`${phase}-${dialogueStep}`}
            text={currentMsg}
            speed={35}
            onDone={() => setTypeDone(true)}
          />
        </div>
      </div>

      {/* Action area below image */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        {phase === 'connect' && dialogueStep === 0 && typeDone && (
          <button onClick={() => { setDialogueStep(1); setTypeDone(false); }} style={{
            padding: '10px 20px', background: '#FFD700', color: '#000', border: 'none',
            fontFamily: "'Press Start 2P'", fontSize: '10px', cursor: 'pointer',
            boxShadow: '4px 4px 0 #8B4513', animation: 'fadeIn 0.3s',
          }}>
            CONTINUE
          </button>
        )}

        {phase === 'connect' && dialogueStep === 1 && typeDone && (
          <button onClick={onConnect} style={{
            padding: '12px 24px', background: '#FFD700', color: '#000', border: 'none',
            fontFamily: "'Press Start 2P'", fontSize: '10px', cursor: 'pointer',
            boxShadow: '4px 4px 0 #8B4513', animation: 'fadeIn 0.3s',
          }}>
            CONNECT WALLET
          </button>
        )}

        {phase === 'verified' && typeDone && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', animation: 'fadeIn 0.3s' }}>
            <input
              value={username}
              onChange={e => setUsername(e.target.value.slice(0, 12))}
              onKeyDown={e => e.key === 'Enter' && onJoin()}
              placeholder="PLAYER 1"
              maxLength={12}
              style={{
                padding: '10px', background: '#111', border: '2px solid #FFD700', color: '#fff',
                fontFamily: "'Press Start 2P'", fontSize: '10px', textAlign: 'center', width: '200px',
              }}
              autoFocus
            />
            <button onClick={onJoin} style={{
              padding: '10px 20px', background: '#FFD700', color: '#000', border: 'none',
              fontFamily: "'Press Start 2P'", fontSize: '10px', cursor: 'pointer',
              boxShadow: '4px 4px 0 #8B4513',
            }}>
              START
            </button>
          </div>
        )}

        {phase === 'rejected' && typeDone && (
          <button onClick={() => window.location.reload()} style={{
            padding: '10px 20px', background: '#ff4444', color: '#fff', border: 'none',
            fontFamily: "'Press Start 2P'", fontSize: '10px', cursor: 'pointer',
            boxShadow: '4px 4px 0 #8B0000', animation: 'fadeIn 0.3s',
          }}>
            GET BREAD
          </button>
        )}

        {phase === 'username' && typeDone && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', animation: 'fadeIn 0.3s' }}>
            <input
              value={username}
              onChange={e => setUsername(e.target.value.slice(0, 12))}
              onKeyDown={e => e.key === 'Enter' && onJoin()}
              placeholder="PLAYER 1"
              maxLength={12}
              style={{
                padding: '10px', background: '#111', border: '2px solid #FFD700', color: '#fff',
                fontFamily: "'Press Start 2P'", fontSize: '10px', textAlign: 'center', width: '200px',
              }}
              autoFocus
            />
            <button onClick={onJoin} style={{
              padding: '10px 20px', background: '#FFD700', color: '#000', border: 'none',
              fontFamily: "'Press Start 2P'", fontSize: '10px', cursor: 'pointer',
              boxShadow: '4px 4px 0 #8B4513',
            }}>
              START
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: '12px', fontSize: '8px', color: '#ff4444', fontFamily: "'Press Start 2P'" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [revealedImages, setRevealedImages] = useState<Record<number, string>>({});
  const [lastResult, setLastResult] = useState<{ tokenId: number; result: string; player: string } | null>(null);
  const [error, setError] = useState('');
  const [gamePhase, setGamePhase] = useState<'connect' | 'verified' | 'rejected' | 'username' | 'playing' | 'gameover'>('connect');
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminToken, setAdminToken] = useState('');
  const [adminStatus, setAdminStatus] = useState<any>(null);
  const isAdmin = ADMIN_WALLETS.includes(walletAddress.toLowerCase());
  const wsRef = useRef<WebSocket | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Admin: sign message to authenticate
  const adminAuth = async () => {
    try {
      const message = `TOAST ADMIN ${Date.now()}`;
      const signature = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [message, walletAddress],
      });
      const res = await fetch(`${GAME_API}/api/game/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress, message, signature }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setAdminToken(data.token);
      setAdminAuthed(true);
      setAdminStatus(data.status);
    } catch { setError('Signature failed'); }
  };

  const adminAction = async (action: string, body?: any) => {
    try {
      const res = await fetch(`${GAME_API}/api/game/admin/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setAdminStatus(data);
    } catch { setError('Admin action failed'); }
  };

  const fetchAdminStatus = async () => {
    try {
      const res = await fetch(`${GAME_API}/api/game/admin/status`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (!data.error) setAdminStatus(data);
    } catch {}
  };

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
        setGamePhase('verified');
      } else {
        setGamePhase('rejected');
      }
    } catch (err: any) {
      console.error('Wallet connect error:', err);
      setError(err?.message || 'Failed to connect wallet');
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
          // Fetch NFT image for the reveal
          fetch(`${GAME_API}/api/game/nft/${msg.tokenId}`)
            .then(r => r.json())
            .then(data => {
              if (data.image) setRevealedImages(prev => ({ ...prev, [msg.tokenId]: data.image }));
            })
            .catch(() => {});
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

        case 'round_over':
          setGamePhase('gameover');
          break;

        case 'game_paused':
          setError('GAME PAUSED');
          break;

        case 'game_resumed':
          setError('');
          break;

        case 'game_reset':
          setGamePhase('connect');
          setCards({});
          setCardOrder([]);
          setStats(null);
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

      {/* Background Music — starts on first click anywhere */}
      <audio id="bgm" src="/swan-lake.mp3" loop preload="auto" />
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('click', function _bgm() {
          var a = document.getElementById('bgm');
          if (a && a.paused) { a.volume = 0.3; a.play(); }
          document.removeEventListener('click', _bgm);
        });
      `}} />
      <button
        onClick={() => {
          const audio = document.getElementById('bgm') as HTMLAudioElement;
          if (audio.paused) { audio.volume = 0.3; audio.play(); }
          else audio.pause();
        }}
        style={{
          position: 'fixed', bottom: '12px', right: '12px', zIndex: 200,
          padding: '6px 10px', background: '#1a1a1a', border: '1px solid #FFD700',
          color: '#FFD700', fontFamily: "'Press Start 2P'", fontSize: '8px', cursor: 'pointer',
        }}
      >🎵 MUSIC</button>

      {/* Admin Toggle */}
      {isAdmin && (
        <button
          onClick={() => { setShowAdmin(!showAdmin); if (!showAdmin && adminKey) fetchAdminStatus(); }}
          style={{
            position: 'fixed', bottom: '12px', left: '12px', zIndex: 200,
            padding: '6px 10px', background: '#1a1a1a', border: '1px solid #ff4444',
            color: '#ff4444', fontFamily: "'Press Start 2P'", fontSize: '8px', cursor: 'pointer',
          }}
        >ADMIN</button>
      )}

      {/* Admin Panel */}
      {isAdmin && showAdmin && (
        <div style={{
          position: 'fixed', bottom: '40px', left: '12px', zIndex: 200,
          background: '#111', border: '2px solid #ff4444', borderRadius: '4px',
          padding: '12px', fontFamily: "'Press Start 2P'", fontSize: '7px',
          width: '280px', maxHeight: '400px', overflowY: 'auto',
        }}>
          <div style={{ color: '#ff4444', marginBottom: '8px' }}>ADMIN PANEL</div>

          {!adminAuthed ? (
            <div>
              <button onClick={adminAuth} style={{
                width: '100%', padding: '8px', background: '#ff4444', border: 'none',
                color: '#fff', fontFamily: "'Press Start 2P'", fontSize: '7px', cursor: 'pointer',
              }}>SIGN TO VERIFY</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {adminStatus && (
                <div style={{ color: '#aaa', lineHeight: '2' }}>
                  STATUS: <span style={{ color: adminStatus.paused ? '#ff4444' : '#00ff88' }}>{adminStatus.paused ? 'PAUSED' : 'LIVE'}</span><br/>
                  ROUND: {adminStatus.round}<br/>
                  PRIZES: {adminStatus.prizesFound}/{adminStatus.maxPrizes}<br/>
                  BURNED: {adminStatus.cardsBurned}<br/>
                  REMAINING: {adminStatus.cardsRemaining}<br/>
                  ONLINE: {adminStatus.playersOnline}
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => adminAction('start')} style={{
                  flex: 1, padding: '8px', background: '#00ff88', border: 'none',
                  color: '#000', fontFamily: "'Press Start 2P'", fontSize: '7px', cursor: 'pointer',
                }}>START</button>
                <button onClick={() => adminAction('pause')} style={{
                  flex: 1, padding: '8px', background: '#FFD700', border: 'none',
                  color: '#000', fontFamily: "'Press Start 2P'", fontSize: '7px', cursor: 'pointer',
                }}>PAUSE</button>
              </div>
<button onClick={fetchAdminStatus} style={{
                padding: '6px', background: '#333', border: 'none',
                color: '#fff', fontFamily: "'Press Start 2P'", fontSize: '7px', cursor: 'pointer',
              }}>REFRESH</button>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'repeating-linear-gradient(45deg, #8B4513, #8B4513 10px, #D2691E 10px, #D2691E 20px)',
        padding: '4px',
      }}>
        <div style={{
          background: '#000',
          padding: '16px',
          textAlign: 'center',
          position: 'relative',
        }}>
          {walletAddress && (
            <div style={{
              position: 'absolute', top: '8px', right: '12px',
              fontSize: '7px', color: '#00ff88',
              fontFamily: "'Press Start 2P'",
            }}>
              {username || walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)}
            </div>
          )}
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

      {/* Landing / Connect / Username — Breadio dialogue */}
      {(gamePhase === 'connect' || gamePhase === 'verified' || gamePhase === 'rejected' || gamePhase === 'username') && (
        <LandingDialogue
          phase={gamePhase}
          ownsNFT={ownsNFT}
          username={username}
          setUsername={setUsername}
          onConnect={connectWallet}
          onJoin={joinGame}
          error={error}
        />
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

                const nftImage = revealedImages[tokenId];

                if (isBurned) return (
                  <div key={tokenId} style={{
                    width: '100%', aspectRatio: '1',
                    borderRadius: '2px', position: 'relative',
                    overflow: 'hidden',
                    animation: 'burnAway 1.5s forwards',
                  }}>
                    {nftImage ? (
                      <img src={nftImage} alt={`#${tokenId}`} style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        filter: 'brightness(0.3) saturate(0.2)',
                      }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#1a0000' }} />
                    )}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      fontSize: '6px', textAlign: 'center', padding: '2px',
                      background: 'rgba(0,0,0,0.7)', color: '#ff4444',
                    }}>🔥 #{tokenId}</div>
                  </div>
                );

                if (isPrize) return (
                  <div key={tokenId} style={{
                    width: '100%', aspectRatio: '1',
                    borderRadius: '2px', position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 0 12px rgba(255,215,0,0.6)',
                    border: '2px solid #FFD700',
                  }}>
                    {nftImage ? (
                      <img src={nftImage} alt={`#${tokenId}`} style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                      }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #FFD700, #FFA500)' }} />
                    )}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      fontSize: '5px', textAlign: 'center', padding: '2px',
                      background: 'rgba(0,0,0,0.7)', color: '#FFD700',
                    }}>🏴‍☠️ {card.flippedBy}</div>
                  </div>
                );

                return (
                  <div
                    key={tokenId}
                    onClick={() => flipCard(tokenId)}
                    onMouseEnter={() => playSound('hover')}
                    style={{
                      width: '100%', aspectRatio: '1',
                      borderRadius: '2px',
                      cursor: isFaceDown ? 'pointer' : 'default',
                      perspective: '400px',
                    }}
                  >
                    <div style={{
                      width: '100%', height: '100%',
                      transition: 'transform 0.6s',
                      transformStyle: 'preserve-3d',
                      transform: isFlipping ? 'rotateY(180deg)' : 'none',
                    }}>
                      {/* Front — face down */}
                      <div style={{
                        position: 'absolute', width: '100%', height: '100%',
                        backfaceVisibility: 'hidden',
                        background: '#1a1a1a', border: '2px solid #333',
                        borderRadius: '2px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px',
                      }}>
                        🍞
                      </div>
                      {/* Back — NFT image */}
                      <div style={{
                        position: 'absolute', width: '100%', height: '100%',
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        background: '#222',
                        borderRadius: '2px',
                        border: '2px solid #FFD700',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                      }}>
                        {nftImage ? (
                          <img src={nftImage} alt={`#${tokenId}`} style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                          }} />
                        ) : (
                          <span style={{ fontSize: '8px', color: '#FFD700' }}>#{tokenId}</span>
                        )}
                      </div>
                    </div>
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
        @keyframes burnAway {
          0% { opacity: 1; filter: brightness(1); }
          30% { opacity: 1; filter: brightness(1.5) saturate(2); }
          100% { opacity: 0.15; filter: brightness(0.2) saturate(0); }
        }
        div:hover { transition: all 0.1s; }
      `}</style>
    </div>
  );
}
