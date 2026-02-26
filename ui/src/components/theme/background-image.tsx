import { useState } from "react";

interface BackgroundImageProps {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}

export function BackgroundImage({ src, alt, className = "" }: BackgroundImageProps): JSX.Element {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`absolute inset-0 ${className}`}>
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-cover object-bottom transition-opacity duration-700 ease-in-out ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
}
