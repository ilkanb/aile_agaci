import type { Person } from '../types'

function p(partial: Partial<Person> & { id: string; name: string }): Person {
  return {
    gender: '?',
    motherId: null,
    fatherId: null,
    spouseIds: [],
    note: '',
    ...partial,
  }
}

// Demo senaryosu: bir dede iki farkli kadinla evleniyor, 6 oz + 7 uvey kardes toplam 13 cocuk.
export const samplePeople: Record<string, Person> = Object.fromEntries(
  [
    p({ id: 'dede', name: 'Hasan Yilmaz', gender: 'E', spouseIds: ['nine1', 'nine2'] }),
    p({ id: 'nine1', name: 'Fatma Yilmaz', gender: 'K', spouseIds: ['dede'], note: 'Ilk esi' }),
    p({ id: 'nine2', name: 'Ayse Yilmaz', gender: 'K', spouseIds: ['dede'], note: 'Ikinci esi' }),

    // nine1'den 6 oz kardes
    ...Array.from({ length: 6 }, (_, i) =>
      p({
        id: `cocuk1_${i}`,
        name: `Cocuk ${i + 1} (Fatma'dan)`,
        gender: i % 2 === 0 ? 'E' : 'K',
        motherId: 'nine1',
        fatherId: 'dede',
      })
    ),

    // nine2'den 7 uvey kardes
    ...Array.from({ length: 7 }, (_, i) =>
      p({
        id: `cocuk2_${i}`,
        name: `Cocuk ${i + 1} (Ayse'den)`,
        gender: i % 2 === 0 ? 'K' : 'E',
        motherId: 'nine2',
        fatherId: 'dede',
      })
    ),

    // ilk cocuga bir es ve bir cocuk ekleyelim ki es/torun gorunumu de calissin
    p({ id: 'es1', name: 'Zeynep Kaya', gender: 'K', spouseIds: ['cocuk1_0'], note: 'Kan bagi yok' }),
    p({
      id: 'torun1',
      name: 'Ali Yilmaz',
      gender: 'E',
      motherId: 'es1',
      fatherId: 'cocuk1_0',
    }),
  ].map((person) => {
    if (person.id === 'cocuk1_0') {
      return ['cocuk1_0', { ...person, spouseIds: ['es1'] }] as const
    }
    return [person.id, person] as const
  })
)
