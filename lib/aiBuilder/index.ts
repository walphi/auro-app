import { buildSiteInternal } from './buildSite';
import { BuildSiteInput, BuildSiteOutput } from './types';

export async function buildSite(input: BuildSiteInput): Promise<BuildSiteOutput> {
    return buildSiteInternal(input);
}

export * from './types';
