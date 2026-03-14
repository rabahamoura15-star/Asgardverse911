const badWords = [
  // English
  'badword', 'bitch', 'fuck', 'shit', 'asshole', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'bastard',
  // Arabic
  'احمق', 'غبي', 'كلب', 'حمار', 'زق', 'قحبة', 'شرموطة', 'عرص', 'خرا',
  // French
  'merde', 'putain', 'salope', 'connard', 'conne', 'enculé', 'bâtard',
  // Spanish
  'puta', 'mierda', 'cabrón', 'pendejo', 'gilipollas', 'coño', 'joder',
  // Portuguese
  'porra', 'caralho', 'puta', 'merda', 'buceta', 'cuzão',
  // Hindi
  'मादरचोद', 'बहनचोद', 'चूतिया', 'भोसड़ी', 'कुतिया',
  // Chinese
  '操', '傻逼', '贱人', '他妈的', '婊子',
  // Korean
  '씨발', '개새끼', '병신', '지랄', '미친년',
  // Japanese
  'クソ', '馬鹿', '死ね', 'キモい', 'ファック'
];

export const containsProfanity = (text: string): boolean => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return badWords.some(word => lowerText.includes(word.toLowerCase()));
};
