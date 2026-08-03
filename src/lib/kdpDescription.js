export function readKdpDescription(project) {
  const dedicatedDescription = typeof project?.kdp_description === 'string'
    ? project.kdp_description
    : '';
  if (dedicatedDescription) return dedicatedDescription;

  try {
    const metadata = project?.kdp_meta ? JSON.parse(project.kdp_meta) : {};
    return metadata
      && typeof metadata === 'object'
      && !Array.isArray(metadata)
      && typeof metadata.description === 'string'
      ? metadata.description
      : dedicatedDescription;
  } catch {
    return dedicatedDescription;
  }
}

export function buildKdpDescriptionUpdates(project, value) {
  const description = typeof value === 'string' ? value : String(value ?? '');

  try {
    const metadata = project?.kdp_meta ? JSON.parse(project.kdp_meta) : {};
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error('KDPメタデータ形式エラー');
    }
    return {
      kdp_description: description,
      kdp_meta: JSON.stringify({ ...metadata, description }),
    };
  } catch {
    // 壊れたメタデータは上書きせず、独立した説明文フィールドだけ更新する。
    return { kdp_description: description };
  }
}
