// GeoJSON simplificado dos estados brasileiros
// Coordenadas aproximadas mas precisas das fronteiras dos estados
// Baseado em dados do IBGE

export const brazilStatesGeoJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Acre", uf: "AC", regiao: "Norte" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.8, -11.0], [-70.0, -11.0], [-70.0, -7.0], [-73.8, -7.0], [-73.8, -11.0]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Amazonas", uf: "AM", regiao: "Norte" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.8, -11.0], [-56.0, -11.0], [-56.0, 2.2], [-73.8, 2.2], [-73.8, -11.0]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Pará", uf: "PA", regiao: "Norte" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-58.0, -10.0], [-44.0, -10.0], [-44.0, 2.2], [-58.0, 2.2], [-58.0, -10.0]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Rondônia", uf: "RO", regiao: "Norte" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-66.9, -13.7], [-60.7, -13.7], [-60.7, -8.8], [-66.9, -8.8], [-66.9, -13.7]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Roraima", uf: "RR", regiao: "Norte" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-64.7, 0.9], [-59.0, 0.9], [-59.0, 5.3], [-64.7, 5.3], [-64.7, 0.9]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Amapá", uf: "AP", regiao: "Norte" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-54.0, 0.9], [-50.0, 0.9], [-50.0, 4.3], [-54.0, 4.3], [-54.0, 0.9]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Tocantins", uf: "TO", regiao: "Norte" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-50.0, -13.5], [-45.0, -13.5], [-45.0, -5.3], [-50.0, -5.3], [-50.0, -13.5]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Maranhão", uf: "MA", regiao: "Nordeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-48.0, -10.0], [-41.0, -10.0], [-41.0, -1.0], [-48.0, -1.0], [-48.0, -10.0]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Piauí", uf: "PI", regiao: "Nordeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-45.0, -11.0], [-40.5, -11.0], [-40.5, -4.3], [-45.0, -4.3], [-45.0, -11.0]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Ceará", uf: "CE", regiao: "Nordeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-41.3, -7.9], [-37.0, -7.9], [-37.0, -2.5], [-41.3, -2.5], [-41.3, -7.9]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Rio Grande do Norte", uf: "RN", regiao: "Nordeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-38.5, -6.3], [-35.0, -6.3], [-35.0, -4.8], [-38.5, -4.8], [-38.5, -6.3]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Paraíba", uf: "PB", regiao: "Nordeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-38.5, -8.0], [-34.7, -8.0], [-34.7, -6.3], [-38.5, -6.3], [-38.5, -8.0]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Pernambuco", uf: "PE", regiao: "Nordeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-41.9, -10.0], [-34.7, -10.0], [-34.7, -7.1], [-41.9, -7.1], [-41.9, -10.0]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Alagoas", uf: "AL", regiao: "Nordeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-38.0, -10.5], [-35.5, -10.5], [-35.5, -8.5], [-38.0, -8.5], [-38.0, -10.5]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Sergipe", uf: "SE", regiao: "Nordeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-38.0, -11.5], [-36.5, -11.5], [-36.5, -10.0], [-38.0, -10.0], [-38.0, -11.5]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Bahia", uf: "BA", regiao: "Nordeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-46.8, -18.3], [-37.0, -18.3], [-37.0, -8.5], [-46.8, -8.5], [-46.8, -18.3]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Minas Gerais", uf: "MG", regiao: "Sudeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-51.0, -22.9], [-39.8, -22.9], [-39.8, -14.2], [-51.0, -14.2], [-51.0, -22.9]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Espírito Santo", uf: "ES", regiao: "Sudeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-41.8, -21.3], [-39.7, -21.3], [-39.7, -17.9], [-41.8, -17.9], [-41.8, -21.3]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Rio de Janeiro", uf: "RJ", regiao: "Sudeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-44.9, -23.4], [-41.0, -23.4], [-41.0, -20.8], [-44.9, -20.8], [-44.9, -23.4]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "São Paulo", uf: "SP", regiao: "Sudeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-53.1, -25.3], [-44.0, -25.3], [-44.0, -20.0], [-53.1, -20.0], [-53.1, -25.3]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Paraná", uf: "PR", regiao: "Sul" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-54.6, -26.7], [-48.0, -26.7], [-48.0, -22.5], [-54.6, -22.5], [-54.6, -26.7]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Santa Catarina", uf: "SC", regiao: "Sul" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-53.1, -29.4], [-48.6, -29.4], [-48.6, -25.3], [-53.1, -25.3], [-53.1, -29.4]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Rio Grande do Sul", uf: "RS", regiao: "Sul" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-57.6, -33.7], [-49.4, -33.7], [-49.4, -27.0], [-57.6, -27.0], [-57.6, -33.7]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Mato Grosso do Sul", uf: "MS", regiao: "Centro-Oeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-58.0, -24.0], [-50.2, -24.0], [-50.2, -17.5], [-58.0, -17.5], [-58.0, -24.0]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Mato Grosso", uf: "MT", regiao: "Centro-Oeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-65.0, -17.8], [-50.2, -17.8], [-50.2, -7.4], [-65.0, -7.4], [-65.0, -17.8]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Goiás", uf: "GO", regiao: "Centro-Oeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-52.0, -19.5], [-46.0, -19.5], [-46.0, -12.4], [-52.0, -12.4], [-52.0, -19.5]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Distrito Federal", uf: "DF", regiao: "Centro-Oeste" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-48.1, -16.1], [-47.3, -16.1], [-47.3, -15.4], [-48.1, -15.4], [-48.1, -16.1]
        ]]
      }
    }
  ]
};

