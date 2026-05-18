'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import ShopifyImagePicker from './ShopifyImagePicker';

interface ImageManagerProps {
  htmlBody: string;
  onChange: (newHtml: string) => void;
  onProductSelected?: (product: any, imageUrl: string) => void;
}

export default function ImageManager({ htmlBody, onChange, onProductSelected }: ImageManagerProps) {
  const [slots, setSlots] = useState<{ src: string, alt: string, index: number, id: string }[]>([]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  useEffect(() => {
    // Parse the HTML to find all img tags
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlBody, 'text/html');
    const imgs = doc.querySelectorAll('img');
    const newSlots: any[] = [];
    
    // Add unique data-img-id to each img if not present to track them
    let modified = false;
    imgs.forEach((img, i) => {
      let id = img.getAttribute('data-img-id');
      if (!id) {
        id = `img-${Math.random().toString(36).substr(2, 9)}`;
        img.setAttribute('data-img-id', id);
        modified = true;
      }
      newSlots.push({
        src: img.getAttribute('src') || '',
        alt: img.getAttribute('alt') || `Image ${i + 1}`,
        index: i,
        id
      });
    });

    setSlots(newSlots);
    if (modified) {
      onChange(doc.body.innerHTML);
    }
  }, [htmlBody, onChange]);

  const handleReplaceImage = (id: string, newSrc: string, product?: any) => {
    if (!newSrc) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlBody, 'text/html');
    const img = doc.querySelector(`img[data-img-id="${id}"]`);
    if (img) {
      img.setAttribute('src', newSrc);
      onChange(doc.body.innerHTML);
    }
    if (product && onProductSelected) {
      onProductSelected(product, newSrc);
    }
    setActiveSlot(null);
  };

  const handlePasteUrl = (id: string, value: string) => {
    if (!value) return;
    if (!value.startsWith('http')) {
      toast.error('URL must start with http:// or https://');
      return;
    }
    handleReplaceImage(id, value);
  };

  if (slots.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-black/10 dark:border-white/10 pt-4 mt-4">
      <h3 className="text-sm font-medium text-black dark:text-white">Image Manager</h3>
      <div className="space-y-4">
        {slots.map((slot) => {
          const isUnsplash = slot.src.includes('unsplash.com');
          return (
            <div key={slot.id} className="bg-black/[0.02] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-4 flex gap-4 items-start shadow-sm">
              <div className="w-24 h-24 bg-gray-100 dark:bg-black rounded-lg overflow-hidden shrink-0 border border-black/10 dark:border-white/10">
                <img src={slot.src} alt={slot.alt} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-medium text-black dark:text-white truncate">{slot.alt || `Image ${slot.index + 1}`}</h4>
                  {isUnsplash && (
                    <span className="text-[10px] bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-500 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                      Replace before sending
                    </span>
                  )}
                </div>
                
                <div className="space-y-2 mt-3">
                  <input
                    type="url"
                    placeholder="Paste image URL..."
                    onBlur={(e) => handlePasteUrl(slot.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handlePasteUrl(slot.id, e.currentTarget.value);
                      }
                    }}
                    className="w-full bg-white dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-md p-2 text-xs text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-black/30 dark:focus:border-white/30 outline-none shadow-inner"
                  />
                  <button
                    onClick={() => setActiveSlot(slot.index)}
                    className="w-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-black dark:text-white text-xs py-2 rounded-md transition font-medium border border-black/[0.05] dark:border-none"
                  >
                    Browse Shopify Products
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeSlot !== null && (
        <ShopifyImagePicker
          onClose={() => setActiveSlot(null)}
          onSelect={(url, product) => handleReplaceImage(slots[activeSlot].id, url, product)}
        />
      )}
    </div>
  );
}
