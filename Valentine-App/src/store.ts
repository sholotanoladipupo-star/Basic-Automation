import { create } from 'zustand';
import { ValentineData, ValentineResponses, ValentinePhoto } from './types';

interface ValentineStore extends ValentineData {
  addPhoto: (photo: ValentinePhoto) => void;
  removePhoto: (id: string) => void;
  nextPhoto: () => void;
  prevPhoto: () => void;
  setResponse: (response: Partial<ValentineResponses>) => void;
  setStep: (step: ValentineData['currentStep']) => void;
  markQuestionAnswered: (question: keyof ValentineData['questionsAnswered']) => void;
  reset: () => void;
}

const initialState: ValentineData = {
  photos: [],
  responses: {
    favoriteFood: '',
    describeMe: '',
    datePreference: 'dinner',
    outfitPreference: 'short-gown',
  },
  currentStep: 'welcome',
  currentPhotoIndex: 0,
  questionsAnswered: {
    favoriteFood: false,
    describeMe: false,
    datePreference: false,
    outfitPreference: false,
  },
};

export const useValentineStore = create<ValentineStore>((set, get) => ({
  ...initialState,

  addPhoto: (photo) =>
    set((state) => ({
      photos: [...state.photos, photo],
    })),

  removePhoto: (id) =>
    set((state) => ({
      photos: state.photos.filter((p) => p.id !== id),
    })),

  nextPhoto: () =>
    set((state) => ({
      currentPhotoIndex: (state.currentPhotoIndex + 1) % state.photos.length,
    })),

  prevPhoto: () =>
    set((state) => ({
      currentPhotoIndex:
        state.currentPhotoIndex === 0
          ? state.photos.length - 1
          : state.currentPhotoIndex - 1,
    })),

  setResponse: (response) =>
    set((state) => ({
      responses: {
        ...state.responses,
        ...response,
      },
    })),

  setStep: (step) =>
    set(() => ({
      currentStep: step,
    })),

  markQuestionAnswered: (question) =>
    set((state) => ({
      questionsAnswered: {
        ...state.questionsAnswered,
        [question]: true,
      },
    })),

  reset: () => set(initialState),
}));
