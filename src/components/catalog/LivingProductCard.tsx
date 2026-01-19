import { useState, useRef } from "react";
import { Play, ShoppingBag, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Define o que é um produto
interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  video_url?: string | null;
  category?: string;
}

interface LivingProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export function LivingProductCard({ product, onAddToCart }: LivingProductCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(product.price);

  const handleInteractionStart = () => {
    setIsHovering(true);
    if (product.video_url && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleInteractionEnd = () => {
    setIsHovering(false);
    if (product.video_url && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div 
      className="group relative flex flex-col gap-2 rounded-lg bg-white p-2 transition-all duration-300 hover:shadow-lg"
      onMouseEnter={handleInteractionStart}
      onMouseLeave={handleInteractionEnd}
      onTouchStart={handleInteractionStart}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-gray-100">
        
        {product.category && (
          <Badge variant="secondary" className="absolute left-2 top-2 z-20 bg-white/90 text-[10px] font-bold uppercase text-black backdrop-blur-sm">
            {product.category}
          </Badge>
        )}

        <button className="absolute right-2 top-2 z-20 rounded-full bg-white/70 p-1.5 text-gray-500 hover:text-pink-600">
          <Heart size={16} />
        </button>

        <img
          src={product.image_url || "/placeholder.png"}
          alt={product.name}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            isHovering && isVideoLoaded ? "opacity-0" : "opacity-100"
          )}
        />

        {product.video_url && (
          <video
            ref={videoRef}
            src={product.video_url}
            muted
            loop
            playsInline
            onLoadedData={() => setIsVideoLoaded(true)}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
              isHovering && isVideoLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        )}

        <div className={cn(
          "absolute bottom-0 left-0 right-0 z-30 p-2 transition-transform duration-300",
          isHovering ? "translate-y-0" : "translate-y-full"
        )}>
          <Button 
            onClick={() => onAddToCart(product)}
            className="w-full bg-pink-600 font-semibold text-white hover:bg-pink-700 h-8 text-xs"
          >
            <ShoppingBag size={14} className="mr-2" />
            Comprar
          </Button>
        </div>
      </div>

      <div className="px-1">
        <h3 className="line-clamp-1 text-sm font-medium text-gray-700">{product.name}</h3>
        <span className="text-base font-bold text-gray-900">{formattedPrice}</span>
      </div>
    </div>
  );
}
