'use client';

import FullscreenFrame from './FullscreenFrame';

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

const bio = `EARLY DAYS

Since childhood, I’ve been captivated by the act of creation, from making music to crafting imaginative worlds with Lego. As a teenager, I transformed this passion into a new medium, building skateboard ramps and learning design. As I grew older, my focus shifted towards functional art, primarily woodworking projects and furniture.

HOME DESIGN

Over time, my professional career led me towards architecture and home design, where I honed my design skills and eventually began designing and building homes.

PHOTOGRAPHY

In 2013 I discovered a new passion for photography, particularly shooting film. As I delved deeper into the craft, I began to take it more seriously, entering competitions and learning new techniques using software like Photoshop and Lightroom. I started getting some local recognition after placing in some gallery contests.

WEB 3

In 2019, I embarked on my web 3 journey, exploring the potential impact that this space could have on art. After a year of studying the space, I decided to mint my own genesis collection: Tut Genesis. My goal is to create art that sparks the imagination and evokes powerful emotions.

MY ART NOW

Currently, I’m experimenting with a process that involves creating images from my photos and then layering digital art elements to produce a new, cohesive artwork. This body of work centers around a central figure in a brutalist landscape, prompting viewers to explore their own existence. Through my art, I’ve come to realize that we often fail to truly explore ourselves until we’re alone with our thoughts and feelings.

This is an evolving document that will showcase my work as I experience my time as an artist. I hope you have enjoyed learning a bit more about me and how I became an artist.`;

const LINKS = [
  { label: 'X / Twitter', href: 'https://x.com/Tuteth_' },
  { label: 'OpenSea', href: 'https://opensea.io/_tut' },
  { label: 'Foundation', href: 'https://foundation.app/@tutart' },
];

const ABOUT_CSS = `
.about-grid { --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace; --sans:"Segoe UI",-apple-system,Helvetica,Arial,sans-serif; display:grid; grid-template-columns:320px 1fr; gap:22px; align-items:start; max-width:1080px; margin:0 auto; }
.about-grid .win { border:3px solid #000; border-radius:12px; background:#fff; overflow:hidden; box-shadow:4px 5px 0 0 rgba(20,16,30,.26), 0 16px 30px -14px rgba(30,20,45,.5); }
.about-grid .bar { display:flex; align-items:center; gap:8px; padding:9px 12px; border-bottom:3px solid #000; background:#cbf000; }
.about-grid .bar .t { font:700 12.5px/1 var(--mono); letter-spacing:.1em; text-transform:uppercase; color:#000; }
.about-grid .bar .dot { margin-left:auto; width:11px; height:11px; border-radius:50%; background:#ec5f56; border:1.5px solid rgba(0,0,0,.4); flex:none; }
.about-grid .about-img { aspect-ratio:1/1; background:#f4f2ee center/cover no-repeat; cursor:pointer; }
.about-grid .about-bio { padding:20px 22px; max-height:64vh; overflow-y:auto; }
.about-grid .about-bio h4 { font:700 11px/1 var(--mono); letter-spacing:.11em; text-transform:uppercase; color:#6f8600; margin:18px 0 7px; }
.about-grid .about-bio h4:first-child { margin-top:0; }
.about-grid .about-bio p { font:400 13.5px/1.65 var(--sans); color:#3a3a42; margin:0 0 12px; }
.about-grid .social { grid-column:1 / -1; }
.about-grid .links { display:flex; flex-wrap:wrap; gap:12px; padding:16px 18px; }
.about-grid .link { display:inline-flex; align-items:center; border:2.5px solid #000; border-radius:9px; padding:11px 18px; font:600 13px/1 var(--sans); color:#161616; background:#fff; cursor:pointer; box-shadow:2px 2px 0 0 rgba(20,16,30,.2); text-decoration:none; }
.about-grid .link:hover { filter:brightness(.96); }
@media (max-width:820px){ .about-grid { grid-template-columns:1fr; } }
`;

export default function AboutWindow({ title, onClose, onClick, onImageClick, zIndex }: AboutWindowProps) {
  const blocks = bio.split(/\n\n+/).map((b) => b.trim());

  return (
    <FullscreenFrame title={title} onClose={onClose} onClick={onClick} zIndex={zIndex}>
      <style>{ABOUT_CSS}</style>
      <div className="about-grid">
        {/* PROFILE — top left */}
        <div className="win">
          <div className="bar"><span className="t">Profile</span></div>
          <div
            className="about-img"
            style={{ backgroundImage: 'url(/assets/images/aboutProfilePicture.png)' }}
            onClick={(e) => { e.stopPropagation(); onImageClick?.('about-profile', '/assets/images/aboutProfilePicture.png', 'profile.jpg'); }}
            title="View full image"
          />
        </div>

        {/* BIO — right */}
        <div className="win">
          <div className="bar"><span className="t">Bio</span></div>
          <div className="about-bio">
            {blocks.map((block, i) => {
              const isHeading = /^[A-Z0-9][A-Z0-9 ]+$/.test(block) && block.length < 30;
              return isHeading ? <h4 key={i}>{block}</h4> : <p key={i}>{block}</p>;
            })}
          </div>
        </div>

        {/* SOCIAL LINKS — below */}
        <div className="win social">
          <div className="bar"><span className="t">Links</span></div>
          <div className="links">
            {LINKS.map((l) => (
              <a
                key={l.href}
                className="link"
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                ↗ {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </FullscreenFrame>
  );
}
