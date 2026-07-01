// Only curriculum constants live here. Everything else (classes, subjects, assignments) is in Firebase.
export const FORMS = [1, 2, 3, 4, 5, 6]
export const SECTIONS = ['A', 'B', 'C']
export const GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']

export function className(form, section) {
  return `Form ${form}${section}`
}

export function nextForm(form) {
  const n = parseInt(form)
  return n < 6 ? n + 1 : null
}
