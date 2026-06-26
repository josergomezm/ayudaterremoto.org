const es = {
  unverified: {
    heading: 'Para reportar, verifica tu identidad',
    body: 'El mapa es visible para todos. Para enviar reportes, inicia sesión con Google. Solo toma un minuto.',
    cta: 'Verificar identidad',
  },
  civilian: {
    heading: 'Tienes acceso Civil',
    body: 'Puedes reportar emergencias. Si un coordinador te da un código de aval, puedes convertirte en Brigadista.',
    cta: 'Ingresar código de aval',
  },
  dismiss: 'Entendido',
}

const en: typeof es = {
  unverified: {
    heading: 'To file reports, verify your identity',
    body: 'The map is visible to everyone. To submit reports, sign in with Google. It only takes a minute.',
    cta: 'Verify identity',
  },
  civilian: {
    heading: 'You have Civilian access',
    body: 'You can file emergency reports. If a coordinator gives you a vouch code, you can become a Responder.',
    cta: 'Enter vouch code',
  },
  dismiss: 'Got it',
}

export default { es, en }
