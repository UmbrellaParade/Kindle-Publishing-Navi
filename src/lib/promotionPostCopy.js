/**
 * SNS投稿メモから、公開用の投稿本文だけを取り出す。
 * タイトルや選択SNSなどの管理情報はクリップボードへ含めない。
 */
export function getPromotionPostCopyText(post) {
  return typeof post?.body === 'string' ? post.body : '';
}
