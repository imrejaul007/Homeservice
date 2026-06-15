"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ThreeDMarqueeProps {
  images: string[];
  className?: string;
}

export function ThreeDMarquee({ images, className }: ThreeDMarqueeProps) {
  // Split images into 4 columns for the marquee effect
  const chunkSize = Math.ceil(images.length / 4);
  const chunks = Array.from({ length: 4 }, (_, colIndex) => {
    const start = colIndex * chunkSize;
    return images.slice(start, start + chunkSize);
  });

  return (
    <div
      className={cn(
        "mx-auto block h-[700px] overflow-hidden rounded-3xl max-sm:h-[500px]",
        className
      )}
    >
      <div className="flex size-full items-center justify-center">
        <div className="relative w-full h-full">
          {/* 3D Grid Container */}
          <div
            style={{
              transform: "rotateX(12deg) rotateZ(-6deg)",
              transformStyle: "preserve-3d",
            }}
            className="relative w-full h-full"
          >
            {chunks.map((subarray, colIndex) => (
              <motion.div
                animate={{
                  y: colIndex % 2 === 0 ? [0, -50, 0] : [0, 50, 0],
                }}
                transition={{
                  duration: colIndex % 2 === 0 ? 4 : 5,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
                key={`col-${colIndex}`}
                className="absolute top-0 flex flex-col gap-6"
                style={{
                  left: `${colIndex * 25}%`,
                  width: "22%",
                  height: "100%",
                  transformStyle: "preserve-3d",
                }}
              >
                {subarray.map((image, imageIndex) => (
                  <motion.div
                    whileHover={{
                      y: -12,
                      scale: 1.04,
                      rotateY: 5,
                      boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
                    }}
                    transition={{ duration: 0.2 }}
                    key={`img-${imageIndex}`}
                    className="relative rounded-2xl overflow-hidden shadow-xl cursor-pointer"
                    style={{
                      transformStyle: "preserve-3d",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    <img
                      src={image}
                      alt={`Gallery ${imageIndex + 1}`}
                      className="w-full h-52 md:h-64 object-cover"
                      loading="lazy"
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                  </motion.div>
                ))}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThreeDMarquee;
