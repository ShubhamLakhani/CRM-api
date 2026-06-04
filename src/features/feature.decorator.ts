import { SetMetadata } from '@nestjs/common';

export const FEATURE_KEY = 'required_feature';
export const RequireFeature = (featureName: string) => SetMetadata(FEATURE_KEY, featureName);
