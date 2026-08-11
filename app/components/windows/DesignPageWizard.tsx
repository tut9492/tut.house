'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  artTokenKey,
  isValidSocialUrl,
  isValidUsername,
  MAX_GALLERY,
  type CollectorProfile,
} from '@/app/lib/collectorProfile';

// The art the wizard can choose from — the wallet's owned tut™ pieces (as loaded by the Hub).
export type WizardArt = {
  tokenId: string;
  title: string;
  image: string;
  permalink: string;
  collection: string;
  collectionSlug: string;
  weight: number;
};

interface Props {
  wallet: string;
  artworks: WizardArt[];
  existing: CollectorProfile | null;
  onClose: () => void;
  onSaved: (profile: CollectorProfile) => void;
}

function buildProfileMessage(wallet: string) {
  const nonce =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return [
    'Verify tut.house collector access',
    `Wallet: ${wallet.toLowerCase()}`,
    `Timestamp: ${Date.now()}`,
    `Nonce: ${nonce}`,
  ].join('\n');
}

const DPW_CSS = `
#dpw-overlay { position:fixed; inset:0; z-index:200; display:grid; place-items:center; padding:18px;
  background:rgba(18,14,26,.55); backdrop-filter:blur(3px); font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif; }
#dpw { width:min(680px,100%); max-height:calc(100svh - 40px); display:flex; flex-direction:column;
  border:3px solid #000; border-radius:14px; background:#fff; overflow:hidden;
  box-shadow:6px 8px 0 0 rgba(20,16,30,.3), 0 30px 60px -20px rgba(30,20,45,.6); }
#dpw .bar { flex:none; display:flex; align-items:center; gap:12px; padding:11px 16px; border-bottom:3px solid #000; background:#cbf000; }
#dpw .bar .t { font:700 13.5px/1 ui-monospace,Menlo,Consolas,monospace; letter-spacing:.11em; text-transform:uppercase; color:#141019; }
#dpw .bar .x { margin-left:auto; width:26px; height:22px; border:2.5px solid #000; border-radius:5px; background:#ec5f56; color:#3a0d0a; font:700 12px/1 ui-monospace,monospace; display:grid; place-items:center; cursor:pointer; }
#dpw .bar .x:hover { filter:brightness(.95); }
#dpw .steps { flex:none; display:flex; gap:6px; padding:12px 16px 0; }
#dpw .stp { flex:1; border:2px solid #000; border-radius:7px; padding:7px 4px; text-align:center; background:#f4f4f2; cursor:pointer; }
#dpw .stp .n { font:700 9px/1 ui-monospace,monospace; color:#9a9aa2; }
#dpw .stp .l { font:600 10.5px/1 var(--sans); margin-top:4px; color:#6a6a72; }
#dpw .stp.on { background:#1d2532; border-color:#000; }
#dpw .stp.on .n { color:#cbf000; }
#dpw .stp.on .l { color:#fff; }
#dpw .body { flex:1; overflow-y:auto; padding:18px 18px 8px; }
#dpw .h2 { font:700 15px/1.2 "Segoe UI",sans-serif; color:#161616; margin:0 0 3px; }
#dpw .sub { font:400 12.5px/1.5 "Segoe UI",sans-serif; color:#8a8a93; margin:0 0 14px; }
#dpw label.fld { display:block; font:700 10px/1 ui-monospace,monospace; letter-spacing:.09em; text-transform:uppercase; color:#8a8a93; margin:0 0 6px; }
#dpw .row { margin-bottom:16px; }
#dpw input[type=text] { width:100%; border:2.5px solid #000; border-radius:9px; padding:11px 12px; font:500 14px/1 "Segoe UI",sans-serif; color:#161616; background:#fff; outline:none; }
#dpw input[type=text]:focus { box-shadow:0 0 0 3px rgba(203,240,0,.4); }
#dpw .hint { font:500 11.5px/1.4 "Segoe UI",sans-serif; margin-top:6px; }
#dpw .hint.ok { color:#3a6b40; } #dpw .hint.bad { color:#9a3b3b; } #dpw .hint.mut { color:#9a9aa2; }
#dpw .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(92px,1fr)); gap:10px; }
#dpw .pick { position:relative; border:2.5px solid #000; border-radius:10px; overflow:hidden; cursor:pointer; background:#efeae2; aspect-ratio:1/1; padding:0; }
#dpw .pick i { position:absolute; inset:0; background-size:cover; background-position:center; }
#dpw .pick .no { position:absolute; inset:0; display:grid; place-items:center; font:600 9px/1.2 "Segoe UI",sans-serif; color:#b0aab8; text-align:center; padding:4px; }
#dpw .pick.sel { outline:4px solid #cbf000; outline-offset:-4px; }
#dpw .pick .tick { position:absolute; top:4px; right:4px; width:20px; height:20px; border-radius:50%; background:#1d2532; color:#cbf000; font:700 11px/20px ui-monospace,monospace; text-align:center; display:none; }
#dpw .pick.sel .tick { display:block; }
#dpw .pick .cap { position:absolute; left:0; right:0; bottom:0; padding:3px 5px; background:linear-gradient(transparent,rgba(0,0,0,.72)); color:#fff; font:600 8.5px/1.2 "Segoe UI",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#dpw .empty { padding:26px 10px; text-align:center; font:500 12.5px/1.5 "Segoe UI",sans-serif; color:#9a9aa2; border:2px dashed #d8d5cf; border-radius:10px; }
#dpw .counter { font:700 11px/1 ui-monospace,monospace; color:#6f8600; margin:0 0 10px; }
#dpw .foot { flex:none; display:flex; align-items:center; gap:10px; padding:13px 16px; border-top:2px solid #ececec; }
#dpw .foot .err { font:600 11.5px/1.4 "Segoe UI",sans-serif; color:#9a3b3b; margin-right:auto; }
#dpw .foot .spacer { margin-left:auto; }
#dpw button.b { border:3px solid #000; border-radius:9px; font:600 13px/1 "Segoe UI",sans-serif; padding:11px 18px; cursor:pointer; box-shadow:3px 3px 0 0 rgba(20,16,30,.22); }
#dpw button.b:disabled { opacity:.5; cursor:default; box-shadow:none; }
#dpw button.ghost { background:#ededed; color:#161616; }
#dpw button.navy { background:#1d2532; color:#fff; }
#dpw button.navy:hover:not(:disabled) { background:#171d28; }
#dpw .av-preview { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
#dpw .av-preview .ring { width:56px; height:56px; border-radius:14px; border:2.5px solid #000; background:#f0efec center/cover no-repeat; flex:none; display:grid; place-items:center; font:700 20px/1 ui-monospace,monospace; color:#c4c4c4; }
`;

type AvailState = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid';

export default function DesignPageWizard({ wallet, artworks, existing, onClose, onSaved }: Props) {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(existing?.username || '');
  const [socialUrl, setSocialUrl] = useState(existing?.socialUrl || '');
  const [avatarKey, setAvatarKey] = useState<string | null>(existing?.avatar?.tokenKey || null);
  const [frameKey, setFrameKey] = useState<string | null>(existing?.frame?.tokenKey || null);
  const [galleryKeys, setGalleryKeys] = useState<string[]>(
    existing?.gallery?.map((g) => g.tokenKey) || [],
  );
  const [avail, setAvail] = useState<AvailState>(existing ? 'ok' : 'idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const keyed = useMemo(
    () => artworks.map((a) => ({ ...a, key: artTokenKey(a.collectionSlug, a.tokenId) })),
    [artworks],
  );
  const byKey = useMemo(() => new Map(keyed.map((a) => [a.key, a])), [keyed]);
  const avatarArt = avatarKey ? byKey.get(avatarKey) : undefined;

  // Live username availability (debounced), skipped when unchanged from the existing name.
  const seq = useRef(0);
  useEffect(() => {
    const u = username.trim();
    if (!isValidUsername(u)) {
      setAvail(u.length === 0 ? 'idle' : 'invalid');
      return;
    }
    if (existing && u.toLowerCase() === existing.username.toLowerCase()) {
      setAvail('ok');
      return;
    }
    setAvail('checking');
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/collectors/username-available?u=${encodeURIComponent(u)}&wallet=${encodeURIComponent(wallet)}`,
        );
        const data = (await res.json()) as { available?: boolean };
        if (mine === seq.current) setAvail(data.available ? 'ok' : 'taken');
      } catch {
        if (mine === seq.current) setAvail('idle');
      }
    }, 420);
    return () => clearTimeout(t);
  }, [username, wallet, existing]);

  const usernameOk = isValidUsername(username.trim()) && (avail === 'ok');
  const socialOk = isValidSocialUrl(socialUrl.trim() || null);
  const canSave = usernameOk && socialOk && !saving;

  const toggleGallery = (key: string) => {
    setGalleryKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_GALLERY) return prev;
      return [...prev, key];
    });
  };

  const save = async () => {
    setError('');
    if (!usernameOk) { setError('Pick an available username first.'); setStep(0); return; }
    if (!socialOk) { setError('Social link must be a valid https URL.'); setStep(0); return; }
    setSaving(true);
    try {
      const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth) throw new Error('No wallet found to sign with.');
      // The signed-in view can be restored from storage without a live wallet connection, so
      // connect/wake the provider before signing (fixes "provider is not ready").
      try {
        const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
        const connected = (accounts?.[0] || '').toLowerCase();
        if (connected && connected !== wallet) {
          throw new Error(`Connected wallet ${connected.slice(0, 6)}…${connected.slice(-4)} doesn't match this page. Switch to ${wallet.slice(0, 6)}…${wallet.slice(-4)} and try again.`);
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("doesn't match")) throw e;
        // otherwise fall through — personal_sign will surface any real connection error
      }
      const message = buildProfileMessage(wallet);
      const signature = (await eth.request({ method: 'personal_sign', params: [message, wallet] })) as string;

      const res = await fetch('/api/collectors/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          message,
          signature,
          profile: {
            username: username.trim(),
            socialUrl: socialUrl.trim() || null,
            avatarTokenKey: avatarKey,
            frameTokenKey: frameKey,
            galleryTokenKeys: galleryKeys,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) { setAvail('taken'); setStep(0); }
        throw new Error(data?.error || 'Could not save your page.');
      }
      onSaved(data.profile as CollectorProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your page.');
    } finally {
      setSaving(false);
    }
  };

  const noArt = keyed.length === 0;

  const availHint = () => {
    if (avail === 'checking') return <div className="hint mut">Checking…</div>;
    if (avail === 'ok') return <div className="hint ok">✓ Available</div>;
    if (avail === 'taken') return <div className="hint bad">Already taken — try another.</div>;
    if (avail === 'invalid') return <div className="hint bad">3–20 characters: letters, numbers, underscores.</div>;
    return <div className="hint mut">This is your public collector name.</div>;
  };

  return (
    <div id="dpw-overlay" onClick={onClose}>
      <style>{DPW_CSS}</style>
      <div id="dpw" onClick={(e) => e.stopPropagation()}>
        <div className="bar">
          <span className="t">Design Your Page</span>
          <button className="x" onClick={onClose} aria-label="Close">X</button>
        </div>

        <div className="steps">
          {['Identity', 'Frame', 'Gallery'].map((label, i) => (
            <button key={label} className={`stp${step === i ? ' on' : ''}`} onClick={() => setStep(i)}>
              <div className="n">STEP {i + 1}</div>
              <div className="l">{label}</div>
            </button>
          ))}
        </div>

        <div className="body">
          {step === 0 && (
            <>
              <p className="h2">Who are you?</p>
              <p className="sub">Your name, face, and a link — how the community sees you.</p>

              <div className="av-preview">
                <div
                  className="ring"
                  style={avatarArt?.image ? { backgroundImage: `url(${avatarArt.image})` } : undefined}
                >
                  {!avatarArt?.image && '?'}
                </div>
                <div className="sub" style={{ margin: 0 }}>
                  {noArt ? 'No displayable art in this wallet yet — you can still set a name and link.'
                    : avatarArt ? `Avatar: ${avatarArt.title}` : 'Pick a piece below as your avatar.'}
                </div>
              </div>

              <div className="row">
                <label className="fld" htmlFor="dpw-u">Username</label>
                <input
                  id="dpw-u" type="text" value={username} maxLength={20}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                  placeholder="tutcollector"
                />
                {availHint()}
              </div>

              {!noArt && (
                <div className="row">
                  <label className="fld">Avatar — pick from your art</label>
                  <div className="grid">
                    {keyed.map((a) => (
                      <button
                        key={a.key}
                        className={`pick${avatarKey === a.key ? ' sel' : ''}`}
                        onClick={() => setAvatarKey(avatarKey === a.key ? null : a.key)}
                        title={a.title}
                      >
                        {a.image ? <i style={{ backgroundImage: `url(${a.image})` }} /> : <span className="no">{a.title}</span>}
                        <span className="tick">✓</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="row">
                <label className="fld" htmlFor="dpw-s">Social link (optional)</label>
                <input
                  id="dpw-s" type="text" value={socialUrl}
                  onChange={(e) => setSocialUrl(e.target.value)}
                  placeholder="https://x.com/yourhandle"
                />
                {socialUrl.trim() && !socialOk
                  ? <div className="hint bad">Must be a valid https:// link.</div>
                  : <div className="hint mut">X, Farcaster, your site — anything https.</div>}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="h2">Your feature piece</p>
              <p className="sub">One work goes in the big frame — your Esteemed Works.</p>
              {noArt ? (
                <div className="empty">No displayable art found for this wallet. The frame will stay on your highest-scoring piece.</div>
              ) : (
                <div className="grid">
                  {keyed.map((a) => (
                    <button
                      key={a.key}
                      className={`pick${frameKey === a.key ? ' sel' : ''}`}
                      onClick={() => setFrameKey(frameKey === a.key ? null : a.key)}
                      title={a.title}
                    >
                      {a.image ? <i style={{ backgroundImage: `url(${a.image})` }} /> : <span className="no">{a.title}</span>}
                      <span className="tick">✓</span>
                      <span className="cap">{a.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <p className="h2">Your gallery</p>
              <p className="sub">Hang up to {MAX_GALLERY} pieces in the Gallery of Fine Art.</p>
              {noArt ? (
                <div className="empty">No displayable art found for this wallet yet.</div>
              ) : (
                <>
                  <p className="counter">{galleryKeys.length} / {MAX_GALLERY} selected</p>
                  <div className="grid">
                    {keyed.map((a) => {
                      const sel = galleryKeys.includes(a.key);
                      const full = !sel && galleryKeys.length >= MAX_GALLERY;
                      return (
                        <button
                          key={a.key}
                          className={`pick${sel ? ' sel' : ''}`}
                          onClick={() => toggleGallery(a.key)}
                          disabled={full}
                          style={full ? { opacity: 0.4 } : undefined}
                          title={a.title}
                        >
                          {a.image ? <i style={{ backgroundImage: `url(${a.image})` }} /> : <span className="no">{a.title}</span>}
                          <span className="tick">{sel ? galleryKeys.indexOf(a.key) + 1 : '✓'}</span>
                          <span className="cap">{a.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="foot">
          {error && <span className="err">{error}</span>}
          {step > 0
            ? <button className="b ghost" onClick={() => setStep(step - 1)}>Back</button>
            : <button className="b ghost" onClick={onClose}>Cancel</button>}
          <span className="spacer" />
          {step < 2
            ? <button className="b navy" onClick={() => setStep(step + 1)} disabled={step === 0 && !usernameOk}>Next</button>
            : <button className="b navy" onClick={save} disabled={!canSave}>{saving ? 'Signing…' : 'Save my page'}</button>}
        </div>
      </div>
    </div>
  );
}
