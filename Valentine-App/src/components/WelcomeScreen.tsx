import React from 'react';
import { Heart, ArrowRight, Sparkles } from 'lucide-react';
import { useValentineStore } from '../store';

export const WelcomeScreen: React.FC = () => {
  const { setStep } = useValentineStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-rose-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute text-rose-200 text-6xl animate-float"
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

      <div className="relative z-10 text-center max-w-2xl">
        {/* Main Content */}
        <div className="mb-8">
          <div className="flex justify-center mb-6 gap-2">
            <Sparkles className="w-8 h-8 text-rose-500 animate-pulse" />
            <Heart className="w-12 h-12 fill-rose-500 text-rose-500 animate-heartbeat" />
            <Sparkles className="w-8 h-8 text-rose-500 animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-rose-700 mb-4">
            A Special Surprise
          </h1>

          <p className="text-xl md:text-2xl text-gray-700 mb-6 leading-relaxed">
            I've created something special just for you this Valentine's Day 💝
          </p>

          <div className="bg-white/80 backdrop-blur rounded-2xl p-6 md:p-8 shadow-lg border-2 border-rose-200 mb-8">
            <p className="text-lg text-gray-700 mb-4">
              Together, we'll:
            </p>
            <ul className="space-y-3 text-left">
              <li className="flex items-center gap-3 text-gray-700">
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500 flex-shrink-0" />
                <span>Unfold beautiful memories we've created</span>
              </li>
              <li className="flex items-center gap-3 text-gray-700">
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500 flex-shrink-0" />
                <span>Dive deep into what matters to us</span>
              </li>
              <li className="flex items-center gap-3 text-gray-700">
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500 flex-shrink-0" />
                <span>Plan our perfect Valentine's date</span>
              </li>
              <li className="flex items-center gap-3 text-gray-700">
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500 flex-shrink-0" />
                <span>Celebrate what we share 💕</span>
              </li>
            </ul>
          </div>

          <p className="text-gray-600 text-lg mb-8 italic">
            Ready to see what I've prepared?
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => setStep('photos')}
          className="inline-flex items-center gap-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white px-8 py-4 rounded-full font-bold text-xl hover:shadow-2xl transition-all transform hover:scale-105 mb-8"
        >
          <span>Let's Begin</span>
          <ArrowRight className="w-6 h-6" />
        </button>

        {/* Footer Message */}
        <p className="text-rose-700 font-semibold text-sm">
          🎁 Click to open the surprise 🎁
        </p>
      </div>
    </div>
  );
};
