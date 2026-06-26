const es = {
  title: 'Acerca de',
  body: 'Ayuda Terremoto es una app de respuesta ante crisis con enfoque local-first. Esta página verifica la conexión con el servidor.',
  checking: 'Verificando API…',
  healthOk: 'API conectada',
  healthFail: 'API inaccesible — ¿está corriendo el emulador?',
  language: 'Idioma',
  howTitle: 'Cómo funciona',
  how: [
    'Reportar: cualquier persona verificada puede reportar una emergencia, para sí misma o para un vecino, con un triaje rápido y una ubicación en el mapa. Los reportes funcionan sin conexión y se sincronizan al reconectar.',
    'Mapa y triaje: los brigadistas ven los incidentes en un mapa con colores según la gravedad. Los sitios marcados como evacuados salen de la cola de búsqueda activa.',
    'Confianza: la identidad es una verificación blanda con la Cédula; la confianza real viene de una cadena de avales. Los coordinadores (Autoridad/Comando) emiten códigos de un solo uso que convierten a voluntarios en Brigadistas, y todo queda registrado para rendición de cuentas.',
    'Alertas y guías: Comando puede transmitir alertas oficiales, y las guías de seguridad sin conexión explican qué hacer durante y después de un sismo, ante fugas de gas, primeros auxilios y cómo evaluar edificios dañados.',
  ],
  replayIntro: 'Ver introducción de nuevo',
  openSource: 'Este proyecto es de código abierto.',
  viewOnGithub: 'Ver en GitHub',
  disclaimerTitle: 'Descargo de responsabilidad',
  disclaimerBody: 'Esta es una plataforma de código abierto desarrollada por voluntarios con el único propósito de apoyar a la comunidad durante una crisis. Su uso se realiza bajo su propia responsabilidad y no asumimos ninguna obligación legal, garantía de respuesta o responsabilidad por cualquier reporte u resultado. Esta aplicación no sustituye el contacto directo con las autoridades o servicios de emergencia oficiales (como el 911 o 171).',
}

const en: typeof es = {
  title: 'About',
  body: 'Ayuda Terremoto is a local-first crisis-response app. This page checks the connection to the backend.',
  checking: 'Checking API…',
  healthOk: 'API connected',
  healthFail: 'API unreachable — is the emulator running?',
  language: 'Language',
  howTitle: 'How it works',
  how: [
    'Report: anyone verified can report an emergency — for themselves or a neighbor — with a quick triage and a map location. Reports work offline and sync when you reconnect.',
    'Map & triage: responders see incidents on a map color-coded by severity. Sites marked evacuated leave the active search queue.',
    'Trust: identity is a soft check via the Cédula; real trust comes from a vouch chain. Coordinators (Authority/Command) issue single-use codes that turn volunteers into Responders, all logged for accountability.',
    'Alerts & guides: Command can broadcast official alerts, and the offline safety guides explain what to do during and after a quake, for gas leaks, first aid, and how to judge damaged buildings.',
  ],
  replayIntro: 'View intro again',
  openSource: 'This project is open source.',
  viewOnGithub: 'View on GitHub',
  disclaimerTitle: 'Disclaimer',
  disclaimerBody: 'This is an open-source platform developed by volunteers for the sole purpose of assisting the community during a crisis. Use is entirely at your own risk; we assume no legal obligation, response guarantees, or liability for any reports or outcomes. This application is not a substitute for contacting official emergency services (such as 911 or 171).',
}

export default { es, en }
