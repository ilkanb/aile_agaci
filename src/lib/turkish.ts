// Turkish genitive suffix ("-ın/-in/-un/-ün", with a buffer "n" when the word
// already ends in a vowel) chosen by the vowel-harmony class of the name's
// last vowel, e.g. Hasan'ın, Zeynep'in, Ayşe'nin, Kaya'nın.
function lastVowel(name: string): string | null {
  const lower = name.toLocaleLowerCase('tr')
  for (let i = lower.length - 1; i >= 0; i--) {
    if ('aıoueiöü'.includes(lower[i])) return lower[i]
  }
  return null
}

export function turkishGenitive(name: string): string {
  const trimmed = name.trim()
  const vowel = lastVowel(trimmed)
  let suffix = 'ın'
  if (vowel === 'e' || vowel === 'i') suffix = 'in'
  else if (vowel === 'o' || vowel === 'u') suffix = 'un'
  else if (vowel === 'ö' || vowel === 'ü') suffix = 'ün'

  const endsInVowel = /[aıoueiöü]$/i.test(trimmed)
  return endsInVowel ? `${trimmed}'n${suffix}` : `${trimmed}'${suffix}`
}
