export const HIGH_1 = 0b10000000;
export const LOW_BITS = 0b00111111;

export type FeatureFlag = 'selfDescribing' | 'asSingleton';

export const Features: Record<FeatureFlag, number> = {
  selfDescribing: HIGH_1,
  asSingleton: HIGH_1 >>> 1,
};
