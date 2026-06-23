import { test, expect, describe } from 'vitest';
import { getDIRegionInfo, getRegionFromEndpoint, getDataResidencyFromEndpoint } from '../src/azure-di-region';

describe('getDIRegionInfo', () => {
  test('returns unknown for missing endpoint', () => {
    const info = getDIRegionInfo(undefined);
    expect(info.region).toBe('unknown');
    expect(info.dataResidency).toBe('unknown');
    expect(info.isSwiss).toBe(false);
    expect(info.isEU).toBe(false);
  });

  test('detects Switzerland North from endpoint', () => {
    const info = getDIRegionInfo('https://contigo-document-intelligence-ch.cognitiveservices.azure.com/');
    expect(info.region).toBe('switzerland-north');
    expect(info.dataResidency).toBe('switzerland');
    expect(info.isSwiss).toBe(true);
    expect(info.isEU).toBe(false);
  });

  test('detects West Europe', () => {
    const info = getDIRegionInfo('https://my-resource-westeurope.cognitiveservices.azure.com/');
    expect(info.region).toBe('west-europe');
    expect(info.dataResidency).toBe('eu');
    expect(info.isEU).toBe(true);
  });

  test('detects France Central', () => {
    const info = getDIRegionInfo('https://my-resource-francecentral.cognitiveservices.azure.com/');
    expect(info.region).toBe('france-central');
    expect(info.dataResidency).toBe('eu');
  });

  test('detects Norway East as EEA/EU', () => {
    const info = getDIRegionInfo('https://my-resource-norwayeast.cognitiveservices.azure.com/');
    expect(info.region).toBe('norway-east');
    expect(info.dataResidency).toBe('eea');
    expect(info.isEU).toBe(true);
  });

  test('returns other for unrecognized endpoints', () => {
    const info = getDIRegionInfo('https://contigodocumentintelligence.cognitiveservices.azure.com/');
    expect(info.region).toBe('unknown');
    expect(info.dataResidency).toBe('other');
  });

  test('detects generic switzerland hint', () => {
    const info = getDIRegionInfo('https://di-switzerland.cognitiveservices.azure.com/');
    expect(info.region).toBe('switzerland-north');
    expect(info.dataResidency).toBe('switzerland');
    expect(info.isSwiss).toBe(true);
  });

  test('detects Swiss -ch subdomain with numeric suffix', () => {
    const info = getDIRegionInfo('https://contigo-document-intelligence-ch-33560.cognitiveservices.azure.com/');
    expect(info.region).toBe('switzerland-north');
    expect(info.dataResidency).toBe('switzerland');
    expect(info.isSwiss).toBe(true);
  });
});

describe('helper exports', () => {
  test('getRegionFromEndpoint returns region string', () => {
    expect(getRegionFromEndpoint('https://my-resource-swedencentral.cognitiveservices.azure.com/')).toBe('sweden-central');
  });

  test('getDataResidencyFromEndpoint returns residency', () => {
    expect(getDataResidencyFromEndpoint('https://my-resource-uksouth.cognitiveservices.azure.com/')).toBe('eea');
  });
});
