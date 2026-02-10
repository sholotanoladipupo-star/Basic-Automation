import React, { useState } from 'react';
import { Heart, ChevronLeft, ChevronRight, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useValentineStore } from '../store';

export const PhotoGallery: React.FC = () => {
  const { photos, currentPhotoIndex, addPhoto, removePhoto, nextPhoto, prevPhoto, setStep } = useValentineStore();
  const [isUploadMode, setIsUploadMode] = useState(photos.length === 0);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const src = event.target?.result as string;
          addPhoto({
            id: Date.now().toString(),
            src,
            caption: `Memory ${photos.length + 1}`,
            uploadedAt: new Date(),
          });
        };
        reader.readAsDataURL(file);
      });
    }
    e.currentTarget.value = '';
  };

  const currentPhoto = photos[currentPhotoIndex];
  const hasPhotos = photos.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex flex-col items-center justify-center p-4">
      {/* Decorative Hearts */}
      <div className="absolute top-10 left-10 text-rose-300 text-3xl animate-pulse-slow">♥</div>
      <div className="absolute top-20 right-8 text-rose-200 text-2xl animate-pulse-slow" style={{ animationDelay: '0.5s' }}>♥</div>
      <div className="absolute bottom-20 left-1/4 text-rose-200 text-2xl animate-pulse-slow" style={{ animationDelay: '1s' }}>♥</div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-rose-700 mb-2 flex items-center justify-center gap-2">
            <Heart className="w-8 h-8 fill-rose-500" />
            Our Memories
            <Heart className="w-8 h-8 fill-rose-500" />
          </h1>
          <p className="text-gray-600 text-lg">Let's unfold the moments we've shared together</p>
        </div>

        {hasPhotos ? (
          <div>
            {/* Photo Display */}
            <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden mb-6 border-4 border-rose-100">
              <div className="aspect-square md:aspect-auto md:h-96 relative overflow-hidden">
                <img
                  src={currentPhoto.src}
                  alt={currentPhoto.caption}
                  className="w-full h-full object-cover animate-fade-in"
                  key={currentPhoto.id}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

                {/* Photo Counter */}
                <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium">
                  {currentPhotoIndex + 1} / {photos.length}
                </div>

                {/* Caption */}
                {currentPhoto.caption && (
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur text-rose-700 px-4 py-2 rounded-lg font-semibold">
                    {currentPhoto.caption}
                  </div>
                )}
              </div>

              {/* Navigation Arrows */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-rose-600 p-3 rounded-full shadow-lg transition-all"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-rose-600 p-3 rounded-full shadow-lg transition-all"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            {/* Photo Thumbnails */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg cursor-pointer border-2 transition-all ${
                    index === currentPhotoIndex
                      ? 'border-rose-500 scale-105'
                      : 'border-gray-200 hover:border-rose-300'
                  }`}
                  onClick={() => {
                    // Move to this photo
                    const diff = index - currentPhotoIndex;
                    if (diff > 0) {
                      for (let i = 0; i < diff; i++) nextPhoto();
                    } else {
                      for (let i = 0; i < -diff; i++) prevPhoto();
                    }
                  }}
                >
                  <img src={photo.src} alt="" className="w-full h-full object-cover rounded-md" />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-center mb-6">
              <button
                onClick={() => setIsUploadMode(true)}
                className="flex items-center gap-2 bg-rose-100 text-rose-700 px-4 py-2 rounded-lg font-medium hover:bg-rose-200 transition-all"
              >
                <Plus className="w-5 h-5" />
                Add More
              </button>
              <button
                onClick={() => removePhoto(currentPhoto.id)}
                className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg font-medium hover:bg-red-200 transition-all"
              >
                <Trash2 className="w-5 h-5" />
                Delete
              </button>
            </div>

            {/* Next Step Button */}
            <button
              onClick={() => setStep('questions')}
              className="w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white py-3 rounded-xl font-bold text-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
            >
              Continue to Questions
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        ) : null}

        {/* Upload Section */}
        {isUploadMode && (
          <div className="bg-white rounded-3xl shadow-xl border-2 border-dashed border-rose-300 p-8 text-center">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handlePhotoUpload}
              id="photo-upload"
              className="hidden"
            />
            <label
              htmlFor="photo-upload"
              className="block cursor-pointer"
            >
              <div className="text-5xl mb-4">📸</div>
              <p className="text-xl font-bold text-gray-800 mb-2">Upload Your Memories</p>
              <p className="text-gray-600 mb-4">Select photos from your Photos Library</p>
              <span className="inline-block bg-rose-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-rose-600 transition-colors">
                Choose Photos
              </span>
            </label>

            {photos.length > 0 && (
              <>
                <div className="my-6 flex items-center gap-4">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <span className="text-gray-500">or</span>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>
                <button
                  onClick={() => setIsUploadMode(false)}
                  className="inline-block bg-gray-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-600 transition-colors"
                >
                  Continue with {photos.length} Photo{photos.length !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
