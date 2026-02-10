import React from 'react';
import { Heart, ArrowRight } from 'lucide-react';
import { useValentineStore } from '../store';

export const QuestionsFlow: React.FC = () => {
  const { responses, setResponse, markQuestionAnswered, setStep, questionsAnswered } = useValentineStore();

  const allAnswered =
    questionsAnswered.favoriteFood &&
    questionsAnswered.describeMe &&
    questionsAnswered.datePreference &&
    questionsAnswered.outfitPreference;

  const handleNext = () => {
    if (allAnswered) {
      setStep('proposal');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-rose-50 flex flex-col items-center justify-center p-4">
      {/* Decorative Elements */}
      <div className="absolute top-10 left-10 text-rose-300 text-3xl animate-pulse-slow">♥</div>
      <div className="absolute bottom-10 right-10 text-rose-200 text-3xl animate-pulse-slow">♥</div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-rose-700 mb-2 flex items-center justify-center gap-2">
            <Heart className="w-8 h-8 fill-rose-500" />
            Know You Better
          </h1>
          <p className="text-gray-600">Answer a few questions about you</p>
        </div>

        <div className="space-y-6">
          {/* Question 1: Favorite Food */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-rose-100 hover:border-rose-300 transition-all">
            <label className="block text-lg font-bold text-gray-800 mb-3">
              🍽️ What's your favorite food?
            </label>
            <input
              type="text"
              placeholder="e.g., Pizza, Sushi, Pasta..."
              value={responses.favoriteFood}
              onChange={(e) => {
                setResponse({ favoriteFood: e.target.value });
                if (e.target.value.trim()) {
                  markQuestionAnswered('favoriteFood');
                }
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-rose-400 focus:outline-none text-gray-800 placeholder-gray-400 transition-colors"
            />
            {questionsAnswered.favoriteFood && (
              <div className="mt-2 text-rose-600 font-medium text-sm">✓ Answered</div>
            )}
          </div>

          {/* Question 2: Describe Me */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-rose-100 hover:border-rose-300 transition-all">
            <label className="block text-lg font-bold text-gray-800 mb-3">
              ✨ One thing that describes me...
            </label>
            <input
              type="text"
              placeholder="e.g., Adventurous, Funny, Caring, Creative..."
              value={responses.describeMe}
              onChange={(e) => {
                setResponse({ describeMe: e.target.value });
                if (e.target.value.trim()) {
                  markQuestionAnswered('describeMe');
                }
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-rose-400 focus:outline-none text-gray-800 placeholder-gray-400 transition-colors"
            />
            {questionsAnswered.describeMe && (
              <div className="mt-2 text-rose-600 font-medium text-sm">✓ Answered</div>
            )}
          </div>

          {/* Question 3: Date Preference */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-rose-100 hover:border-rose-300 transition-all">
            <label className="block text-lg font-bold text-gray-800 mb-4">
              💑 What's your ideal date?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: 'dinner' as const, label: '🍽️ Dinner Date', emoji: '🍽️' },
                { value: 'beach' as const, label: '🏖️ Beach Date', emoji: '🏖️' },
                { value: 'hangout' as const, label: '🎪 Lovey Hangout', emoji: '🎪' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setResponse({ datePreference: option.value });
                    markQuestionAnswered('datePreference');
                  }}
                  className={`py-3 px-4 rounded-lg font-bold transition-all border-2 ${
                    responses.datePreference === option.value
                      ? 'bg-rose-500 text-white border-rose-500 scale-105 shadow-lg'
                      : 'bg-gray-50 text-gray-800 border-gray-200 hover:border-rose-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {questionsAnswered.datePreference && (
              <div className="mt-3 text-rose-600 font-medium text-sm">✓ Selected</div>
            )}
          </div>

          {/* Question 4: Outfit Preference */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-rose-100 hover:border-rose-300 transition-all">
            <label className="block text-lg font-bold text-gray-800 mb-4">
              👗 Pick your outfit vibe
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: 'short-gown' as const, label: '👗 Short Gown', emoji: '👗' },
                { value: 'long-gown' as const, label: '💃 Long Gown', emoji: '💃' },
                { value: 'jumpsuit' as const, label: '✨ Jumpsuit', emoji: '✨' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setResponse({ outfitPreference: option.value });
                    markQuestionAnswered('outfitPreference');
                  }}
                  className={`py-3 px-4 rounded-lg font-bold transition-all border-2 ${
                    responses.outfitPreference === option.value
                      ? 'bg-rose-500 text-white border-rose-500 scale-105 shadow-lg'
                      : 'bg-gray-50 text-gray-800 border-gray-200 hover:border-rose-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-rose-600 font-medium text-sm">💕 Short gown is personal favorite!</p>
            {questionsAnswered.outfitPreference && (
              <div className="mt-3 text-rose-600 font-medium text-sm">✓ Selected</div>
            )}
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mt-8 bg-white rounded-full shadow-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {['favoriteFood', 'describeMe', 'datePreference', 'outfitPreference'].map((q, i) => (
              <div
                key={q}
                className={`h-3 w-3 rounded-full transition-all ${
                  questionsAnswered[q as keyof typeof questionsAnswered]
                    ? 'bg-rose-500'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-bold text-gray-600">
            {Object.values(questionsAnswered).filter(Boolean).length} / 4
          </span>
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={!allAnswered}
          className={`w-full mt-6 py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
            allAnswered
              ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue to the Question
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
