import React from 'react';

export interface NavItem {
  label: string;
  onClick: () => void;
  isCta?: boolean;
}

interface MobileOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavItem[];
  footer?: string;
}

export const MobileOverlay: React.FC<MobileOverlayProps> = ({
  isOpen,
  onClose,
  items,
  footer = "",
}) => {
  const handleClick = (item: NavItem) => {
    onClose();
    setTimeout(item.onClick, 150);
  };

  return (
    <div
      className={`fixed inset-0 w-screen h-screen bg-black/95 backdrop-blur-[24px] z-[99] flex flex-col items-center justify-center gap-8 transition-all duration-500 ease-in-out ${
        isOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'
      }`}
    >
      {items.map((item, i) =>
        item.isCta ? (
          <button
            key={i}
            onClick={() => handleClick(item)}
            className="px-5 py-2 border border-[#D4FF00] bg-[#D4FF00]/10 text-xs font-mono tracking-[4px] uppercase text-[#D4FF00] hover:bg-[#D4FF00] hover:text-black transition-colors"
          >
            {item.label}
          </button>
        ) : (
          <button
            key={i}
            onClick={() => handleClick(item)}
            className="text-xs font-mono tracking-[4px] uppercase text-[#aaaaaa] hover:text-[#D4FF00] transition-colors cursor-pointer bg-transparent border-none outline-none"
          >
            {item.label}
          </button>
        )
      )}
      <div className="text-[9px] font-mono tracking-[6px] text-white/30 uppercase mt-12">
        {footer}
      </div>
    </div>
  );
};
