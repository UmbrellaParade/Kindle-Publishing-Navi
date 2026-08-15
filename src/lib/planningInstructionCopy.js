/**
 * 執筆指示書から、ChatGPTへ貼り付ける本文だけを取り出す。
 * 指示書名、版、状態、外部ファイルの所在などの管理情報は含めない。
 */
export function getPlanningInstructionCopyText(record) {
  return typeof record?.markdown === 'string' ? record.markdown : '';
}

/**
 * 本文を改変せず、渡されたClipboard書込み関数へ1回だけ渡す。
 */
export async function copyPlanningInstructionText(record, writeText) {
  const text = getPlanningInstructionCopyText(record);
  if (!text.trim()) throw new Error('コピーする指示書本文がありません');
  if (typeof writeText !== 'function') throw new Error('このブラウザではクリップボードを利用できません');
  await writeText(text);
  return text;
}
