import { SetMetadata } from '@nestjs/common';

export const PLAN_FEATURE_KEY = 'plan_feature';

export interface PlanFeatureMeta {
  feature: string;
}

/**
 * Gates a route behind the paid plan. The feature id is surfaced to the
 * client so the UI can prompt an upgrade for that specific capability.
 */
export const PlanFeature = (feature: string) =>
  SetMetadata(PLAN_FEATURE_KEY, { feature } as PlanFeatureMeta);
