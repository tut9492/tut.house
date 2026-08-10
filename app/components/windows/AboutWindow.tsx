'use client';

import Image from 'next/image';
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

const bioContent = `EARLY DAYS

Since childhood, I’ve been captivated by the act of creation, from making music
to crafting imaginative worlds with Lego. As a teenager, I transformed
this passion into a new medium, building skateboard ramps and learning design.
As I grew older, my focus shifted towards functional art, primarily
woodworking projects and furniture.

HOME DESIGN

Over time, my professional career led me towards architecture and home design,
where I honed my design skills and eventually began designing and building homes.

PHOTOGRAPHY

In 2013 I discovered a new passion for photography, particularly shooting
film. As I delved deeper into the craft, I began to take it more seriously,
entering competitions and learning new techniques using software like Photoshop and Lightroom.
I started getting some local recognition after placing in some gallery contests.

WEB 3

In 2019, I embarked on my web 3 journey, exploring the potential impact
that this space could have on art. After a year of studying the space, I
decided to mint my own genesis collection: Tut Genesis

My goal is to create art that sparks the imagination and evokes powerful emotions.

MY ART NOW

Currently, I’m experimenting with a process that involves creating images
from my photos and then layering digital art elements to produce a new,
cohesive artwork. This body of work centers around a central figure in a
brutalist landscape, prompting viewers to explore their own existence.
Through my art, I’ve come to realize that we often fail to truly explore
ourselves until we’re alone with our thoughts and feelings.

This is an evolving document that will showcase my work as I experience my time as an artist.

I hope you have enjoyed learning a bit more about me and how I became an artist.
`;

export default function AboutWindow({ title, onClose, onClick, onImageClick, onTextClick, zIndex }: AboutWindowProps) {
  return (
    <FullscreenFrame title={title} onClose={onClose} onClick={onClick} zIndex={zIndex}>
      <div className="fsw-center">
        <div className="flex flex-wrap justify-center gap-16">
          <div
            className="flex flex-col items-center cursor-pointer group"
            onClick={(e) => { e.stopPropagation(); onImageClick?.('about-profile', '/assets/images/aboutProfilePicture.png', 'profile.jpg'); }}
          >
            <div className="w-32 h-32 mb-3 overflow-hidden rounded-lg group-hover:scale-105 transition-transform">
              <Image src="/assets/images/aboutProfilePicture.png" alt="profile.jpg" width={128} height={128} className="object-cover w-full h-full" />
            </div>
            <span className="text-gray-600 text-xs">profile.jpg</span>
          </div>

          <div
            className="flex flex-col items-center cursor-pointer group"
            onClick={(e) => { e.stopPropagation(); onTextClick?.('about-bio', bioContent, 'bio.txt'); }}
          >
            <div className="w-32 h-32 mb-3 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Image src="/assets/images/fileIcon.png" alt="bio.txt" width={80} height={80} className="object-contain" />
            </div>
            <span className="text-gray-600 text-xs">bio.txt</span>
          </div>

          <div
            className="flex flex-col items-center cursor-pointer group"
            onClick={(e) => { e.stopPropagation(); window.open('https://x.com/Tuteth_', '_blank', 'noopener,noreferrer'); }}
          >
            <div className="w-32 h-32 mb-3 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Image src="/assets/images/x.png" alt="x.link" width={80} height={80} className="object-contain" />
            </div>
            <span className="text-gray-600 text-xs">x.link</span>
          </div>
        </div>
      </div>
    </FullscreenFrame>
  );
}
