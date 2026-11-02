// Hindi word lists for the stance-neutral markers in rhetoric-hi.js, in Devanagari and in the Latin
// spelling replies often use ("Hinglish"). Same families and the same rule as lexicon.js: a group
// named with marker grammar counts, disagreement and policy do not. Groups are listed in the
// direct and the oblique plural ("मुसलमान" / "मुसलमानों को"), with the common spelling variants.
// Text and lists are read in Unicode NFC, so nukta letters match however they were typed.
// Sources and dictionary labels: project-docs/evidence/LEXICON-SOURCES.md.

export const GROUPS_HI = [
  // धर्म, जाति, मूल
  "मुसलमान", "मुसलमानों", "मुस्लिम", "मुस्लिमों", "हिंदू", "हिन्दू", "हिंदुओं", "हिन्दुओं", "ईसाई", "ईसाइयों", "सिख", "सिखों",
  "दलित", "दलितों", "ब्राह्मण", "ब्राह्मणों", "बिहारी", "बिहारियों", "बंगाली", "बंगालियों", "पाकिस्तानी", "पाकिस्तानियों",
  "बांग्लादेशी", "बांग्लादेशियों", "रोहिंग्या", "रोहिंग्याओं", "घुसपैठिए", "घुसपैठियों", "कश्मीरी", "कश्मीरियों", "चीनियों",
  // राजनीति, और वे नाम जो हर पक्ष दूसरे को देता है
  "संघी", "संघियों", "भक्त", "भक्तों", "अंधभक्त", "अंधभक्तों", "कांग्रेसी", "कांग्रेसियों", "भाजपाई", "भाजपाइयों", "वामपंथी",
  "वामपंथियों", "लिबरल", "लिबरलों", "सेकुलर", "सेकुलरों", "सिकुलर", "सिकुलरों", "लिबरांडू", "लिबरांडुओं", "जिहादी", "जिहादियों",
  "नक्सली", "नक्सलियों", "आंदोलनजीवी", "आंदोलनजीवियों", "खालिस्तानी", "खालिस्तानियों", "चड्डीधारी", "चड्डीधारियों", "गद्दार",
  "गद्दारों", "देशद्रोही", "देशद्रोहियों", "मोदीभक्त", "मोदीभक्तों",
  // वर्ग, भूमिका, पहचान
  "औरतें", "औरतों", "महिलाएं", "महिलाओं", "मर्द", "मर्दों", "नारीवादी", "नारीवादियों", "फेमिनिस्ट", "फेमिनिस्टों", "पुलिसवाले",
  "पुलिसवालों", "अमीर", "अमीरों", "नेता", "नेताओं", "पत्रकार", "पत्रकारों", "शूद्र", "शूद्रों", "असमिया", "विकलांग", "विकलांगों", "हिजड़े",
  "हिजड़ों", "किन्नर", "किन्नरों", "समलैंगिक", "समलैंगिकों",
];
export const GROUPS_HI_LATN = ["musalman", "musalmaan", "musalmano", "musalmanon", "musalmaano", "muslim", "muslims", "muslimo",
  "mulle", "mullo", "hindu", "hindus", "hinduo", "hinduon", "dalit", "daliton", "sikh", "sikho", "isai", "isaiyon", "bihari",
  "biharion", "pakistani", "bangladeshi", "rohingya", "sanghi", "sanghiyon", "bhakt", "bhakto", "andhbhakt", "andhbhakto",
  "congressi", "librandu", "librandus", "sickular", "sickulars", "jihadi", "jihadiyo", "naxal", "naxali", "khalistani", "gaddar",
  "gaddaro", "deshdrohi", "aurat", "aurate", "auraten", "aurato", "auraton", "mard", "mardo", "feminist", "feminists", "hijre",
  "hijro", "hijde", "kinnar", "gay log", "neta", "netao", "patrakar", "shudra", "shudro", "assamese", "auratein",
  "aurtein", "viklang", "apahij"];

export const DEHUMANISE_HI = ["कीड़े", "कीड़ा", "कीड़े-मकोड़े", "दीमक", "कुत्ते", "कुत्ता", "सूअर", "सुअर", "जानवर", "कॉकरोच",
  "तिलचट्टे", "चूहे", "मच्छर", "गंदगी", "कचरा", "कैंसर", "वायरस", "नासूर", "राक्षस", "हैवान", "दानव", "जोंक", "परजीवी",
  "भेड़ें", "भेड़िये", "सांप", "साँप", "गिद्ध", "कीटाणु", "नाली के कीड़े"];
export const DEHUMANISE_HI_LATN = ["keede", "kide", "keeda", "kida", "keede makode", "deemak", "dimak", "kutte", "kutta", "suar",
  "suwar", "janwar", "jaanwar", "cockroach", "chuhe", "machhar", "gandagi", "kachra", "nasoor", "rakshas", "haivan", "parjivi",
  "jonk", "bhediye", "saanp", "gidh"];

// Physical harm after "<group> को". Sending away, jailing or banning is policy and stays at zero.
export const KILL_HI = ["मार डालो", "मार दो", "मार डालना चाहिए", "मार देना चाहिए", "मार देंगे", "मार डालेंगे", "मारो", "काट डालो",
  "काट दो", "काटो", "काट देना चाहिए", "जला दो", "जला डालो", "जलाओ", "जला देना चाहिए", "जिंदा जला दो", "ज़िंदा जला दो",
  "गोली मार दो", "गोली मारो", "गोली मार देनी चाहिए", "गोली मार देना चाहिए", "खत्म कर दो", "ख़त्म कर दो", "खत्म कर देना चाहिए",
  "मिटा दो", "मिटा देना चाहिए", "फांसी दो", "फाँसी दो", "फांसी पर लटका दो", "फाँसी पर लटका दो", "कुचल दो", "कुचल डालो",
  "लटका दो"];
export const KILL_HI_LATN = ["maar do", "mar do", "maar dalo", "maar daalo", "mar dalo", "maro", "maaro", "kaat do", "kaat dalo",
  "kato", "jala do", "jala dalo", "zinda jala do", "goli maar do", "goli maaro", "goli maro", "khatam kar do", "khatm kar do",
  "mita do", "fansi do", "faansi do", "kuchal do", "latka do"];

export const STEREOTYPE_TRAITS_HI = ["आतंकवादी", "अपराधी", "चोर", "गद्दार", "देशद्रोही", "बलात्कारी", "जाहिल", "गंवार", "गँवार",
  "धोखेबाज़", "धोखेबाज", "झूठे", "गंदे", "मूर्ख", "बेवकूफ", "बेवक़ूफ़", "कट्टरपंथी", "दंगाई", "लुटेरे", "निकम्मे", "कामचोर",
  "भ्रष्ट", "हरामी", "नमकहराम"];
export const STEREOTYPE_TRAITS_HI_LATN = ["aatankwadi", "atankwadi", "terrorist", "terrorists", "apradhi", "chor", "gaddar", "gaddaar", "deshdrohi",
  "balatkari", "jahil", "gawar", "ganwar", "dhokebaaz", "dhokhebaz", "jhoothe", "jhute", "gande", "murkh", "bewakoof", "bevkoof",
  "kattar", "dangai", "lutere", "nikamme", "kaamchor", "bhrasht", "harami"];

export const CONSPIRACY_HI = ["लव जिहाद", "लैंड जिहाद", "थूक जिहाद", "जनसंख्या जिहाद", "कोरोना जिहाद", "वोट जिहाद", "यूपीएससी जिहाद",
  "टुकड़े टुकड़े गैंग", "टुकड़े-टुकड़े गैंग", "अर्बन नक्सल", "विदेशी साज़िश", "विदेशी साजिश", "गोदी मीडिया", "बिकाऊ मीडिया",
  "प्रेस्टीट्यूट", "love jihad", "land jihad", "thook jihad", "corona jihad", "vote jihad", "tukde tukde gang",
  "tukde-tukde gang", "urban naxal", "urban naxals", "godi media", "bikau media", "presstitute", "presstitutes"];
// Funders named in "on the money of ..." accusations, from every direction.
export const PAYMASTERS_HI = ["चीन", "पाकिस्तान", "सोरोस", "अमेरिका", "आईएसआई", "भाजपा", "कांग्रेस", "आरएसएस", "विदेश", "अडानी",
  "china", "pakistan", "soros", "isi", "bjp", "congress", "rss", "adani"];

// Recorded as slurs: कटुआ and its forms (CSOH "Decoding Hate" glossary, LEXICON-SOURCES.md).
export const SLURS_HI = ["कटुआ", "कटुए", "कटुओं", "कटुवे", "कटमुल्ला", "कटमुल्ले", "कटमुल्लों", "katua", "katue", "katuwe",
  "katuo", "katmulla", "katmulle", "katmullo"];
// Gendered slur fused with a group: "<group> रंडी" (Wiktionary: derogatory).
export const GENDERED_HI = ["रंडी", "रंडियां", "रंडियाँ", "randi", "randiyan"];
