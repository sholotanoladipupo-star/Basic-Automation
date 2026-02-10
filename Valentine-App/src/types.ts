export interface ValentinePhoto {
  id: string;
  src: string;
  caption?: string;
  uploadedAt: Date;
}

export interface ValentineResponses {
  favoriteFood: string;
  describeMe: string;
  datePreference: 'dinner' | 'beach' | 'hangout';
  outfitPreference: 'short-gown' | 'long-gown' | 'jumpsuit';
  isValentine?: boolean;
}

export interface ValentineData {
  photos: ValentinePhoto[];
  responses: ValentineResponses;
  currentStep: 'welcome' | 'photos' | 'questions' | 'proposal' | 'final';
  currentPhotoIndex: number;
  questionsAnswered: {
    favoriteFood: boolean;
    describeMe: boolean;
    datePreference: boolean;
    outfitPreference: boolean;
  };
}
