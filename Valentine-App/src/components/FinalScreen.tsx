import React, { useEffect, useState } from 'react';
import { Heart, Copy, Check } from 'lucide-react';
import { useValentineStore } from '../store';

export const FinalScreen: React.FC = () => {
  const { responses, photos, reset } = useValentineStore();
  const [copied, setCopied] = useState(false);

  const currentURL = window.location.href;

  const handleCopyURL = () => {
    navigator.clipboard.writeText(currentURL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartOver = () => {
    reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-600 via-rose-500 to-rose-600 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Confetti Background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute text-white text-3xl animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.3,
            }}
          >
            {['♥', '✨', '💝', '🎉'][Math.floor(Math.random() * 4)]}
          </div>
        ))}
      </div>

      <div className="relative z-10 text-center max-w-2xl">
        {/* Celebration */}
        <div className="mb-8">
          <div className="flex justify-center mb-6 gap-2">
            <Heart className="w-12 h-12 fill-white text-white animate-heartbeat" />
            <Heart className="w-12 h-12 fill-white text-white animate-heartbeat" style={{ animationDelay: '0.3s' }} />
            <Heart className="w-12 h-12 fill-white text-white animate-heartbeat" style={{ animationDelay: '0.6s' }} />
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-white mb-4 drop-shadow-lg">
            YES! 💕
          </h1>

          <p className="text-2xl text-white/90 mb-8 drop-shadow-md font-light">
            You've made me the happiest!
          </p>
        </div>

        {/* Celebration Box */}
        <div className="bg-white/95 backdrop-blur rounded-3xl p-8 md:p-10 shadow-2xl border-4 border-white mb-8">
          <h2 className="text-3xl font-bold text-rose-600 mb-6">
            Can't wait to see you, beautiful! 🌹
          </h2>

          <div className="space-y-4 text-left mb-8">
            <div className="bg-rose-50 rounded-lg p-4 border-l-4 border-rose-500">
              <p className="font-bold text-rose-700 mb-1">Our Plan:</p>
              <p className="text-gray-800 text-lg">
                {responses.datePreference === 'dinner' && '🍽️ Dinner Date - A romantic evening just for us'}
                {responses.datePreference === 'beach' && '🏖️ Beach Date - Sunset walks and ocean breeze'}
                {responses.datePreference === 'hangout' && '🎪 Lovey Hangout - Fun times at our special place'}
              </p>
            </div>

            <div className="bg-rose-50 rounded-lg p-4 border-l-4 border-rose-500">
              <p className="font-bold text-rose-700 mb-1">Your Favorite Food:</p>
              <p className="text-gray-800 text-lg">🍽️ {responses.favoriteFood}</p>
            </div>

            <div className="bg-rose-50 rounded-lg p-4 border-l-4 border-rose-500">
              <p className="font-bold text-rose-700 mb-1">What I Love About You:</p>
              <p className="text-gray-800 text-lg">✨ You're {responses.describeMe}</p>
            </div>

            <div className="bg-rose-50 rounded-lg p-4 border-l-4 border-rose-500">
              <p className="font-bold text-rose-700 mb-1">Outfit Vibes:</p>
              <p className="text-gray-800 text-lg">
                {responses.outfitPreference === 'short-gown' && '👗 Short Gown - My personal favorite on you!'}
                {responses.outfitPreference === 'long-gown' && '💃 Long Gown - Elegant and stunning'}
                {responses.outfitPreference === 'jumpsuit' && '✨ Jumpsuit - Classy and confident'}
              </p>
            </div>

            {photos.length > 0 && (
              <div className="bg-rose-50 rounded-lg p-4 border-l-4 border-rose-500">
                <p className="font-bold text-rose-700 mb-1">Memories We've Made:</p>
                <p className="text-gray-800 text-lg">💕 {photos.length} beautiful moments together</p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t-2 border-rose-200">
            <p className="text-gray-600 font-medium mb-4">
              This URL captures our special moment - save it and share it whenever you need a smile! 💝
            </p>
            
            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between gap-2 border-2 border-gray-200 mb-4">
              <code className="text-xs md:text-sm text-gray-600 truncate font-mono">
                {currentURL}
              </code>
              <button
                onClick={handleCopyURL}
                className="flex items-center gap-1 bg-rose-500 text-white px-3 py-2 rounded-lg font-bold hover:bg-rose-600 transition-all flex-shrink-0 whitespace-nowrap text-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Additional Message */}
        <div className="text-white text-center mb-8">
          <p className="text-xl font-light mb-2">
            I can't wait to hold your hand again...
          </p>
          <p className="text-lg font-semibold drop-shadow-lg">
            Happy Valentine's Day, my love 💕
          </p>
        </div>

        {/* Reset Button */}
        <button
          onClick={handleStartOver}
          className="bg-white text-rose-600 px-8 py-3 rounded-full font-bold text-lg hover:bg-rose-50 transition-all"
        >
          Start Over
        </button>
      </div>
    </div>
  );
};
