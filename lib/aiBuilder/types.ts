import { AgentConfig, SiteStyleProfile, AgentSiteDocument, SectionType } from '../../shared/agent-sites-types';

export interface BuildSiteInput {
    agentConfig: AgentConfig;
    styleProfile?: SiteStyleProfile;
    options?: {
        forceRebuild?: boolean;
        sectionsToInclude?: SectionType[];
        maxTokens?: number;
    };
}

export interface BuildSiteOutput {
    document: AgentSiteDocument;
    tokenUsage: {
        input: number;
        output: number;
    };
    model: string;
    latencyMs: number;
}
