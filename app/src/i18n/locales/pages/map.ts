const es = {
  title: 'Mapa de incidentes',
  legend: 'Leyenda',
  cleared: 'Sitios despejados',
  active: 'Incidentes activos',
  empty: 'Aún no hay incidentes reportados.',
  shuffle: 'Reordenar',
  loadError: 'No se pudieron cargar los incidentes.',
  filters: {
    categoryLabel: 'Categoría',
    priorityLabel: 'Prioridad',
    sortByLabel: 'Ordenar por',
    viewLabel: 'Vista',
    noResults: 'Sin resultados para los filtros seleccionados.',
    categories: {
      all: 'Todas',
      medical: 'Médico',
      structural: 'Estructural',
      obstruction: 'Obstrucción',
      resource: 'Recursos',
    },
    priorities: {
      all: 'Todas',
      red: 'Crítica (Rojo)',
      yellow: 'Media (Amarillo)',
      green: 'Baja (Verde)',
    },
    sortOptions: {
      newest: 'Más recientes',
      oldest: 'Más antiguos',
      severityDesc: 'Gravedad (Mayor a menor)',
      severityAsc: 'Gravedad (Menor a mayor)',
    },
  },
}

const en: typeof es = {
  title: 'Incident map',
  legend: 'Legend',
  cleared: 'Cleared sites',
  active: 'Active incidents',
  empty: 'No incidents reported yet.',
  shuffle: 'Reorder',
  loadError: 'Could not load incidents.',
  filters: {
    categoryLabel: 'Category',
    priorityLabel: 'Priority',
    sortByLabel: 'Sort by',
    viewLabel: 'View',
    noResults: 'No results found matching the selected filters.',
    categories: {
      all: 'All',
      medical: 'Medical',
      structural: 'Structural',
      obstruction: 'Obstruction',
      resource: 'Resource',
    },
    priorities: {
      all: 'All',
      red: 'Critical (Red)',
      yellow: 'Medium (Yellow)',
      green: 'Low (Green)',
    },
    sortOptions: {
      newest: 'Newest first',
      oldest: 'Oldest first',
      severityDesc: 'Severity (High to Low)',
      severityAsc: 'Severity (Low to High)',
    },
  },
}

export default { es, en }
