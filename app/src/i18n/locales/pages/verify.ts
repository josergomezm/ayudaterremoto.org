const es = {
  title: 'Verificar identidad',
  intro: 'Confirme su identidad con su Cédula. Es una verificación blanda para rendición de cuentas — no es una contraseña.',
  nationality: 'Nacionalidad',
  cedula: 'Número de Cédula',
  cedulaPlaceholder: 'ej. 12345678',
  lookup: 'Continuar',
  namePrompt: 'Seleccione su nombre completo',
  vouchPrompt: 'Código de aval',
  vouchHint: 'Si un coordinador le dio un código, ingréselo para ser Brigadista.',
  vouchPlaceholder: 'Código de 8 caracteres',
  confirm: 'Verificar',
  failed: 'Ese nombre no es correcto. Intente de nuevo en un momento.',
  cooldown: 'Demasiados intentos. Espere un momento.',
  notRegistered: 'Esta Cédula no está en el CNE. Pida un código de aval a un coordinador.',
  success: 'Verificado como {name} ({role}).',
  devHint: 'Dev: seleccione "{name}"',
}

const en: typeof es = {
  title: 'Verify identity',
  intro: 'Confirm your identity with your Cédula. This is a soft check for accountability — it is not a password.',
  nationality: 'Nationality',
  cedula: 'Cédula number',
  cedulaPlaceholder: 'e.g. 12345678',
  lookup: 'Continue',
  namePrompt: 'Select your full name',
  vouchPrompt: 'Vouch code',
  vouchHint: 'If a coordinator gave you a code, enter it to become a Responder.',
  vouchPlaceholder: '8-character code',
  confirm: 'Verify',
  failed: 'That name was not correct. Try again shortly.',
  cooldown: 'Too many attempts. Wait a moment.',
  notRegistered: 'This Cédula is not in the CNE roll. Ask a coordinator for a vouch code.',
  success: 'Verified as {name} ({role}).',
  devHint: 'Dev: select "{name}"',
}

export default { es, en }
