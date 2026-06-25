import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authedFetch } from '../lib/authedFetch'

export interface AdmittedPatient {
  id: string
  name: string
  dni?: string
  hospitalName: string
  notes?: string
  status: 'admitted' | 'discharged'
  matchedMissingId?: string | null
  createdAt: string
  updatedAt: string
}

export interface PatientImportPayload {
  hospitalName: string
  textInput?: string
  imageBase64?: string
}

export const usePatientsStore = defineStore('patients', () => {
  const patients = ref<AdmittedPatient[]>([])
  const loading = ref(false)
  const importing = ref(false)

  async function fetchAll() {
    loading.value = true
    const r = await authedFetch<{ patients: AdmittedPatient[] }>('/patients')
    if (r.ok) patients.value = r.data.patients
    loading.value = false
    return r
  }

  async function importList(payload: PatientImportPayload) {
    importing.value = true
    const r = await authedFetch<{ patients: AdmittedPatient[]; matchedCount: number }>('/patients/analyze-list', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (r.ok) {
      // Prepend newly imported patients to the list
      patients.value = [...r.data.patients, ...patients.value]
    }
    importing.value = false
    return r
  }

  return { patients, loading, importing, fetchAll, importList }
})
