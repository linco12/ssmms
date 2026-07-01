/**
 * Converts a Firebase DataSnapshot to an array of { key, ...val } objects.
 * Uses a block-body callback so Array.push() return value (truthy) never
 * cancels Firebase's inorderTraversal.
 */
export function snapArr(snap) {
  const list = []
  if (!snap || !snap.exists()) return list
  snap.forEach(child => {
    list.push({ key: child.key, ...child.val() })
  })
  return list
}
