export const KINDLE_COVER_SPEC = Object.freeze({
  recommendedWidth: 1600,
  recommendedHeight: 2560,
  minimumWidth: 625,
  minimumHeight: 1000,
  maximumDimension: 10000,
  idealAspectRatio: 1.6,
  maximumFileSizeMb: 50,
});

export const KINDLE_COVER_LINKS = Object.freeze({
  ebookRequirements: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G200645690',
  paperbackCalculator: 'https://kdp.amazon.co.jp/cover-templates',
  shimaumaTemplates: 'https://publish.n-pri.jp/template/',
});

export function assessKindleCoverDimensions(width, height) {
  const normalizedWidth = Number(width);
  const normalizedHeight = Number(height);

  if (!Number.isFinite(normalizedWidth) || !Number.isFinite(normalizedHeight)
    || normalizedWidth <= 0 || normalizedHeight <= 0) {
    return {
      level: 'unknown',
      meetsMinimum: false,
      meetsRecommended: false,
      meetsIdealRatio: false,
      message: '画像を登録すると、ここに実際の寸法と確認結果が表示されます。',
    };
  }

  const meetsMinimum = normalizedWidth >= KINDLE_COVER_SPEC.minimumWidth
    && normalizedHeight >= KINDLE_COVER_SPEC.minimumHeight
    && normalizedWidth <= KINDLE_COVER_SPEC.maximumDimension
    && normalizedHeight <= KINDLE_COVER_SPEC.maximumDimension;
  const meetsRecommended = normalizedWidth >= KINDLE_COVER_SPEC.recommendedWidth
    && normalizedHeight >= KINDLE_COVER_SPEC.recommendedHeight;
  const meetsIdealRatio = normalizedHeight / normalizedWidth >= KINDLE_COVER_SPEC.idealAspectRatio;

  if (!meetsMinimum) {
    return {
      level: 'warning',
      meetsMinimum,
      meetsRecommended,
      meetsIdealRatio,
      message: 'KDPの最小・最大寸法から外れています。幅625px以上・高さ1,000px以上、各辺10,000px以下にしてください。',
    };
  }

  if (!meetsIdealRatio) {
    return {
      level: 'warning',
      meetsMinimum,
      meetsRecommended,
      meetsIdealRatio,
      message: '最小寸法は満たしていますが、KDPの理想比率（高さ:幅＝1.6:1）より横長です。トリミングを確認してください。',
    };
  }

  if (!meetsRecommended) {
    return {
      level: 'info',
      meetsMinimum,
      meetsRecommended,
      meetsIdealRatio,
      message: 'KDPの最小寸法を満たしています。高解像度端末向けには幅1,600×高さ2,560px以上がおすすめです。',
    };
  }

  return {
    level: 'success',
    meetsMinimum,
    meetsRecommended,
    meetsIdealRatio,
    message: 'KDPの推奨寸法と理想比率の目安を満たしています。',
  };
}
