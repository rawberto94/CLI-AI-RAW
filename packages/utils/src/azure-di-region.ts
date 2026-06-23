/**
 * Azure Document Intelligence endpoint parsing.
 *
 * Derives region and data-residency labels from the endpoint URL so the app
 * never advertises a residency that does not match the actual resource.
 */

export interface DIRegionInfo {
  region: string;
  dataResidency: 'switzerland' | 'eu' | 'eea' | 'other' | 'unknown';
  isSwiss: boolean;
  isEU: boolean;
}

/**
 * Parse an Azure Cognitive Services / Document Intelligence endpoint and
 * return the region and data residency it represents.
 *
 * Examples:
 *   https://contigo-document-intelligence-ch.cognitiveservices.azure.com/ -> switzerland-north
 *   https://contigodocumentintelligence.cognitiveservices.azure.com/       -> unknown (no region hint)
 *   https://my-resource-westeurope.cognitiveservices.azure.com/            -> west-europe
 */
export function getDIRegionInfo(endpoint?: string): DIRegionInfo {
  if (!endpoint) {
    return { region: 'unknown', dataResidency: 'unknown', isSwiss: false, isEU: false };
  }

  const host = endpoint.toLowerCase();

  // Swiss regions
  if (host.includes('switzerlandnorth') || host.includes('switzerland-north')) {
    return { region: 'switzerland-north', dataResidency: 'switzerland', isSwiss: true, isEU: false };
  }
  if (host.includes('switzerlandwest') || host.includes('switzerland-west')) {
    return { region: 'switzerland-west', dataResidency: 'switzerland', isSwiss: true, isEU: false };
  }

  // EU / EEA regions
  if (host.includes('westeurope') || host.includes('west-europe')) {
    return { region: 'west-europe', dataResidency: 'eu', isSwiss: false, isEU: true };
  }
  if (host.includes('northeurope') || host.includes('north-europe')) {
    return { region: 'north-europe', dataResidency: 'eu', isSwiss: false, isEU: true };
  }
  if (host.includes('francecentral') || host.includes('france-central')) {
    return { region: 'france-central', dataResidency: 'eu', isSwiss: false, isEU: true };
  }
  if (host.includes('germanywestcentral') || host.includes('germany-west-central')) {
    return { region: 'germany-west-central', dataResidency: 'eu', isSwiss: false, isEU: true };
  }
  if (host.includes('swedencentral') || host.includes('sweden-central')) {
    return { region: 'sweden-central', dataResidency: 'eu', isSwiss: false, isEU: true };
  }
  if (host.includes('polandcentral') || host.includes('poland-central')) {
    return { region: 'poland-central', dataResidency: 'eu', isSwiss: false, isEU: true };
  }
  if (host.includes('norwayeast') || host.includes('norway-east')) {
    return { region: 'norway-east', dataResidency: 'eea', isSwiss: false, isEU: true };
  }
  if (host.includes('uksouth') || host.includes('uk-south')) {
    return { region: 'uk-south', dataResidency: 'eea', isSwiss: false, isEU: true };
  }

  // Explicit Switzerland subdomain fallback (e.g. ...-ch.cognitiveservices.azure.com or ...-ch-12345.cognitiveservices.azure.com)
  if (/\-ch(?:-\d+)?\.cognitiveservices\.azure\.com/.test(host)) {
    return { region: 'switzerland-north', dataResidency: 'switzerland', isSwiss: true, isEU: false };
  }

  // Generic Switzerland hint (legacy / test endpoints)
  if (host.includes('switzerland')) {
    return { region: 'switzerland-north', dataResidency: 'switzerland', isSwiss: true, isEU: false };
  }

  return { region: 'unknown', dataResidency: 'other', isSwiss: false, isEU: false };
}

/**
 * Backward-compatible helpers that mirror the old worker helpers.
 */
export function getDataResidencyFromEndpoint(endpoint?: string): DIRegionInfo['dataResidency'] {
  return getDIRegionInfo(endpoint).dataResidency;
}

export function getRegionFromEndpoint(endpoint?: string): string {
  return getDIRegionInfo(endpoint).region;
}
