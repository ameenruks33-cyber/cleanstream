import type { VideoLanguageCode } from '../../../src/lib/videoLanguages.ts'

const PHRASES: Record<string, Record<Exclude<VideoLanguageCode, 'en'>, string>> = {
  'Big Buck Bunny — an open movie by the Blender Foundation.': {
    ml: 'ബിഗ് ബക്ക് ബണ്ണി — ബ്ലെൻഡർ ഫൗണ്ടേഷന്റെ ഓപ്പൺ സിനിമ.',
    ta: 'பிக் பக் பன்னி — பிளெண்டர் அறக்கட்டளையின் திறந்த திரைப்படம்.',
    hi: 'बिग बक बनी — ब्लेंडर फाउंडेशन की ओपन फिल्म।',
    ar: 'بيغ بك باني — فيلم مفتوح من مؤسسة بلندر.',
  },
  "Elephant's Dream — an open movie by the Blender Foundation.": {
    ml: 'എലിഫന്റ്സ് ഡ്രീം — ബ്ലെൻഡർ ഫൗണ്ടേഷന്റെ ഓപ്പൺ സിനിമ.',
    ta: 'எலிஃபண்ட்ஸ் ட்ரீம் — பிளெண்டர் அறக்கட்டளையின் திறந்த திரைப்படம்.',
    hi: 'एलिफेंट्स ड्रीम — ब्लेंडर फाउंडेशन की ओपन फिल्म।',
    ar: 'حلم الفيلة — فيلم مفتوح من مؤسسة بلندر.',
  },
  'Sintel — an open movie by the Blender Foundation.': {
    ml: 'സിന്റൽ — ബ്ലെൻഡർ ഫൗണ്ടേഷന്റെ ഓപ്പൺ സിനിമ.',
    ta: 'சின்டெல் — பிளெண்டர் அறக்கட்டளையின் திறந்த திரைப்படம்.',
    hi: 'सिन्टेल — ब्लेंडर फाउंडेशन की ओपन फिल्म।',
    ar: 'سينتل — فيلم مفتوح من مؤسسة بلندر.',
  },
  'Tears of Steel — an open movie by the Blender Foundation.': {
    ml: 'ടിയേഴ്‌സ് ഓഫ് സ്റ്റീൽ — ബ്ലെൻഡർ ഫൗണ്ടേഷന്റെ ഓപ്പൺ സിനിമ.',
    ta: 'டியர்ஸ் ஆஃப் ஸ்டீல் — பிளெண்டர் அறக்கட்டளையின் திறந்த திரைப்படம்.',
    hi: 'टियर्स ऑफ स्टील — ब्लेंडर फाउंडेशन की ओपन फिल्म।',
    ar: 'دموع الفولاذ — فيلم مفتوح من مؤسسة بلندر.',
  },
  'This file is streamed as a licensed MyTube library title, not a YouTube extract.': {
    ml: 'ഈ ഫയൽ ലൈസൻസുള്ള MyTube ലൈബ്രറി ടൈറ്റിലായി സ്ട്രീം ചെയ്യുന്നു; YouTube എക്‌സ്ട്രാക്റ്റ് അല്ല.',
    ta: 'இந்தக் கோப்பு உரிமம் பெற்ற MyTube நூலகத் தலைப்பாக ஒளிபரப்பப்படுகிறது; YouTube பிரித்தெடுப்பு அல்ல.',
    hi: 'यह फ़ाइल लाइसेंसशुदा MyTube लाइब्रेरी शीर्षक के रूप में स्ट्रीम होती है, यूट्यूब एक्सट्रैक्ट नहीं।',
    ar: 'يُعرض هذا الملف كعنوان مرخّص في مكتبة MyTube، وليس استخراجًا من يوتيوب.',
  },
}

export function translateLine(text: string, language: VideoLanguageCode): string {
  if (language === 'en') return text
  return PHRASES[text]?.[language] ?? text
}
