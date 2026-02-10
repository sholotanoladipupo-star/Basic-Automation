import React, { useState } from 'react';
import { Heart, Sparkles, MapPin, Utensils, Star, Dress } from 'lucide-react';
import { useValentineStore } from '../store';

export const ProposalScreen: React.FC = () => {
  const { responses, photos, setResponse, setStep } = useValentineStore();
  const [showConfetti, setShowConfetti] = useState(false);

  const handleYes = () => {
    setResponse({ isValentine: true });
    setShowConfetti(true);
    setTimeout(() => {
      setStep('final');
    }, 2000);
  };

  const handleNo = () => {
    setStep('questions');
  };

  const getDateEmoji = (type: string) => {
    switch (type) {
      case 'dinner':
        return '🍽️';
      case 'beach':
        return '🏖️';
      case 'hangout':
        return '🎪';
      default:
        return '💕';
    }
  };

  const getOutfitDescription = (outfit: string) => {
    switch (outfit) {
      case 'short-gown':
        return 'Short Gown ✨';
      case 'long-gown':
        return 'Long Gown 💃';
      case 'jumpsuit':
        return 'Jumpsuit 👔';
      default:
        return outfit;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Animated Background Hearts */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute text-rose-200 text-4xl animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.5}s`,
            }}
          >
            ♥
          </div>
        ))}
      </div>

      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute text-rose-500 text-3xl animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                animation: `fall 3s linear`,
              }}
            >
              {['♥', '✨', '💝'][Math.floor(Math.random() * 3)]}
            </div>
          ))}
          <style>{`
            @keyframes fall {
              to {
                transform: translateY(100vh) rotate(360deg);
                opacity: 0;
              }
            }
          `}</style>
        </div>
      )}

      <div className="relative z-10 w-full max-w-2xl">
        {/* Main Question */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 border-4 border-rose-200 mb-8 text-center">
          <div className="mb-6 flex justify-center gap-2">
            <Heart className="w-8 h-8 fill-rose-500 text-rose-500 animate-heartbeat" />
            <Heart className="w-8 h-8 fill-rose-500 text-rose-500 animate-heartbeat" style={{ animationDelay: '0.3s' }} />
            <Heart className="w-8 h-8 fill-rose-500 text-rose-500 animate-heartbeat" style={{ animationDelay: '0.6s' }} />
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-rose-700 mb-2">
            Will You Be My Valentine?
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            I've loved every moment with you. Let's make this Valentine's Day unforgettable.
          </p>

          {/* Summary of Responses */}
          <div className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-2xl p-6 mb-8 border-2 border-rose-200">
            <h3 className="font-bold text-gray-800 mb-4 text-lg">Our Perfect Date:</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {/* Food Preference */}
              <div className="bg-white rounded-lg p-4 border-l-4 border-rose-400">
                <div className="flex items-center gap-2 mb-1">
                  <Utensils className="w-5 h-5 text-rose-600" />
                  <span className="font-bold text-gray-700">Favorite Food</span>
                </div>
                <p className="text-rose-600 font-semibold text-lg">{responses.favoriteFood}</p>
              </div>

              {/* Description */}
              <div className="bg-white rounded-lg p-4 border-l-4 border-rose-400">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-5 h-5 text-rose-600" />
                  <span className="font-bold text-gray-700">About You</span>
                </div>
                <p className="text-rose-600 font-semibold text-lg">{responses.describeMe}</p>
              </div>

              {/* Date Type */}
              <div className="bg-white rounded-lg p-4 border-l-4 border-rose-400">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-5 h-5 text-rose-600" />
                  <span className="font-bold text-gray-700">Date Preference</span>
                </div>
                <p className="text-rose-600 font-semibold text-lg">
                  {getDateEmoji(responses.datePreference)} {responses.datePreference.charAt(0).toUpperCase() + responses.datePreference.slice(1)}
                </p>
              </div>

              {/* Outfit */}
              <div className="bg-white rounded-lg p-4 border-l-4 border-rose-400">
                <div className="flex items-center gap-2 mb-1">
                  <Dress className="w-5 h-5 text-rose-600" />
                  <span className="font-bold text-gray-700">Outfit Vibe</span>
                </div>
                <p className="text-rose-600 font-semibold text-lg">{getOutfitDescription(responses.outfitPreference)}</p>
              </div>
            </div>

            {/* Photo Count */}
            {photos.length > 0 && (
              <div className="mt-4 pt-4 border-t border-rose-200 text-center">
                <p className="text-gray-700">
                  <span className="font-bold text-rose-600">{photos.length}</span> beautiful memories shared ♥
                </p>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleYes}
              className="flex-1 bg-gradient-to-r from-rose-500 to-rose-600 text-white py-4 px-8 rounded-xl font-bold text-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
            >
              <Heart className="w-6 h-6 fill-white" />
              YES! ♥
            </button>

            <button
              onClick={handleNo}
              className="flex-1 bg-gray-200 text-gray-700 py-4 px-8 rounded-xl font-bold text-lg hover:bg-gray-300 transition-all"
            >
              Give me a moment...
            </button>
          </div>
        </div>

        {/* Romantic Message */}
        <div className="text-center text-gray-600 flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-rose-400" />
          <p>Take your time, I'll be waiting... 💕</p>
          <Sparkles className="w-5 h-5 text-rose-400" />
        </div>
      </div>
    </div>
  );
};
