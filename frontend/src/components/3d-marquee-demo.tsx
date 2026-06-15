"use client";
import { ThreeDMarquee } from "./ui/3d-marquee";

// Beauty & wellness service images for NILIN
const beautyImages = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80",
  "https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=600&q=80",
  "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80",
  "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80",
  "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80",
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80",
  "https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=600&q=80",
  "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=600&q=80",
  "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=600&q=80",
  "https://images.unsplash.com/photo-1526045478516-99145907023c?w=600&q=80",
  "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600&q=80",
  "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=600&q=80",
  "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&q=80",
  "https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80",
  "https://images.unsplash.com/photo-1502977249166-824b3a8a4d6d?w=600&q=80",
  "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=600&q=80",
];

export default function ThreeDMarqueeDemo() {
  return (
    <div className="w-full">
      <ThreeDMarquee images={beautyImages} />
    </div>
  );
}
