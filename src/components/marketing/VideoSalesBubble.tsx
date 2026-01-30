import { useState, useRef, useEffect } from "react";
import { X, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoSalesBubbleProps {
  previewUrl?: string | null;
  fullUrl?: string | null;
}

export function VideoSalesBubble({ previewUrl, fullUrl }: VideoSalesBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasNotification, setHasNotification] = useState(true);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);

  // Don't render if no videos provided
  if (!previewUrl && !fullUrl) {
    return null;
  }

  // Handle opening the full video modal
  const handleOpen = () => {
    setIsOpen(true);
    setHasNotification(false);
    // Start playing full video with sound
    if (fullVideoRef.current) {
      fullVideoRef.current.currentTime = 0;
      fullVideoRef.current.muted = false;
      fullVideoRef.current.play().catch(() => {
        // Autoplay was blocked, start muted
        if (fullVideoRef.current) {
          fullVideoRef.current.muted = true;
          fullVideoRef.current.play();
          setIsMuted(true);
        }
      });
    }
  };

  // Handle closing the modal
  const handleClose = () => {
    setIsOpen(false);
    if (fullVideoRef.current) {
      fullVideoRef.current.pause();
    }
  };

  // Toggle mute state
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fullVideoRef.current) {
      fullVideoRef.current.muted = !fullVideoRef.current.muted;
      setIsMuted(fullVideoRef.current.muted);
    }
  };

  // Handle video ended
  const handleVideoEnded = () => {
    handleClose();
  };

  // Progress tracking for stories-style progress bar
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen || !fullVideoRef.current) return;

    const video = fullVideoRef.current;
    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, [isOpen]);

  return (
    <>
      {/* Floating Bubble */}
      <button
        onClick={handleOpen}
        className={cn(
          "fixed bottom-4 right-4 z-50",
          "w-20 h-20 rounded-full overflow-hidden",
          "border-4 border-white shadow-2xl",
          "cursor-pointer transition-all duration-300 hover:scale-110",
          "ring-2 ring-primary/50 ring-offset-2",
          "animate-fade-in"
        )}
        aria-label="Abrir vídeo de apresentação"
      >
        {/* Notification Badge */}
        {hasNotification && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center z-10 animate-pulse">
            <span className="text-white text-xs font-bold">1</span>
          </span>
        )}

        {/* Preview Video (muted, looping) */}
        {previewUrl ? (
          <video
            ref={previewVideoRef}
            src={previewUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          // Fallback: static gradient if no preview
          <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="text-white text-2xl">▶</span>
          </div>
        )}
      </button>

      {/* Full Video Modal (Stories Style) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={handleClose}
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Fechar vídeo"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Progress Bar (Stories Style) */}
          <div className="absolute top-0 left-0 right-0 p-4 z-10">
            <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Video Container */}
          <div
            className="relative w-full max-w-lg max-h-[90vh] aspect-[9/16]"
            onClick={(e) => e.stopPropagation()}
          >
            {fullUrl ? (
              <video
                ref={fullVideoRef}
                src={fullUrl}
                className="w-full h-full object-contain rounded-lg"
                playsInline
                onEnded={handleVideoEnded}
              />
            ) : previewUrl ? (
              // Use preview as fallback if no full video
              <video
                ref={fullVideoRef}
                src={previewUrl}
                className="w-full h-full object-contain rounded-lg"
                playsInline
                onEnded={handleVideoEnded}
              />
            ) : null}

            {/* Mute/Unmute Button */}
            <button
              onClick={toggleMute}
              className="absolute bottom-4 right-4 p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              aria-label={isMuted ? "Ativar som" : "Desativar som"}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
