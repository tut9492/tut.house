'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const GAME_SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || 'wss://breadiogame.tuthopium.store';
const GAME_API = process.env.NEXT_PUBLIC_GAME_API || 'https://breadiogame.tuthopium.store';
const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);

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
        "CONNECT YOUR WALLET TO PLAY.",
      ]
    : phase === 'verified' && ownsNFT
    ? [
        "VERY NICE BOOTY... BREAD. YOU CAN HELP ME BURN BREAD. WHATS YOUR NAME?",
      ]
    : phase === 'verified' && !ownsNFT
    ? [
        "YOU HAVE NO BREAD. SHAME. YOU CAN STILL PLAY. 30 SECOND COOLDOWN THOUGH.",
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
  const [notifications, setNotifications] = useState<{ id: number; tokenId: number; result: string; player: string }[]>([]);
  const notifId = useRef(0);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [role, setRole] = useState<'player' | 'spectator'>('player');
  const [roomName, setRoomName] = useState('');
  const [lobbyPosition, setLobbyPosition] = useState(0);
  const [counts, setCounts] = useState({ players: 0, lobby: 0, spectators: 0 });
  const [roomList, setRoomList] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [gamePhase, setGamePhase] = useState<'connect' | 'verified' | 'rejected' | 'username' | 'rooms' | 'playing' | 'gameover'>('connect');
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminToken, setAdminToken] = useState('');
  const [adminStatus, setAdminStatus] = useState<any>(null);
  const [roundTimer, setRoundTimer] = useState<number | null>(null);
  const isAdmin = ADMIN_WALLETS.includes(walletAddress.toLowerCase());
  const wsRef = useRef<WebSocket | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Always fetch rooms on load
  useEffect(() => {
    fetchRooms();
  }, []);

  // Auto-reconnect if returning player
  const hasAutoReconnected = useRef(false);
  useEffect(() => {
    if (hasAutoReconnected.current) return;
    hasAutoReconnected.current = true;
    const savedWallet = localStorage.getItem('toast_wallet');
    const savedUsername = localStorage.getItem('toast_username');
    const savedOwns = localStorage.getItem('toast_owns');
    const savedAdminToken = localStorage.getItem('toast_admin_token');
    if (savedAdminToken) {
      setAdminToken(savedAdminToken);
      setAdminAuthed(true);
    }
    if (savedWallet && savedUsername) {
      setWalletAddress(savedWallet);
      setUsername(savedUsername);
      setOwnsNFT(savedOwns === '1');
      setGamePhase('verified');
    }
  }, []);

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
      localStorage.setItem('toast_admin_token', data.token);
      // Fetch full room status after auth
      const statusRes = await fetch(`${GAME_API}/api/game/admin/status`, {
        headers: { 'Authorization': `Bearer ${data.token}` },
      });
      const statusData = await statusRes.json();
      if (!statusData.error) setAdminStatus(statusData);
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
      fetchAdminStatus();
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

  // Sound effects — reuse single AudioContext
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }, []);

  const playSound = useCallback((type: 'flip' | 'burn' | 'win' | 'hover') => {
    try {
      const ctx = getAudioCtx();
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
    } catch {}
  }, [getAudioCtx]);

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
      localStorage.setItem('toast_wallet', addr);
      localStorage.setItem('toast_owns', data.owns ? '1' : '0');
      setGamePhase('verified');
    } catch (err: any) {
      console.error('Wallet connect error:', err);
      setError(err?.message || 'Failed to connect wallet');
    }
  };

  // Fetch room list
  const fetchRooms = async () => {
    try {
      const res = await fetch(`${GAME_API}/api/game/rooms`);
      const data = await res.json();
      setRoomList(data);
    } catch {}
  };

  // Join a specific room
  const joinRoom = (roomId: string) => {
    setSelectedRoom(roomId);
    const ws = new WebSocket(GAME_SERVER);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'join', address: walletAddress, username: username.trim(), room: roomId }));
    };
    ws.onmessage = handleWsMessage;
    ws.onclose = () => setConnected(false);
  };

  // Shared WebSocket message handler
  const handleWsMessage = useCallback((event: MessageEvent) => {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case 'board':
        const newCards: Record<number, Card> = {};
        const order: number[] = [];
        for (const [id, card] of Object.entries(msg.cards) as any) {
          newCards[Number(id)] = { tokenId: Number(id), ...card };
          order.push(Number(id));
        }
        order.sort(() => Math.random() - 0.5);
        setCards(newCards);
        setCardOrder(order);
        setStats(msg.stats);
        setRole(msg.role || 'player');
        if (msg.roomName) setRoomName(msg.roomName);
        if (msg.lobbyPosition) setLobbyPosition(msg.lobbyPosition);
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
          [msg.tokenId]: { tokenId: msg.tokenId, status: msg.result, isPrize: msg.result === 'prize', flippedBy: msg.player },
        }));
        setStats(msg.stats);
        playSound(msg.result === 'prize' ? 'win' : 'burn');
        const nid = ++notifId.current;
        setNotifications(prev => [...prev, { id: nid, tokenId: msg.tokenId, result: msg.result, player: msg.player }]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== nid)), 4000);
        fetch(`${GAME_API}/api/game/nft/${msg.tokenId}`).then(r => r.json()).then(data => {
          if (data.image) setRevealedImages(prev => ({ ...prev, [msg.tokenId]: data.image }));
        }).catch(() => {});
        break;
      case 'flip_revert':
        setFlipping(null);
        setCards(prev => ({ ...prev, [msg.tokenId]: { ...prev[msg.tokenId], status: 'face_down' } }));
        break;
      case 'cursor':
        setCursors(prev => ({ ...prev, [msg.address]: { username: msg.username, x: msg.x, y: msg.y } }));
        break;
      case 'player_joined': case 'player_left': break;
      case 'timer': setRoundTimer(msg.seconds); break;
      case 'game_over': setRoundTimer(null); setGamePhase('gameover'); break;
      case 'round_over': setRoundTimer(null); setGamePhase('gameover'); break;
      case 'game_paused': setRoundTimer(null); setError('GAME PAUSED'); break;
      case 'game_resumed': setRoundTimer(msg.seconds || null); setError(''); break;
      case 'promoted':
        setRole('player'); setLobbyPosition(0);
        setError('YOUR TURN! START FLIPPING!'); setTimeout(() => setError(''), 3000);
        break;
      case 'lobby_update': setLobbyPosition(msg.position); break;
      case 'counts': setCounts(msg); break;
      case 'kicked': setError('REMOVED BY ADMIN'); fetchRooms(); setGamePhase('rooms'); break;
      case 'maxed_out': setError(msg.message); setTimeout(() => { fetchRooms(); setGamePhase('rooms'); }, 5000); break;
      case 'game_reset': setGamePhase('connect'); setCards({}); setCardOrder([]); setStats(null); break;
      case 'error': setError(msg.message); setTimeout(() => setError(''), 2000); break;
    }
  }, [playSound]);

  // Join game — go to room selection
  const joinGame = () => {
    if (!username.trim()) return;
    localStorage.setItem('toast_username', username.trim());
    fetchRooms();
    setGamePhase('rooms');
  };

  // Legacy join (unused, kept for reference)
  const _legacyJoin = () => {
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

    ws.onmessage = handleWsMessage;
    ws.onclose = () => setConnected(false);
  };

  // Flip card
  const flipCard = (tokenId: number) => {
    if (!wsRef.current || flipping || cooldown > 0 || role !== 'player') return;
    const card = cards[tokenId];
    if (!card || card.status !== 'face_down') return;

    wsRef.current.send(JSON.stringify({ type: 'flip', tokenId }));

    // Start cooldown — holders: 5s, non-holders: 30s
    const cd = ownsNFT ? 5 : 30;
    setCooldown(cd);
    const interval = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // Track cursor (throttled to 10/sec)
  const lastCursorSend = useRef(0);
  useEffect(() => {
    if (!wsRef.current || gamePhase !== 'playing') return;
    const handleMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastCursorSend.current < 100) return;
      lastCursorSend.current = now;
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

      {/* Back to Rooms */}
      {gamePhase === 'playing' && (
        <button
          onClick={() => { wsRef.current?.close(); fetchRooms(); setGamePhase('rooms'); }}
          style={{
            position: 'fixed', bottom: '12px', right: '100px', zIndex: 200,
            padding: '6px 10px', background: '#1a1a1a', border: '1px solid #FFD700',
            color: '#FFD700', fontFamily: "'Press Start 2P'", fontSize: '8px', cursor: 'pointer',
          }}
        >ROOMS</button>
      )}

      {/* Admin Toggle */}
      {isAdmin && (
        <button
          onClick={() => { setShowAdmin(!showAdmin); if (!showAdmin && adminAuthed) fetchAdminStatus(); }}
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
          width: '300px', maxHeight: '80vh', overflowY: 'auto',
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
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                <button onClick={() => adminAction('startall')} style={{
                  flex: 1, padding: '6px', background: '#00ff88', border: 'none',
                  color: '#000', fontFamily: "'Press Start 2P'", fontSize: '7px', cursor: 'pointer',
                }}>START ALL</button>
                <button onClick={() => adminAction('pauseall')} style={{
                  flex: 1, padding: '6px', background: '#FFD700', border: 'none',
                  color: '#000', fontFamily: "'Press Start 2P'", fontSize: '7px', cursor: 'pointer',
                }}>PAUSE ALL</button>
              </div>

              {/* All Rooms */}
              {Array.isArray(adminStatus) && adminStatus.map((rm: any) => (
                <div key={rm.room} style={{ border: '1px solid #333', padding: '6px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: '#FFD700' }}>{rm.room.toUpperCase()}</span>
                    <span style={{ color: rm.paused ? '#ff4444' : '#00ff88' }}>{rm.paused ? 'PAUSED' : 'LIVE'}</span>
                  </div>
                  <div style={{ color: '#aaa', lineHeight: '1.8', marginBottom: '4px' }}>
                    PRIZES: {rm.prizesFound}/{rm.maxPrizes} | BURNED: {rm.cardsBurned} | LEFT: {rm.cardsRemaining}<br/>
                    PLAYERS: {rm.players} | LOBBY: {rm.lobby}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    <button onClick={() => adminAction('start', { room: rm.room })} style={{
                      flex: 1, padding: '4px', background: '#00ff88', border: 'none',
                      color: '#000', fontFamily: "'Press Start 2P'", fontSize: '6px', cursor: 'pointer',
                    }}>START</button>
                    <button onClick={() => adminAction('pause', { room: rm.room })} style={{
                      flex: 1, padding: '4px', background: '#FFD700', border: 'none',
                      color: '#000', fontFamily: "'Press Start 2P'", fontSize: '6px', cursor: 'pointer',
                    }}>PAUSE</button>
                  </div>
                  {rm.activePlayers?.map((p: any) => (
                    <div key={p.address} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1px' }}>
                      <span style={{ color: p.isHolder ? '#FFD700' : '#aaa' }}>{p.username}</span>
                      <button onClick={() => adminAction('kick', { address: p.address, room: rm.room })} style={{
                        padding: '1px 4px', background: '#ff4444', border: 'none',
                        color: '#fff', fontFamily: "'Press Start 2P'", fontSize: '5px', cursor: 'pointer',
                      }}>KICK</button>
                    </div>
                  ))}
                </div>
              ))}
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
          <h1 style={{ fontSize: '20px', color: '#FFD700', marginBottom: '4px', textShadow: '2px 2px #8B4513' }}>
            🍞 TOAST OR FINE BOOTY 🏴‍☠️
          </h1>
          {roomName && (
            <div style={{ fontSize: '8px', color: '#FFD700', marginBottom: '6px', fontFamily: "'Press Start 2P'" }}>
              {roomName}
            </div>
          )}
          {roundTimer !== null && roundTimer > 0 && (
            <div style={{
              fontSize: roundTimer <= 5 ? '28px' : '22px',
              color: roundTimer <= 5 ? '#ff4444' : roundTimer <= 10 ? '#FFD700' : '#00ff88',
              fontFamily: "'Press Start 2P'",
              textShadow: roundTimer <= 5 ? '0 0 20px #ff4444' : '2px 2px #8B4513',
              marginBottom: '6px',
              animation: roundTimer <= 5 ? 'pulse 0.5s infinite' : 'none',
            }}>
              {roundTimer}
            </div>
          )}
          {stats && (
            <div style={{ fontSize: '8px', color: '#aaa', display: 'flex', justifyContent: 'center', gap: '20px' }}>
              <span>PRIZES: {stats.prizesFound}/{stats.totalPrizes}</span>
              <span>BURNED: {stats.cardsBurned}</span>
              <span>REMAINING: {stats.cardsRemaining}</span>
            </div>
          )}
          {role === 'spectator' && lobbyPosition > 0 && (
            <div style={{
              fontSize: '10px', color: '#FFD700', marginTop: '8px',
              fontFamily: "'Press Start 2P'", textShadow: '2px 2px #8B4513',
            }}>
              SPECTATING — QUEUE POSITION: {lobbyPosition}
            </div>
          )}
          {role === 'spectator' && lobbyPosition === 0 && (
            <div style={{
              fontSize: '10px', color: '#aaa', marginTop: '8px',
              fontFamily: "'Press Start 2P'",
            }}>
              SPECTATING
            </div>
          )}
          {gamePhase === 'playing' && (
            <div style={{ fontSize: '7px', color: '#666', marginTop: '4px', fontFamily: "'Press Start 2P'" }}>
              PLAYERS: {counts.players} | LOBBY: {counts.lobby}
            </div>
          )}
        </div>
      </div>

      {/* Cooldown Timer — fixed on screen */}
      {cooldown > 0 && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          fontSize: '24px', color: '#FFD700', zIndex: 150,
          fontFamily: "'Press Start 2P'", textShadow: '3px 3px #8B4513',
          pointerEvents: 'none', opacity: 0.9,
        }}>
          WAIT {cooldown}s
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#ff4444', padding: '8px 16px', borderRadius: '4px', fontSize: '10px', zIndex: 100,
        }}>
          {error}
        </div>
      )}

      {/* Stacking Notifications — right side */}
      <div style={{
        position: 'fixed', top: '80px', right: '12px', zIndex: 100,
        display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'none',
      }}>
        {notifications.map(n => (
          <div key={n.id} style={{
            background: n.result === 'prize' ? '#FFD700' : '#ff4444',
            color: n.result === 'prize' ? '#000' : '#fff',
            padding: '8px 14px', borderRadius: '4px', fontSize: '8px',
            fontFamily: "'Press Start 2P'",
            animation: 'notifIn 0.3s, notifOut 0.5s 3.5s forwards',
            whiteSpace: 'nowrap',
          }}>
            {n.result === 'prize'
              ? `🏴‍☠️ ${n.player} FINE BOOTY #${n.tokenId}`
              : `🔥 ${n.player} TOASTED #${n.tokenId}`}
          </div>
        ))}
      </div>

      {/* Landing / Connect / Username — Breadio dialogue */}
      {(gamePhase === 'connect' || gamePhase === 'verified' || gamePhase === 'username') && (
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

      {/* Room Selection — shown below wallet area AND as standalone */}
      {(gamePhase === 'connect' || gamePhase === 'verified' || gamePhase === 'username' || gamePhase === 'rooms') && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '40px 20px', gap: '16px',
        }}>
          <div style={{ fontSize: '14px', color: '#FFD700', fontFamily: "'Press Start 2P'", textShadow: '2px 2px #8B4513' }}>
            SELECT A ROOM
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px', width: '100%', maxWidth: '600px' }}>
            {roomList.map((rm: any) => {
              const isFull = rm.players >= rm.maxPlayers;
              const isHolder = rm.requiresHolding;
              const isWL = rm.requiresWhitelist;
              const hasWallet = !!walletAddress && !!username.trim();
              const canJoin = hasWallet && (!isHolder || ownsNFT);
              return (
                <div key={rm.id} style={{
                  border: '2px solid ' + (rm.paused ? '#666' : isFull ? '#ff4444' : '#FFD700'),
                  borderRadius: '4px', padding: '12px', background: '#111',
                  opacity: canJoin ? 1 : 0.5,
                }}>
                  <div style={{ fontSize: '10px', color: '#FFD700', fontFamily: "'Press Start 2P'", marginBottom: '8px' }}>
                    {rm.name}
                  </div>
                  <div style={{ fontSize: '7px', color: '#aaa', fontFamily: "'Press Start 2P'", lineHeight: '2' }}>
                    PLAYERS: {rm.players}/{rm.maxPlayers}{rm.lobby > 0 ? ` (+${rm.lobby} waiting)` : ''}<br/>
                    PRIZES: {rm.prizesFound}/{rm.maxPrizes}<br/>
                    CARDS LEFT: {rm.cardsRemaining}<br/>
                    {rm.paused ? <span style={{color:'#ff4444'}}>PAUSED</span> : <span style={{color:'#00ff88'}}>LIVE</span>}
                    {isHolder && hasWallet && !ownsNFT && <><br/><span style={{color:'#ff4444'}}>HOLDERS ONLY</span></>}
                    {isWL && <><br/><span style={{color:'#FFD700'}}>INVITE ONLY</span></>}
                  </div>
                  <button
                    onClick={() => canJoin && joinRoom(rm.id)}
                    disabled={!canJoin}
                    style={{
                      marginTop: '8px', width: '100%', padding: '8px',
                      background: !canJoin ? '#333' : isFull ? '#ff4444' : '#FFD700',
                      color: '#000', border: 'none',
                      fontFamily: "'Press Start 2P'", fontSize: '8px', cursor: canJoin ? 'pointer' : 'not-allowed',
                      boxShadow: canJoin ? '3px 3px 0 #8B4513' : 'none',
                    }}
                  >
                    {!hasWallet ? 'CONNECT FIRST' : !canJoin ? 'NEED BREADIO' : isFull ? 'JOIN LOBBY' : 'ENTER'}
                  </button>
                </div>
              );
            })}
          </div>
          <button onClick={fetchRooms} style={{
            padding: '6px 12px', background: '#333', border: 'none',
            color: '#fff', fontFamily: "'Press Start 2P'", fontSize: '7px', cursor: 'pointer',
          }}>REFRESH ROOMS</button>
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
          <div style={{
            fontSize: '32px', color: '#ff4444',
            fontFamily: "'Press Start 2P'",
            textShadow: '0 0 30px #ff4444, 0 0 60px #ff0000',
            animation: 'pulse 1s infinite',
          }}>GAME OVER</div>
          <div style={{ fontSize: '10px', color: '#FFD700', fontFamily: "'Press Start 2P'" }}>ROTATING PLAYERS...</div>
          <button
            onClick={() => { wsRef.current?.close(); fetchRooms(); setGamePhase('rooms'); }}
            style={{
              marginTop: '20px', padding: '12px 24px', background: '#FFD700', color: '#000', border: 'none',
              fontFamily: "'Press Start 2P'", fontSize: '10px', cursor: 'pointer',
              boxShadow: '4px 4px 0 #8B4513',
            }}
          >BACK TO ROOMS</button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes burnAway {
          0% { opacity: 1; filter: brightness(1); }
          30% { opacity: 1; filter: brightness(1.5) saturate(2); }
          100% { opacity: 0.15; filter: brightness(0.2) saturate(0); }
        }
        @keyframes notifIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes notifOut { from { opacity: 1; } to { opacity: 0; transform: translateX(20px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        div:hover { transition: all 0.1s; }
      `}</style>
    </div>
  );
}
