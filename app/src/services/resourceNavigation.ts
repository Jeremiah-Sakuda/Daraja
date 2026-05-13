/**
 * Resource Navigation Service
 * Routes user queries to appropriate resources (clinics, legal aid, food, etc.)
 * Uses keyword matching for reliability (vs unreliable model function calling)
 */

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  description: string;
  address?: string;
  phone?: string;
  hours?: string;
  languages?: string[];
  services?: string[];
  location: 'boston' | 'nairobi' | 'dadaab';
}

export type ResourceType = 'clinic' | 'legal_aid' | 'food_pantry' | 'shelter' | 'education';

export interface ResourceQuery {
  text: string;
  language: 'so' | 'sw' | 'en';
  location?: 'boston' | 'nairobi' | 'dadaab';
}

export interface ResourceResult {
  type: ResourceType | null;
  resources: Resource[];
  confidence: number;
  responseText: string;
}

// Keyword patterns for intent detection
const INTENT_KEYWORDS: Record<ResourceType, { so: string[]; sw: string[]; en: string[] }> = {
  clinic: {
    so: ['dhakhtar', 'bukaan', 'xanuun', 'isbitaal', 'caafimaad', 'dawo', 'xummad', 'calool'],
    sw: ['daktari', 'hospitali', 'mgonjwa', 'kliniki', 'afya', 'dawa', 'homa', 'tumbo'],
    en: ['doctor', 'clinic', 'hospital', 'sick', 'medicine', 'fever', 'health', 'pain'],
  },
  legal_aid: {
    so: ['qareen', 'sharci', 'maxkamad', 'magangal', 'qaxooti', 'warqad', 'diiwaangelin'],
    sw: ['wakili', 'sheria', 'mahakama', 'hifadhi', 'mkimbizi', 'hati', 'usajili'],
    en: ['lawyer', 'legal', 'court', 'asylum', 'refugee', 'documents', 'immigration'],
  },
  food_pantry: {
    so: ['cunto', 'gaajo', 'raashin', 'kaab', 'lacag'],
    sw: ['chakula', 'njaa', 'msaada', 'benki ya chakula'],
    en: ['food', 'hungry', 'pantry', 'eat', 'assistance', 'bank'],
  },
  shelter: {
    so: ['guri', 'hoy', 'seexasho', 'qaxooti'],
    sw: ['nyumba', 'makazi', 'kulala', 'hifadhi'],
    en: ['shelter', 'housing', 'sleep', 'homeless', 'stay'],
  },
  education: {
    so: ['iskuul', 'waxbarasho', 'dugsiga', 'carruur', 'macalin'],
    sw: ['shule', 'elimu', 'kusoma', 'watoto', 'mwalimu'],
    en: ['school', 'education', 'learn', 'children', 'teacher', 'enroll'],
  },
};

// Hardcoded resources for demo
const RESOURCES: Resource[] = [
  // Boston area
  {
    id: 'boston-health-1',
    name: 'East Boston Neighborhood Health Center',
    type: 'clinic',
    description: 'Community health center with multilingual services',
    address: '10 Gove St, East Boston, MA 02128',
    phone: '617-569-5800',
    hours: 'Mon-Fri 8am-8pm, Sat 9am-3pm',
    languages: ['English', 'Spanish', 'Somali', 'Arabic'],
    services: ['Primary care', 'Pediatrics', 'Mental health', 'Dental'],
    location: 'boston',
  },
  {
    id: 'boston-health-2',
    name: 'Whittier Street Health Center',
    type: 'clinic',
    description: 'Federally qualified health center serving diverse communities',
    address: '1290 Tremont St, Roxbury, MA 02120',
    phone: '617-427-1000',
    hours: 'Mon-Fri 8am-6pm',
    languages: ['English', 'Somali', 'Haitian Creole'],
    services: ['Primary care', 'HIV services', 'Pharmacy'],
    location: 'boston',
  },
  {
    id: 'boston-legal-1',
    name: 'Political Asylum/Immigration Representation Project (PAIR)',
    type: 'legal_aid',
    description: 'Free legal services for asylum seekers',
    address: '98 N Washington St, Boston, MA 02114',
    phone: '617-742-9296',
    languages: ['English', 'Somali', 'Arabic', 'French'],
    services: ['Asylum applications', 'Immigration court', 'Work permits'],
    location: 'boston',
  },
  {
    id: 'boston-food-1',
    name: 'Greater Boston Food Bank',
    type: 'food_pantry',
    description: 'Emergency food assistance',
    address: '70 South Bay Ave, Boston, MA 02118',
    phone: '617-427-5200',
    hours: 'Mon-Fri 8am-4pm',
    services: ['Food distribution', 'SNAP assistance'],
    location: 'boston',
  },
  // Nairobi
  {
    id: 'nairobi-health-1',
    name: 'UNHCR Health Clinic - Eastleigh',
    type: 'clinic',
    description: 'UN refugee health services',
    address: 'Eastleigh, Nairobi',
    languages: ['Swahili', 'Somali', 'English'],
    services: ['Primary care', 'Maternal health', 'Vaccinations'],
    location: 'nairobi',
  },
  {
    id: 'nairobi-legal-1',
    name: 'Kituo Cha Sheria (Legal Advice Centre)',
    type: 'legal_aid',
    description: 'Free legal aid for refugees and asylum seekers',
    address: 'Ole Odume Rd, Nairobi',
    phone: '+254 20 387 6065',
    languages: ['Swahili', 'English', 'Somali'],
    services: ['Legal advice', 'Documentation', 'Refugee status'],
    location: 'nairobi',
  },
  // Dadaab
  {
    id: 'dadaab-health-1',
    name: 'IRC Health Post - Hagadera',
    type: 'clinic',
    description: 'International Rescue Committee health services',
    address: 'Hagadera Camp, Dadaab',
    languages: ['Somali', 'Swahili'],
    services: ['Emergency care', 'Maternal health', 'Nutrition'],
    location: 'dadaab',
  },
];

/**
 * Detect intent from user query using keyword matching
 */
function detectIntent(text: string, language: 'so' | 'sw' | 'en'): { type: ResourceType | null; confidence: number } {
  const normalizedText = text.toLowerCase();
  let bestMatch: ResourceType | null = null;
  let bestScore = 0;

  for (const [resourceType, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const langKeywords = keywords[language] || keywords.en;
    let matchCount = 0;

    for (const keyword of langKeywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    const score = matchCount / langKeywords.length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = resourceType as ResourceType;
    }
  }

  // Require at least one keyword match
  if (bestScore === 0) {
    return { type: null, confidence: 0 };
  }

  return {
    type: bestMatch,
    confidence: Math.min(1, bestScore * 2), // Scale up confidence
  };
}

/**
 * Generate response text in target language
 */
function generateResponseText(
  type: ResourceType,
  resources: Resource[],
  language: 'so' | 'sw' | 'en'
): string {
  const headers: Record<ResourceType, Record<string, string>> = {
    clinic: {
      so: 'Xarumaha caafimaadka ee kuu dhow:',
      sw: 'Vituo vya afya vilivyo karibu nawe:',
      en: 'Health clinics near you:',
    },
    legal_aid: {
      so: 'Adeegyada sharciga ee bilaashka ah:',
      sw: 'Huduma za kisheria bila malipo:',
      en: 'Free legal services:',
    },
    food_pantry: {
      so: 'Goobaha cuntada degdegga ah:',
      sw: 'Vituo vya chakula vya dharura:',
      en: 'Emergency food locations:',
    },
    shelter: {
      so: 'Goobaha hoyga:',
      sw: 'Vituo vya makazi:',
      en: 'Shelter locations:',
    },
    education: {
      so: 'Xarumaha waxbarashada:',
      sw: 'Vituo vya elimu:',
      en: 'Education centers:',
    },
  };

  const header = headers[type][language] || headers[type].en;
  const resourceList = resources.map((r) => `- ${r.name}: ${r.address || r.phone || ''}`).join('\n');

  return `${header}\n${resourceList}`;
}

/**
 * Find resources based on user query
 */
export function findResources(query: ResourceQuery): ResourceResult {
  const { type, confidence } = detectIntent(query.text, query.language);

  if (!type) {
    return {
      type: null,
      resources: [],
      confidence: 0,
      responseText:
        query.language === 'so'
          ? 'Fadlan sharax waxa aad raadinayso.'
          : query.language === 'sw'
            ? 'Tafadhali eleza unachohitaji.'
            : 'Please describe what you are looking for.',
    };
  }

  // Filter resources by type and location
  let resources = RESOURCES.filter((r) => r.type === type);
  if (query.location) {
    const locationFiltered = resources.filter((r) => r.location === query.location);
    if (locationFiltered.length > 0) {
      resources = locationFiltered;
    }
  }

  // Limit to top 3
  resources = resources.slice(0, 3);

  return {
    type,
    resources,
    confidence,
    responseText: generateResponseText(type, resources, query.language),
  };
}

/**
 * Get all resources of a specific type
 */
export function getResourcesByType(type: ResourceType, location?: string): Resource[] {
  let resources = RESOURCES.filter((r) => r.type === type);
  if (location) {
    resources = resources.filter((r) => r.location === location);
  }
  return resources;
}

/**
 * Get all available resource types
 */
export function getAvailableResourceTypes(): ResourceType[] {
  return ['clinic', 'legal_aid', 'food_pantry', 'shelter', 'education'];
}
