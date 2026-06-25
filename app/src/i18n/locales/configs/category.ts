const es = {
  medical: 'Médico',
  structural: 'Estructural',
  obstruction: 'Obstrucción',
  resource: 'Recursos',

  // Labels
  structuralDamageLabel: 'Nivel de daño estructural',
  resourceTypeLabel: 'Tipo de recurso necesario',
  medicalCountLabel: 'Personas heridas / afectadas',
  obstructionTypeLabel: 'Tipo de obstrucción',

  // Placeholders
  selectDamage: 'Seleccionar nivel de daño',
  selectResource: 'Seleccionar tipo de recurso',
  selectCount: 'Seleccionar cantidad',
  selectObstruction: 'Seleccionar tipo de obstrucción',

  // Values
  damageValues: {
    minor: 'Leve / Estético',
    moderate: 'Moderado',
    severe: 'Grave / Inestable',
    collapse: 'Colapso Total o Parcial',
  },
  resourceValues: {
    water: 'Agua potable',
    food: 'Alimentos / Comida',
    medical: 'Suministros médicos',
    shelter: 'Refugio / Alojamiento',
    tools: 'Herramientas de rescate',
    other: 'Otro',
  },
  medicalCountValues: {
    '1': '1 persona',
    '2-5': '2 a 5 personas',
    '6-10': '6 a 10 personas',
    '10+': 'Más de 10 personas',
  },
  obstructionValues: {
    landslide: 'Derrumbe / Deslizamiento',
    debris: 'Escombros de edificación',
    trees: 'Árboles o postes caídos',
    vehicles: 'Vehículos cruzados',
    other: 'Otro',
  },
}

const en: typeof es = {
  medical: 'Medical',
  structural: 'Structural',
  obstruction: 'Obstruction',
  resource: 'Resource',

  // Labels
  structuralDamageLabel: 'Structural damage level',
  resourceTypeLabel: 'Type of resource needed',
  medicalCountLabel: 'Injured / affected people',
  obstructionTypeLabel: 'Type of obstruction',

  // Placeholders
  selectDamage: 'Select damage level',
  selectResource: 'Select resource type',
  selectCount: 'Select count',
  selectObstruction: 'Select obstruction type',

  // Values
  damageValues: {
    minor: 'Minor / Aesthetic',
    moderate: 'Moderate',
    severe: 'Severe / Unstable',
    collapse: 'Total or Partial Collapse',
  },
  resourceValues: {
    water: 'Drinking water',
    food: 'Food / Meals',
    medical: 'Medical supplies',
    shelter: 'Shelter / Housing',
    tools: 'Rescue tools',
    other: 'Other',
  },
  medicalCountValues: {
    '1': '1 person',
    '2-5': '2 to 5 people',
    '6-10': '6 to 10 people',
    '10+': 'More than 10 people',
  },
  obstructionValues: {
    landslide: 'Landslide / Mudslide',
    debris: 'Building debris',
    trees: 'Fallen trees/poles',
    vehicles: 'Vehicles blocking road',
    other: 'Other',
  },
}

export default { es, en }
