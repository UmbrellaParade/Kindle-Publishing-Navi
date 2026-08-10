export const PROJECT_DISPLAY_NAME_MAX_LENGTH = 80;

export class ProjectDisplayNameConflictError extends Error {
  constructor(latestProject) {
    super('この本の管理名は別の画面で変更されています。最新の名前を反映したので、確認してからもう一度変更してください');
    this.name = 'ProjectDisplayNameConflictError';
    this.latestProject = latestProject;
  }
}

export function normalizeProjectDisplayName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw new Error('本の管理名を入力してください');
  if (name.length > PROJECT_DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`本の管理名は${PROJECT_DISPLAY_NAME_MAX_LENGTH}文字以内で入力してください`);
  }
  return name;
}

export function buildProjectDisplayNameUpdate(latestProject, { expectedName, nextName } = {}) {
  if (!latestProject?.id) throw new Error('名前を変更する本が見つかりません');

  const latestName = typeof latestProject.name === 'string' ? latestProject.name : '';
  if (latestName !== expectedName) {
    throw new ProjectDisplayNameConflictError(latestProject);
  }

  return { name: normalizeProjectDisplayName(nextName) };
}
