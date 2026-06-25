const es = {
  back: 'Atrás',
  cancel: 'Cancelar',
  submit: 'Enviar',
  next: 'Siguiente',
  loading: 'Cargando…',
  retry: 'Reintentar',
  yes: 'Sí',
  no: 'No',
  optional: 'opcional',
  close: 'Cerrar',
  saved: 'Guardado',
  error: 'Algo salió mal',
}

// Typed against es: a missing or extra key here is a compile error.
const en: typeof es = {
  back: 'Back',
  cancel: 'Cancel',
  submit: 'Submit',
  next: 'Next',
  loading: 'Loading…',
  retry: 'Retry',
  yes: 'Yes',
  no: 'No',
  optional: 'optional',
  close: 'Close',
  saved: 'Saved',
  error: 'Something went wrong',
}

export default { es, en }
