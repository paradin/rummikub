
import React from 'react';
import { Tile, TileColor } from '../types';

interface TileComponentProps {
  tile: Tile;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const TileComponent: React.FC<TileComponentProps> = ({ 
  tile, 
  onClick, 
  selected, 
  disabled,
  size = 'md'
}) => {
  const getColorClass = () => {
    switch (tile.color) {
      case TileColor.Red: return 'text-red-600';
      case TileColor.Blue: return 'text-blue-600';
      case TileColor.Orange: return 'text-orange-500';
      case TileColor.Black: return 'text-slate-900';
      case TileColor.Joker: return 'text-pink-600';
      default: return 'text-gray-800';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'w-8 h-10 text-lg';
      case 'lg': return 'w-14 h-20 text-3xl';
      default: return 'w-10 h-14 text-xl';
    }
  };

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`
        ${getSizeClasses()}
        ${getColorClass()}
        ${selected ? 'ring-4 ring-yellow-400 translate-y-[-4px]' : 'hover:translate-y-[-2px]'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        bg-white rounded-md border-b-4 border-gray-300 flex items-center justify-center font-bold 
        select-none transition-all duration-200 tile-shadow m-0.5
      `}
    >
      {tile.isJoker ? (
        <span className="text-2xl">☺</span>
      ) : (
        tile.number
      )}
    </div>
  );
};

export default TileComponent;
