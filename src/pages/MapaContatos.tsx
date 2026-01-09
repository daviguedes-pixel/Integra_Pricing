import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, AlertCircle, TrendingDown, Building2, CheckCircle, Loader2, Upload } from "lucide-react";
import * as XLSX from 'xlsx';
import { MapContainer, TileLayer, GeoJSON, useMap, Tooltip, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { brazilStatesGeoJSON } from "@/data/brazil-states-geojson";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Fix para ícones padrão do Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Dados fictícios de contatos por região
interface ContatoData {
  regiao: string;
  uf: string;
  estado: string;
  cidade?: string;
  contatosTotal: number;
  contatosPegos: number;
  porcentagem: number;
  lat: number;
  lng: number;
  bounds?: [[number, number], [number, number]];
}

// Interface para contatos individuais com base e distribuidora
interface ContatoIndividual {
  id: string | number;
  regiao: string;
  uf: string;
  estado: string;
  cidade: string;
  base?: string;
  distribuidora?: string;
  status: 'pego' | 'faltante';
  dataContato?: string;
  responsavel?: string;
  pego?: boolean;
  // Campos adicionais que podem vir do banco
  [key: string]: any;
}

interface DadosAgregados {
  total: number;
  pegos: number;
  uf: string;
  estado: string;
  cidade?: string;
  regiao: string;
}

// Função para obter região por UF
const getRegiaoByUF = (uf: string): string => {
  const ufMap: Record<string, string> = {
    'AC': 'Norte', 'AM': 'Norte', 'AP': 'Norte', 'PA': 'Norte', 'RO': 'Norte', 'RR': 'Norte', 'TO': 'Norte',
    'AL': 'Nordeste', 'BA': 'Nordeste', 'CE': 'Nordeste', 'MA': 'Nordeste', 'PB': 'Nordeste',
    'PE': 'Nordeste', 'PI': 'Nordeste', 'RN': 'Nordeste', 'SE': 'Nordeste',
    'ES': 'Sudeste', 'MG': 'Sudeste', 'RJ': 'Sudeste', 'SP': 'Sudeste',
    'PR': 'Sul', 'RS': 'Sul', 'SC': 'Sul',
    'DF': 'Centro-Oeste', 'GO': 'Centro-Oeste', 'MT': 'Centro-Oeste', 'MS': 'Centro-Oeste'
  };
  return ufMap[uf?.toUpperCase()] || 'Outros';
};

// Função para obter coordenadas aproximadas por UF
const getCoordinatesByUF = (uf: string): { lat: number; lng: number } => {
  const coords: Record<string, { lat: number; lng: number }> = {
    'AC': { lat: -9.0238, lng: -70.8120 }, 'AM': { lat: -3.1190, lng: -60.0217 }, 'AP': { lat: 1.4144, lng: -51.7865 },
    'PA': { lat: -1.4558, lng: -48.5044 }, 'RO': { lat: -8.7612, lng: -63.9019 }, 'RR': { lat: 1.4144, lng: -61.8350 },
    'TO': { lat: -10.1753, lng: -48.2982 },
    'AL': { lat: -9.5713, lng: -36.7820 }, 'BA': { lat: -12.9714, lng: -38.5014 }, 'CE': { lat: -3.7172, lng: -38.5433 },
    'MA': { lat: -2.5387, lng: -44.2825 }, 'PB': { lat: -7.2400, lng: -36.7820 }, 'PE': { lat: -8.0476, lng: -34.8770 },
    'PI': { lat: -5.0892, lng: -42.8039 }, 'RN': { lat: -5.7945, lng: -35.2110 }, 'SE': { lat: -10.5741, lng: -37.3857 },
    'ES': { lat: -20.3155, lng: -40.3128 }, 'MG': { lat: -19.9167, lng: -43.9345 }, 'RJ': { lat: -22.9068, lng: -43.1729 },
    'SP': { lat: -23.5505, lng: -46.6333 },
    'PR': { lat: -25.4284, lng: -49.2733 }, 'RS': { lat: -30.0346, lng: -51.2177 }, 'SC': { lat: -27.5954, lng: -48.5480 },
    'DF': { lat: -15.7942, lng: -47.8822 }, 'GO': { lat: -16.6864, lng: -49.2643 }, 'MT': { lat: -15.6014, lng: -56.0979 },
    'MS': { lat: -20.4697, lng: -54.6201 }
  };
  return coords[uf?.toUpperCase()] || { lat: -14.2350, lng: -51.9253 };
};

// Dados fictícios de contatos por região/estado/cidade (serão substituídos por dados reais)
const dadosContatosInicial: ContatoData[] = [
  // Região Sudeste
  { regiao: "Sudeste", uf: "SP", estado: "São Paulo", contatosTotal: 1500, contatosPegos: 1200, porcentagem: 80, lat: -23.5505, lng: -46.6333, bounds: [[-25.3, -53.1], [-20.0, -44.0]] },
  { regiao: "Sudeste", uf: "SP", estado: "São Paulo", cidade: "São Paulo", contatosTotal: 800, contatosPegos: 680, porcentagem: 85, lat: -23.5505, lng: -46.6333 },
  { regiao: "Sudeste", uf: "SP", estado: "São Paulo", cidade: "Campinas", contatosTotal: 200, contatosPegos: 150, porcentagem: 75, lat: -22.9056, lng: -47.0608 },
  { regiao: "Sudeste", uf: "SP", estado: "São Paulo", cidade: "Santos", contatosTotal: 150, contatosPegos: 120, porcentagem: 80, lat: -23.9608, lng: -46.3331 },

  { regiao: "Sudeste", uf: "RJ", estado: "Rio de Janeiro", contatosTotal: 800, contatosPegos: 600, porcentagem: 75, lat: -22.9068, lng: -43.1729, bounds: [[-23.4, -44.9], [-20.8, -41.0]] },
  { regiao: "Sudeste", uf: "RJ", estado: "Rio de Janeiro", cidade: "Rio de Janeiro", contatosTotal: 500, contatosPegos: 400, porcentagem: 80, lat: -22.9068, lng: -43.1729 },
  { regiao: "Sudeste", uf: "RJ", estado: "Rio de Janeiro", cidade: "Niterói", contatosTotal: 100, contatosPegos: 75, porcentagem: 75, lat: -22.8833, lng: -43.1036 },

  { regiao: "Sudeste", uf: "MG", estado: "Minas Gerais", contatosTotal: 1200, contatosPegos: 900, porcentagem: 75, lat: -19.9167, lng: -43.9345, bounds: [[-22.9, -51.0], [-14.2, -39.8]] },
  { regiao: "Sudeste", uf: "MG", estado: "Minas Gerais", cidade: "Belo Horizonte", contatosTotal: 400, contatosPegos: 320, porcentagem: 80, lat: -19.9167, lng: -43.9345 },
  { regiao: "Sudeste", uf: "MG", estado: "Minas Gerais", cidade: "Uberlândia", contatosTotal: 200, contatosPegos: 150, porcentagem: 75, lat: -18.9186, lng: -48.2772 },
  { regiao: "Sudeste", uf: "MG", estado: "Minas Gerais", cidade: "Juiz de Fora", contatosTotal: 150, contatosPegos: 110, porcentagem: 73, lat: -21.7595, lng: -43.3398 },

  { regiao: "Sudeste", uf: "ES", estado: "Espírito Santo", contatosTotal: 300, contatosPegos: 210, porcentagem: 70, lat: -20.3155, lng: -40.3128, bounds: [[-21.3, -41.8], [-17.9, -39.7]] },
  { regiao: "Sudeste", uf: "ES", estado: "Espírito Santo", cidade: "Vitória", contatosTotal: 150, contatosPegos: 105, porcentagem: 70, lat: -20.3155, lng: -40.3128 },

  // Região Sul
  { regiao: "Sul", uf: "PR", estado: "Paraná", contatosTotal: 900, contatosPegos: 720, porcentagem: 80, lat: -25.4284, lng: -49.2733, bounds: [[-26.7, -54.6], [-22.5, -48.0]] },
  { regiao: "Sul", uf: "PR", estado: "Paraná", cidade: "Curitiba", contatosTotal: 400, contatosPegos: 340, porcentagem: 85, lat: -25.4284, lng: -49.2733 },
  { regiao: "Sul", uf: "PR", estado: "Paraná", cidade: "Londrina", contatosTotal: 200, contatosPegos: 160, porcentagem: 80, lat: -23.3105, lng: -51.1628 },

  { regiao: "Sul", uf: "SC", estado: "Santa Catarina", contatosTotal: 600, contatosPegos: 480, porcentagem: 80, lat: -27.5954, lng: -48.5480, bounds: [[-29.4, -53.1], [-25.3, -48.6]] },
  { regiao: "Sul", uf: "SC", estado: "Santa Catarina", cidade: "Florianópolis", contatosTotal: 250, contatosPegos: 210, porcentagem: 84, lat: -27.5954, lng: -48.5480 },
  { regiao: "Sul", uf: "SC", estado: "Santa Catarina", cidade: "Joinville", contatosTotal: 150, contatosPegos: 120, porcentagem: 80, lat: -26.3044, lng: -48.8464 },

  { regiao: "Sul", uf: "RS", estado: "Rio Grande do Sul", contatosTotal: 1000, contatosPegos: 750, porcentagem: 75, lat: -30.0346, lng: -51.2177, bounds: [[-33.7, -57.6], [-27.0, -49.4]] },
  { regiao: "Sul", uf: "RS", estado: "Rio Grande do Sul", cidade: "Porto Alegre", contatosTotal: 500, contatosPegos: 400, porcentagem: 80, lat: -30.0346, lng: -51.2177 },
  { regiao: "Sul", uf: "RS", estado: "Rio Grande do Sul", cidade: "Caxias do Sul", contatosTotal: 200, contatosPegos: 150, porcentagem: 75, lat: -29.1680, lng: -51.1794 },

  // Região Centro-Oeste
  { regiao: "Centro-Oeste", uf: "GO", estado: "Goiás", contatosTotal: 700, contatosPegos: 560, porcentagem: 80, lat: -16.6864, lng: -49.2643, bounds: [[-19.5, -52.0], [-12.4, -46.0]] },
  { regiao: "Centro-Oeste", uf: "GO", estado: "Goiás", cidade: "Goiânia", contatosTotal: 350, contatosPegos: 290, porcentagem: 83, lat: -16.6864, lng: -49.2643 },
  { regiao: "Centro-Oeste", uf: "GO", estado: "Goiás", cidade: "Aparecida de Goiânia", contatosTotal: 100, contatosPegos: 80, porcentagem: 80, lat: -16.8194, lng: -49.2439 },

  { regiao: "Centro-Oeste", uf: "DF", estado: "Distrito Federal", contatosTotal: 400, contatosPegos: 340, porcentagem: 85, lat: -15.7942, lng: -47.8822, bounds: [[-16.1, -48.1], [-15.4, -47.3]] },
  { regiao: "Centro-Oeste", uf: "DF", estado: "Distrito Federal", cidade: "Brasília", contatosTotal: 400, contatosPegos: 340, porcentagem: 85, lat: -15.7942, lng: -47.8822 },

  { regiao: "Centro-Oeste", uf: "MT", estado: "Mato Grosso", contatosTotal: 500, contatosPegos: 350, porcentagem: 70, lat: -15.6014, lng: -56.0979, bounds: [[-17.8, -65.0], [-7.4, -50.2]] },
  { regiao: "Centro-Oeste", uf: "MT", estado: "Mato Grosso", cidade: "Cuiabá", contatosTotal: 250, contatosPegos: 180, porcentagem: 72, lat: -15.6014, lng: -56.0979 },

  { regiao: "Centro-Oeste", uf: "MS", estado: "Mato Grosso do Sul", contatosTotal: 400, contatosPegos: 280, porcentagem: 70, lat: -20.4697, lng: -54.6201, bounds: [[-24.0, -58.0], [-17.5, -50.2]] },
  { regiao: "Centro-Oeste", uf: "MS", estado: "Mato Grosso do Sul", cidade: "Campo Grande", contatosTotal: 200, contatosPegos: 140, porcentagem: 70, lat: -20.4697, lng: -54.6201 },

  // Região Nordeste
  { regiao: "Nordeste", uf: "BA", estado: "Bahia", contatosTotal: 1100, contatosPegos: 770, porcentagem: 70, lat: -12.9714, lng: -38.5014, bounds: [[-18.3, -46.8], [-8.5, -37.0]] },
  { regiao: "Nordeste", uf: "BA", estado: "Bahia", cidade: "Salvador", contatosTotal: 500, contatosPegos: 360, porcentagem: 72, lat: -12.9714, lng: -38.5014 },
  { regiao: "Nordeste", uf: "BA", estado: "Bahia", cidade: "Feira de Santana", contatosTotal: 200, contatosPegos: 140, porcentagem: 70, lat: -12.2667, lng: -38.9667 },

  { regiao: "Nordeste", uf: "PE", estado: "Pernambuco", contatosTotal: 800, contatosPegos: 560, porcentagem: 70, lat: -8.0476, lng: -34.8770, bounds: [[-10.0, -41.9], [-7.1, -34.7]] },
  { regiao: "Nordeste", uf: "PE", estado: "Pernambuco", cidade: "Recife", contatosTotal: 400, contatosPegos: 280, porcentagem: 70, lat: -8.0476, lng: -34.8770 },

  { regiao: "Nordeste", uf: "CE", estado: "Ceará", contatosTotal: 700, contatosPegos: 490, porcentagem: 70, lat: -3.7172, lng: -38.5433, bounds: [[-7.9, -41.3], [-2.5, -37.0]] },
  { regiao: "Nordeste", uf: "CE", estado: "Ceará", cidade: "Fortaleza", contatosTotal: 350, contatosPegos: 245, porcentagem: 70, lat: -3.7172, lng: -38.5433 },

  // Região Norte
  { regiao: "Norte", uf: "AM", estado: "Amazonas", contatosTotal: 600, contatosPegos: 360, porcentagem: 60, lat: -3.1190, lng: -60.0217, bounds: [[-9.8, -73.8], [2.2, -56.0]] },
  { regiao: "Norte", uf: "AM", estado: "Amazonas", cidade: "Manaus", contatosTotal: 300, contatosPegos: 180, porcentagem: 60, lat: -3.1190, lng: -60.0217 },

  { regiao: "Norte", uf: "PA", estado: "Pará", contatosTotal: 500, contatosPegos: 300, porcentagem: 60, lat: -1.4558, lng: -48.5044, bounds: [[-9.8, -58.0], [2.2, -44.0]] },
  { regiao: "Norte", uf: "PA", estado: "Pará", cidade: "Belém", contatosTotal: 250, contatosPegos: 150, porcentagem: 60, lat: -1.4558, lng: -48.5044 },
];

// Dados fictícios de contatos individuais com base e distribuidora (serão substituídos por dados reais)
const contatosIndividuaisInicial: ContatoIndividual[] = [
  // São Paulo - Faltantes
  { id: '1', regiao: 'Sudeste', uf: 'SP', estado: 'São Paulo', cidade: 'São Paulo', base: 'Base SP Centro', distribuidora: 'Distribuidora ABC', status: 'faltante' },
  { id: '2', regiao: 'Sudeste', uf: 'SP', estado: 'São Paulo', cidade: 'São Paulo', base: 'Base SP Sul', distribuidora: 'Distribuidora XYZ', status: 'faltante' },
  { id: '3', regiao: 'Sudeste', uf: 'SP', estado: 'São Paulo', cidade: 'Campinas', base: 'Base Campinas', distribuidora: 'Distribuidora Norte', status: 'faltante' },
  { id: '4', regiao: 'Sudeste', uf: 'SP', estado: 'São Paulo', cidade: 'Campinas', base: 'Base Campinas', distribuidora: 'Distribuidora Sul', status: 'faltante' },
  { id: '5', regiao: 'Sudeste', uf: 'SP', estado: 'São Paulo', cidade: 'Santos', base: 'Base Baixada', distribuidora: 'Distribuidora Litoral', status: 'faltante' },

  // Rio de Janeiro - Faltantes
  { id: '6', regiao: 'Sudeste', uf: 'RJ', estado: 'Rio de Janeiro', cidade: 'Rio de Janeiro', base: 'Base RJ Zona Sul', distribuidora: 'Distribuidora Carioca', status: 'faltante' },
  { id: '7', regiao: 'Sudeste', uf: 'RJ', estado: 'Rio de Janeiro', cidade: 'Rio de Janeiro', base: 'Base RJ Zona Norte', distribuidora: 'Distribuidora Fluminense', status: 'faltante' },
  { id: '8', regiao: 'Sudeste', uf: 'RJ', estado: 'Rio de Janeiro', cidade: 'Niterói', base: 'Base Niterói', distribuidora: 'Distribuidora Niterói', status: 'faltante' },

  // Minas Gerais - Faltantes
  { id: '9', regiao: 'Sudeste', uf: 'MG', estado: 'Minas Gerais', cidade: 'Belo Horizonte', base: 'Base BH Centro', distribuidora: 'Distribuidora Mineira', status: 'faltante' },
  { id: '10', regiao: 'Sudeste', uf: 'MG', estado: 'Minas Gerais', cidade: 'Belo Horizonte', base: 'Base BH Pampulha', distribuidora: 'Distribuidora Central', status: 'faltante' },
  { id: '11', regiao: 'Sudeste', uf: 'MG', estado: 'Minas Gerais', cidade: 'Uberlândia', base: 'Base Uberlândia', distribuidora: 'Distribuidora Triângulo', status: 'faltante' },
  { id: '12', regiao: 'Sudeste', uf: 'MG', estado: 'Minas Gerais', cidade: 'Juiz de Fora', base: 'Base JF', distribuidora: 'Distribuidora Zona da Mata', status: 'faltante' },

  // Espírito Santo - Faltantes
  { id: '13', regiao: 'Sudeste', uf: 'ES', estado: 'Espírito Santo', cidade: 'Vitória', base: 'Base Vitória', distribuidora: 'Distribuidora Capixaba', status: 'faltante' },

  // Paraná - Faltantes
  { id: '14', regiao: 'Sul', uf: 'PR', estado: 'Paraná', cidade: 'Curitiba', base: 'Base Curitiba Centro', distribuidora: 'Distribuidora Paranaense', status: 'faltante' },
  { id: '15', regiao: 'Sul', uf: 'PR', estado: 'Paraná', cidade: 'Londrina', base: 'Base Londrina', distribuidora: 'Distribuidora Norte PR', status: 'faltante' },

  // Santa Catarina - Faltantes
  { id: '16', regiao: 'Sul', uf: 'SC', estado: 'Santa Catarina', cidade: 'Florianópolis', base: 'Base Floripa', distribuidora: 'Distribuidora Catarinense', status: 'faltante' },
  { id: '17', regiao: 'Sul', uf: 'SC', estado: 'Santa Catarina', cidade: 'Joinville', base: 'Base Joinville', distribuidora: 'Distribuidora Norte SC', status: 'faltante' },

  // Rio Grande do Sul - Faltantes
  { id: '18', regiao: 'Sul', uf: 'RS', estado: 'Rio Grande do Sul', cidade: 'Porto Alegre', base: 'Base POA Centro', distribuidora: 'Distribuidora Gaúcha', status: 'faltante' },
  { id: '19', regiao: 'Sul', uf: 'RS', estado: 'Rio Grande do Sul', cidade: 'Porto Alegre', base: 'Base POA Zona Sul', distribuidora: 'Distribuidora Sul RS', status: 'faltante' },
  { id: '20', regiao: 'Sul', uf: 'RS', estado: 'Rio Grande do Sul', cidade: 'Caxias do Sul', base: 'Base Caxias', distribuidora: 'Distribuidora Serra', status: 'faltante' },

  // Goiás - Faltantes
  { id: '21', regiao: 'Centro-Oeste', uf: 'GO', estado: 'Goiás', cidade: 'Goiânia', base: 'Base Goiânia Centro', distribuidora: 'Distribuidora Goiana', status: 'faltante' },
  { id: '22', regiao: 'Centro-Oeste', uf: 'GO', estado: 'Goiás', cidade: 'Aparecida de Goiânia', base: 'Base Aparecida', distribuidora: 'Distribuidora Metropolitana', status: 'faltante' },

  // Distrito Federal - Faltantes
  { id: '23', regiao: 'Centro-Oeste', uf: 'DF', estado: 'Distrito Federal', cidade: 'Brasília', base: 'Base Brasília Asa Norte', distribuidora: 'Distribuidora Federal', status: 'faltante' },
  { id: '24', regiao: 'Centro-Oeste', uf: 'DF', estado: 'Distrito Federal', cidade: 'Brasília', base: 'Base Brasília Asa Sul', distribuidora: 'Distribuidora Central DF', status: 'faltante' },

  // Mato Grosso - Faltantes
  { id: '25', regiao: 'Centro-Oeste', uf: 'MT', estado: 'Mato Grosso', cidade: 'Cuiabá', base: 'Base Cuiabá', distribuidora: 'Distribuidora Pantanal', status: 'faltante' },
  { id: '26', regiao: 'Centro-Oeste', uf: 'MT', estado: 'Mato Grosso', cidade: 'Cuiabá', base: 'Base Cuiabá Centro', distribuidora: 'Distribuidora Centro-Oeste', status: 'faltante' },

  // Mato Grosso do Sul - Faltantes
  { id: '27', regiao: 'Centro-Oeste', uf: 'MS', estado: 'Mato Grosso do Sul', cidade: 'Campo Grande', base: 'Base Campo Grande', distribuidora: 'Distribuidora MS', status: 'faltante' },

  // Bahia - Faltantes
  { id: '28', regiao: 'Nordeste', uf: 'BA', estado: 'Bahia', cidade: 'Salvador', base: 'Base Salvador Centro', distribuidora: 'Distribuidora Baiana', status: 'faltante' },
  { id: '29', regiao: 'Nordeste', uf: 'BA', estado: 'Bahia', cidade: 'Salvador', base: 'Base Salvador Barra', distribuidora: 'Distribuidora Litoral BA', status: 'faltante' },
  { id: '30', regiao: 'Nordeste', uf: 'BA', estado: 'Bahia', cidade: 'Feira de Santana', base: 'Base Feira', distribuidora: 'Distribuidora Recôncavo', status: 'faltante' },

  // Pernambuco - Faltantes
  { id: '31', regiao: 'Nordeste', uf: 'PE', estado: 'Pernambuco', cidade: 'Recife', base: 'Base Recife Centro', distribuidora: 'Distribuidora Pernambucana', status: 'faltante' },
  { id: '32', regiao: 'Nordeste', uf: 'PE', estado: 'Pernambuco', cidade: 'Recife', base: 'Base Recife Boa Viagem', distribuidora: 'Distribuidora Litoral PE', status: 'faltante' },

  // Ceará - Faltantes
  { id: '33', regiao: 'Nordeste', uf: 'CE', estado: 'Ceará', cidade: 'Fortaleza', base: 'Base Fortaleza Centro', distribuidora: 'Distribuidora Cearense', status: 'faltante' },
  { id: '34', regiao: 'Nordeste', uf: 'CE', estado: 'Ceará', cidade: 'Fortaleza', base: 'Base Fortaleza Aldeota', distribuidora: 'Distribuidora Litoral CE', status: 'faltante' },

  // Amazonas - Faltantes
  { id: '35', regiao: 'Norte', uf: 'AM', estado: 'Amazonas', cidade: 'Manaus', base: 'Base Manaus Centro', distribuidora: 'Distribuidora Amazônica', status: 'faltante' },
  { id: '36', regiao: 'Norte', uf: 'AM', estado: 'Amazonas', cidade: 'Manaus', base: 'Base Manaus Zona Norte', distribuidora: 'Distribuidora Norte AM', status: 'faltante' },

  // Pará - Faltantes
  { id: '37', regiao: 'Norte', uf: 'PA', estado: 'Pará', cidade: 'Belém', base: 'Base Belém Centro', distribuidora: 'Distribuidora Paraense', status: 'faltante' },
  { id: '38', regiao: 'Norte', uf: 'PA', estado: 'Pará', cidade: 'Belém', base: 'Base Belém Icoaraci', distribuidora: 'Distribuidora Litoral PA', status: 'faltante' },
];

// Função para obter cor baseada na porcentagem
// Cores fixas por região
const getColorByRegiao = (regiao: string): string => {
  switch (regiao) {
    case 'Norte':
      return "#8b5cf6"; // Roxo
    case 'Nordeste':
      return "#ec4899"; // Rosa
    case 'Sudeste':
      return "#3b82f6"; // Azul
    case 'Sul':
      return "#10b981"; // Verde
    case 'Centro-Oeste':
      return "#f59e0b"; // Laranja
    default:
      return "#6b7280"; // Cinza
  }
};

// Cores dinâmicas por porcentagem (apenas para marcadores)
const getColorByPercentage = (percentage: number): string => {
  if (percentage >= 80) return "#16a34a"; // Verde - Excelente
  if (percentage >= 70) return "#65a30d"; // Verde claro - Bom
  if (percentage >= 60) return "#eab308"; // Amarelo - Regular
  if (percentage >= 50) return "#f97316"; // Laranja - Ruim
  return "#dc2626"; // Vermelho - Muito ruim
};

// Componente para renderizar GeoJSON com silhueta real do Brasil

// Componente para renderizar GeoJSON com estilo dinâmico usando silhueta real do Brasil
function RegionLayer({ data }: { data: ContatoData[] }) {
  const [mapZoom, setMapZoom] = useState(4);
  const [geoJsonData, setGeoJsonData] = useState<any>(brazilStatesGeoJSON);
  const map = useMap();

  // Tentar carregar GeoJSON mais preciso de uma fonte pública
  useEffect(() => {
    const loadPreciseGeoJSON = async () => {
      try {
        // Tentar carregar GeoJSON do Brasil de fontes públicas conhecidas
        // Se não funcionar, usa o GeoJSON local
        const urls = [
          'https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-27-uf.json',
          'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson'
        ];

        for (const url of urls) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              // Verificar se tem a estrutura correta
              if (data.features && Array.isArray(data.features)) {
                setGeoJsonData(data);
                console.log('GeoJSON carregado de:', url);
                return;
              }
            }
          } catch (e) {
            continue;
          }
        }
      } catch (error) {
        console.log('Usando GeoJSON local:', error);
      }
    };

    loadPreciseGeoJSON();
  }, []);

  useEffect(() => {
    const updateZoom = () => {
      setMapZoom(map.getZoom());
    };

    map.on('zoomend', updateZoom);
    updateZoom();

    return () => {
      map.off('zoomend', updateZoom);
    };
  }, [map]);

  // Criar mapa de dados por UF
  const dataByUF = useMemo(() => {
    const map = new Map<string, ContatoData>();
    data.forEach(item => {
      if (!item.cidade) {
        const existing = map.get(item.uf);
        if (!existing || item.contatosTotal > existing.contatosTotal) {
          map.set(item.uf, item);
        }
      }
    });
    return map;
  }, [data]);

  // Agrupar dados por região para zoom baixo
  const dataByRegiao = useMemo(() => {
    const regioes = new Map<string, { total: number; pegos: number; ufs: string[] }>();
    data.forEach(item => {
      if (!item.cidade) {
        const existing = regioes.get(item.regiao);
        if (!existing) {
          regioes.set(item.regiao, {
            total: item.contatosTotal,
            pegos: item.contatosPegos,
            ufs: [item.uf]
          });
        } else {
          existing.total += item.contatosTotal;
          existing.pegos += item.contatosPegos;
          if (!existing.ufs.includes(item.uf)) {
            existing.ufs.push(item.uf);
          }
        }
      }
    });
    return regioes;
  }, [data]);

  // Função auxiliar para obter região por UF
  const getRegiaoByUF = (uf: string): string | null => {
    const ufMap: Record<string, string> = {
      'AC': 'Norte', 'AM': 'Norte', 'AP': 'Norte', 'PA': 'Norte', 'RO': 'Norte', 'RR': 'Norte', 'TO': 'Norte',
      'AL': 'Nordeste', 'BA': 'Nordeste', 'CE': 'Nordeste', 'MA': 'Nordeste', 'PB': 'Nordeste',
      'PE': 'Nordeste', 'PI': 'Nordeste', 'RN': 'Nordeste', 'SE': 'Nordeste',
      'ES': 'Sudeste', 'MG': 'Sudeste', 'RJ': 'Sudeste', 'SP': 'Sudeste',
      'PR': 'Sul', 'RS': 'Sul', 'SC': 'Sul',
      'DF': 'Centro-Oeste', 'GO': 'Centro-Oeste', 'MT': 'Centro-Oeste', 'MS': 'Centro-Oeste'
    };
    return ufMap[uf] || null;
  };

  // Função auxiliar para obter UF por nome
  const getUFByName = (name: string): string => {
    const nameMap: Record<string, string> = {
      'Acre': 'AC', 'Amazonas': 'AM', 'Amapá': 'AP', 'Pará': 'PA', 'Rondônia': 'RO',
      'Roraima': 'RR', 'Tocantins': 'TO',
      'Alagoas': 'AL', 'Bahia': 'BA', 'Ceará': 'CE', 'Maranhão': 'MA', 'Paraíba': 'PB',
      'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio Grande do Norte': 'RN', 'Sergipe': 'SE',
      'Espírito Santo': 'ES', 'Minas Gerais': 'MG', 'Rio de Janeiro': 'RJ', 'São Paulo': 'SP',
      'Paraná': 'PR', 'Rio Grande do Sul': 'RS', 'Santa Catarina': 'SC',
      'Distrito Federal': 'DF', 'Goiás': 'GO', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS'
    };
    return nameMap[name] || name;
  };

  // Filtrar features do GeoJSON baseado no zoom
  const filteredFeatures = useMemo(() => {
    if (!geoJsonData || !geoJsonData.features) return [];

    if (mapZoom < 5) {
      // Zoom baixo: mostrar por região (agrupar estados da mesma região)
      const regiaoMap = new Map<string, any[]>();
      geoJsonData.features.forEach((feature: any) => {
        const regiao = feature.properties?.regiao ||
          getRegiaoByUF(feature.properties?.sigla || feature.properties?.uf || getUFByName(feature.properties?.name || ''));
        if (regiao) {
          if (!regiaoMap.has(regiao)) {
            regiaoMap.set(regiao, []);
          }
          regiaoMap.get(regiao)!.push(feature);
        }
      });

      // Criar features agrupadas por região
      return Array.from(regiaoMap.entries()).map(([regiao, features]) => {
        const regiaoData = dataByRegiao.get(regiao);
        const porcentagem = regiaoData && regiaoData.total > 0
          ? Math.round((regiaoData.pegos / regiaoData.total) * 100)
          : 0;

        // Combinar geometrias dos estados da região em MultiPolygon
        const coordinates: number[][][][] = [];
        features.forEach((f: any) => {
          if (f.geometry.type === 'Polygon') {
            coordinates.push(f.geometry.coordinates as number[][][]);
          } else if (f.geometry.type === 'MultiPolygon') {
            coordinates.push(...(f.geometry.coordinates as number[][][][]));
          }
        });

        return {
          type: "Feature",
          properties: {
            name: regiao,
            regiao: regiao,
            uf: '',
            contatosTotal: regiaoData?.total || 0,
            contatosPegos: regiaoData?.pegos || 0,
            porcentagem: porcentagem
          },
          geometry: {
            type: "MultiPolygon" as const,
            coordinates: coordinates
          }
        };
      });
    } else {
      // Zoom médio/alto: mostrar por estado individual
      return geoJsonData.features.map((feature: any) => {
        const uf = feature.properties?.uf ||
          feature.properties?.sigla ||
          getUFByName(feature.properties?.name || '');
        const estadoData = dataByUF.get(uf);

        return {
          ...feature,
          properties: {
            ...feature.properties,
            uf: uf,
            contatosTotal: estadoData?.contatosTotal || 0,
            contatosPegos: estadoData?.contatosPegos || 0,
            porcentagem: estadoData?.porcentagem || 0
          }
        };
      });
    }
  }, [mapZoom, dataByUF, dataByRegiao, geoJsonData]);

  // Função para calcular o centro de uma feature usando Leaflet
  const getFeatureCenter = (feature: any): [number, number] => {
    if (!feature.geometry) {
      // Se não tiver geometria, usar coordenadas padrão do Brasil
      return [-14.2350, -51.9253];
    }

    try {
      // Usar Leaflet para calcular o centro
      const layer = L.geoJSON(feature as any);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        const center = bounds.getCenter();
        return [center.lat, center.lng];
      }
    } catch (e) {
      // Se falhar, usar método alternativo
    }

    // Método alternativo: calcular manualmente
    let lats: number[] = [];
    let lngs: number[] = [];

    const extractCoords = (coords: any) => {
      if (!Array.isArray(coords)) return;

      if (Array.isArray(coords[0])) {
        // É um array aninhado
        coords.forEach((coord: any) => {
          extractCoords(coord);
        });
      } else if (coords.length >= 2 && typeof coords[0] === 'number') {
        // É uma coordenada [lng, lat]
        lngs.push(coords[0]);
        lats.push(coords[1]);
      }
    };

    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates.forEach(extractCoords);
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach((polygon: any) => {
        if (Array.isArray(polygon)) {
          polygon.forEach(extractCoords);
        }
      });
    }

    if (lats.length === 0 || lngs.length === 0) {
      // Fallback: usar coordenadas conhecidas por UF se disponível
      const uf = feature.properties?.uf || feature.properties?.sigla;
      if (uf) {
        const coords = getCoordinatesByUF(uf);
        return [coords.lat, coords.lng];
      }
      return [-14.2350, -51.9253];
    }

    const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    return [avgLat, avgLng];
  };

  return (
    <>
      {filteredFeatures.map((feature, index) => {
        const props = feature.properties;
        const porcentagem = props.porcentagem || 0;
        const center = getFeatureCenter(feature);

        // Debug: log para verificar se os dados estão corretos
        if (index === 0) {
          console.log('Feature sample:', {
            name: props.name || props.estado || props.regiao,
            porcentagem,
            center,
            contatosTotal: props.contatosTotal,
            contatosPegos: props.contatosPegos
          });
        }

        // Criar um ícone customizado para mostrar a porcentagem
        const percentageIcon = L.divIcon({
          className: 'percentage-label',
          html: `
            <div style="
              background: rgba(255, 255, 255, 0.98) !important;
              border: 3px solid ${getColorByPercentage(porcentagem)} !important;
              border-radius: 10px !important;
              padding: 6px 12px !important;
              font-weight: bold !important;
              font-size: 16px !important;
              font-family: Arial, sans-serif !important;
              color: ${getColorByPercentage(porcentagem)} !important;
              box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
              white-space: nowrap !important;
              text-align: center !important;
              min-width: 60px !important;
              display: block !important;
              position: relative !important;
              z-index: 10000 !important;
              pointer-events: none !important;
            ">
              ${porcentagem}%
            </div>
          `,
          iconSize: [70, 35],
          iconAnchor: [35, 17.5],
          popupAnchor: [0, -17.5],
        });

        return (
          <>
            <GeoJSON
              key={`${props.uf || props.regiao}-${index}`}
              data={feature as any}
              style={() => ({
                fillColor: getColorByRegiao(props.regiao || 'Outros'),
                fillOpacity: 0.6,
                color: '#fff',
                weight: 1.5,
                opacity: 0.9
              })}
              eventHandlers={{
                mouseover: (e) => {
                  const layer = e.target;
                  const regiao = props.regiao || 'Outros';
                  layer.setStyle({
                    fillColor: getColorByRegiao(regiao),
                    fillOpacity: 0.8,
                    weight: 2.5,
                    color: '#fff'
                  });
                },
                mouseout: (e) => {
                  const layer = e.target;
                  const props = layer.feature?.properties;
                  if (props) {
                    const regiao = props.regiao || 'Outros';
                    layer.setStyle({
                      fillColor: getColorByRegiao(regiao),
                      fillOpacity: 0.6,
                      weight: 1.5,
                      color: '#fff'
                    });
                  }
                }
              }}
            >
              <Tooltip>
                <div className="p-2 max-w-xs">
                  {/* Legenda - No topo */}
                  <div className="mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Legenda:</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: getColorByPercentage(85) }}></div>
                        <span className="text-xs text-slate-600 dark:text-slate-400">≥ 80% (Excelente)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: getColorByPercentage(75) }}></div>
                        <span className="text-xs text-slate-600 dark:text-slate-400">70-79% (Bom)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: getColorByPercentage(65) }}></div>
                        <span className="text-xs text-slate-600 dark:text-slate-400">60-69% (Regular)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: getColorByPercentage(55) }}></div>
                        <span className="text-xs text-slate-600 dark:text-slate-400">50-59% (Ruim)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: getColorByPercentage(45) }}></div>
                        <span className="text-xs text-slate-600 dark:text-slate-400">&lt; 50% (Muito Ruim)</span>
                      </div>
                    </div>
                  </div>
                  {/* Informações da região */}
                  <div className="font-bold text-sm mb-2">
                    {props.name || props.estado || props.regiao}
                  </div>
                  <div className="text-xs mt-1 space-y-1">
                    <div className="font-semibold">
                      {props.contatosPegos || 0} de {props.contatosTotal || 0} contatos
                    </div>
                    <div className="text-muted-foreground">
                      Total: {props.contatosTotal || 0} | Pegos: {props.contatosPegos || 0} | Faltantes: {(props.contatosTotal || 0) - (props.contatosPegos || 0)}
                    </div>
                    <div className="font-semibold mt-1 text-primary">
                      Taxa: {porcentagem}%
                    </div>
                  </div>
                </div>
              </Tooltip>
            </GeoJSON>
            {/* Marker com porcentagem sobre o mapa */}
            {porcentagem >= 0 && (
              <Marker
                key={`label-${props.uf || props.regiao}-${index}`}
                position={center}
                icon={percentageIcon}
                interactive={false}
                zIndexOffset={1000}
              />
            )}
          </>
        );
      })}
    </>
  );
}

export default function MapaContatos() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contatosIndividuais, setContatosIndividuais] = useState<ContatoIndividual[]>([]);
  const [dadosContatos, setDadosContatos] = useState<ContatoData[]>(dadosContatosInicial);
  const [selectedContatos, setSelectedContatos] = useState<Set<string | number>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log('Dados importados:', jsonData);

      // Limpar lista atual
      const novosContatos: ContatoIndividual[] = [];
      const novosSelecionados = new Set<string | number>();

      // Função auxiliar para normalizar texto (remover acentos e lowercase)
      const normalizeText = (text: string) => {
        return text
          ? text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
          : "";
      };

      // Mapeamento de nomes de estado para UF
      const getUfFromEstado = (estadoNome: string) => {
        const map: Record<string, string> = {
          'acre': 'AC', 'alagoas': 'AL', 'amazonas': 'AM', 'amapa': 'AP', 'bahia': 'BA', 'ceara': 'CE',
          'distrito federal': 'DF', 'espirito santo': 'ES', 'goias': 'GO', 'maranhao': 'MA',
          'minas gerais': 'MG', 'mato grosso do sul': 'MS', 'mato grosso': 'MT', 'para': 'PA',
          'paraiba': 'PB', 'pernambuco': 'PE', 'piaui': 'PI', 'parana': 'PR', 'rio de janeiro': 'RJ',
          'rio grande do norte': 'RN', 'rondonia': 'RO', 'roraima': 'RR', 'rio grande do sul': 'RS',
          'santa catarina': 'SC', 'sergipe': 'SE', 'sao paulo': 'SP', 'tocantins': 'TO'
        };
        return map[normalizeText(estadoNome)] || estadoNome.substring(0, 2).toUpperCase();
      };

      for (const [index, row] of (jsonData as any[]).entries()) {
        const normalizedRow: any = {};
        // Normalizar chaves E filtrar valores vazios/nulos
        Object.keys(row).forEach(key => {
          const val = row[key];
          if (val !== null && val !== undefined && val !== '') {
            normalizedRow[key.toLowerCase().trim()] = val;
          }
        });

        // Validação preliminar: Se a linha não tem info mínima, pular
        // Isso evita que linhas vazias no Excel contem como "Faltantes"
        const hasInfo = normalizedRow['distribuidora'] || normalizedRow['cia'] ||
          normalizedRow['bandeira'] || normalizedRow['fornecedor'] ||
          normalizedRow['nom_razao_social'] || normalizedRow['razao_social'] ||
          normalizedRow['uf'] || normalizedRow['sig_uf'] ||
          normalizedRow['cidade'] || normalizedRow['municipio'];

        if (!hasInfo) continue;

        // Identificar campos principais
        const distribuidora = normalizedRow['distribuidora'] || normalizedRow['cia'] ||
          normalizedRow['bandeira'] || normalizedRow['fornecedor'] ||
          normalizedRow['nom_razao_social'] || normalizedRow['razao_social'] ||
          `Distribuidora ${index + 1}`;

        const cidade = normalizedRow['cidade'] || normalizedRow['municipio'] ||
          normalizedRow['nom_localidade'] || normalizedRow['localidade'] ||
          "Desconhecida";

        let uf = normalizedRow['uf'] || normalizedRow['estado'] ||
          normalizedRow['sig_uf'] || normalizedRow['unidade_federativa'] ||
          "";

        if (uf.length > 2) uf = getUfFromEstado(uf);
        uf = uf.toUpperCase().trim();

        const base = normalizedRow['base'] || "";

        // Identificar se mapeado - Lógica Ajustada (Foco na coluna MAPEADO)
        let isMapeado = false;

        // 1. Prioridade absoluta para a coluna 'mapeado'
        if (normalizedRow['mapeado'] !== undefined) {
          const val = String(normalizedRow['mapeado']).toLowerCase().trim();
          isMapeado = ['sim', 's', 'yes', 'y', 'ok', 'ativo', 'true', 'verdadeiro', 'mapped'].includes(val);
        }
        // 2. Se não existir a coluna 'mapeado', tentar outras colunas de status, MAS IGNORANDO 'operacao'
        else {
          const mapCols = ['status', 'situacao', 'ativo']; // Removido 'operacao'
          for (const col of mapCols) {
            if (normalizedRow[col]) {
              const val = String(normalizedRow[col]).toLowerCase().trim();
              if (['sim', 's', 'yes', 'y', 'ok', 'ativo', 'true', 'verdadeiro', 'mapped'].includes(val)) {
                isMapeado = true;
                break;
              }
            }
          }

          // 3. Fallback genérico: varrer valores mas excluir explicitamente a coluna 'operacao'
          if (!isMapeado) {
            isMapeado = Object.keys(normalizedRow).some(key => {
              if (key.includes('operacao') || key.includes('operation')) return false; // Ignorar coluna operação

              const val = normalizedRow[key];
              const strVal = String(val).toLowerCase().trim();
              return ['sim', 's', 'yes', 'y', 'ok', 'ativo', 'mapeado', 'true'].includes(strVal);
            });
          }
        }

        // Debug específico para TO se necessário
        // if (uf === 'TO') console.log('Row TO:', { distribuidora, isMapeado, row });

        // Região
        const regiao = getRegiaoByUF(uf);

        // ID único (baseado nos dados para consistência, ou index se falhar)
        // Usar um hash simples das string para tentar manter consistência entre imports se os dados forem iguais
        const idContent = `${distribuidora}-${cidade}-${uf}-${base}-${index}`;
        const id = `import-${index}`; // Simplificado para garantir unicidade na sessão

        if (isMapeado) {
          novosSelecionados.add(id);
        }

        novosContatos.push({
          id,
          regiao,
          uf,
          estado: uf,
          cidade,
          base,
          distribuidora,
          status: isMapeado ? 'pego' : 'faltante',
          pego: isMapeado,
          ...row
        });
      }

      console.log(`Importados ${novosContatos.length} novos contatos.`);

      // Atualizar estado
      setContatosIndividuais(novosContatos);
      setSelectedContatos(novosSelecionados);

      // Recalcular agregação para o mapa
      const contatosAgrupados = new Map();
      novosContatos.forEach(contato => {
        // Por UF/Estado
        const keyEstado = `${contato.regiao}-${contato.uf}`;
        const estadoData = contatosAgrupados.get(keyEstado) || { total: 0, pegos: 0, uf: contato.uf, estado: contato.estado, regiao: contato.regiao };
        estadoData.total += 1;
        if (contato.pego) estadoData.pegos += 1;
        contatosAgrupados.set(keyEstado, estadoData);

        // Por Cidade
        if (contato.cidade && contato.cidade !== "Desconhecida") {
          const keyCidade = `${contato.regiao}-${contato.uf}-${contato.cidade}`;
          const cidadeData = contatosAgrupados.get(keyCidade) || { total: 0, pegos: 0, uf: contato.uf, estado: contato.estado, cidade: contato.cidade, regiao: contato.regiao };
          cidadeData.total += 1;
          if (contato.pego) cidadeData.pegos += 1;
          contatosAgrupados.set(keyCidade, cidadeData);
        }
      });

      const dadosContatosProcessados: ContatoData[] = Array.from(contatosAgrupados.values()).map(item => {
        const coords = getCoordinatesByUF(item.uf);
        const porcentagem = item.total > 0 ? Math.round((item.pegos / item.total) * 100) : 0;
        return {
          regiao: item.regiao,
          uf: item.uf,
          estado: item.estado,
          cidade: item.cidade,
          contatosTotal: item.total,
          contatosPegos: item.pegos,
          porcentagem,
          lat: coords.lat, // Idealmente teríamos lat/lng da cidade, mas UF serve por enquanto
          lng: coords.lng
        };
      });

      setDadosContatos(dadosContatosProcessados);

      // SALVAR NO BANCO DE DADOS (SUPABASE)
      try {
        toast({
          title: 'Sincronizando...',
          description: 'Salvando dados no banco de dados...',
        });

        // 1. Buscar dados existentes para tentar manter IDs e evitar duplicatas
        // (Assumindo que não há chave única composta no banco, precisamos fazer match manual)
        const { data: existingData, error: fetchError } = await supabase
          .from('Contatos' as any)
          .select('id, distribuidora, cidade, uf, base');

        if (fetchError) throw fetchError;

        const dbMap = new Map<string, any>();
        existingData?.forEach((item: any) => {
          const key = `${normalizeText(item.distribuidora)}-${normalizeText(item.cidade)}-${normalizeText(item.uf)}`;
          dbMap.set(key, item);
        });

        // 2. Preparar dados para Upsert
        const upsertBatch = novosContatos.map(contato => {
          const key = `${normalizeText(contato.distribuidora)}-${normalizeText(contato.cidade)}-${normalizeText(contato.uf)}`;
          const existing = dbMap.get(key);

          // Payload para o banco
          return {
            // Se existir, usa o ID do banco. Se não, deixa undefined para o banco gerar (ou usa o ID gerado se for UUID válido, mas aqui estamos usando random string no frontend, melhor deixar banco gerar se for insert)
            id: existing?.id || contato.id, // Usar ID gerado (import-N) se não existir
            distribuidora: contato.distribuidora,
            cidade: contato.cidade,
            uf: contato.uf,
            estado: contato.estado,
            base: contato.base,
            pego: contato.pego,
            status: contato.pego ? 'pego' : 'faltante',
            regiao: contato.regiao, // Campo importante para filtros
            updated_at: new Date().toISOString()
          };
        });

        // 3. Enviar em lotes (Supabase tem limites de payload)
        const BATCH_SIZE = 100;
        let successCount = 0;
        let insertCount = 0;
        let updateCount = 0;

        for (let i = 0; i < upsertBatch.length; i += BATCH_SIZE) {
          const batch = upsertBatch.slice(i, i + BATCH_SIZE);

          const { data, error: upsertError } = await supabase
            .from('Contatos' as any)
            .upsert(batch, { onConflict: 'id' }) // Usa ID para conflito (update). Sem ID, faz insert.
            .select();

          if (upsertError) {
            console.error('Erro no lote', i, upsertError);
          } else {
            successCount += batch.length;
            // Estimativa simples
            batch.forEach(b => b.id ? updateCount++ : insertCount++);
          }
        }

        toast({
          title: 'Sincronização Concluída',
          description: `${successCount} registros processados (${updateCount} atualizados, ${insertCount} novos).`,
        });

      } catch (dbError: any) {
        console.error('Erro ao salvar no banco:', dbError);
        toast({
          title: 'Erro ao Salvar',
          description: `Os dados estão visíveis mas não foram salvos: ${dbError.message}`,
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: 'Erro na importação',
        description: 'Falha ao processar o arquivo Excel.',
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Carregar contatos do banco de dados
  useEffect(() => {
    async function loadContatos() {
      setLoading(true);
      try {
        let contatosData: any[] = [];
        let error: any = null;

        try {
          console.log('🔍 Iniciando carregamento de contatos do banco...');

          // Usar função RPC para buscar contatos do schema cotacao
          console.log('🔍 Buscando contatos via RPC get_contatos...');

          try {
            // Tentar chamar a função RPC (sem passar objeto vazio, pois a função não tem parâmetros)
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryResult = await supabase.rpc('get_contatos' as any);
            if (!retryResult.error) {
              contatosData = retryResult.data || [];
              error = null;
              console.log('✅ Função encontrada na segunda tentativa!');
            } else {
              error = retryResult.error;
            }
          } catch (retryErr) {
            console.error('Erro no retry:', retryErr);
          }

          if (error) {
            console.error('❌ Erro ao carregar contatos:', error);
            console.error('Código do erro:', error.code);
            console.error('Mensagem:', error.message);
            console.error('Detalhes:', error.details);
            console.error('Hint:', error.hint);

            // Se for erro de função não encontrada, tentar recarregar a página após um delay
            const errorMessage = error.message || '';
            const isFunctionNotFound = errorMessage.includes('Could not find the function') ||
              errorMessage.includes('function') && errorMessage.includes('not found') ||
              errorMessage.includes('does not exist') ||
              error.code === '42883';

            if (isFunctionNotFound) {
              toast({
                title: 'Função RPC não encontrada',
                description: `A função get_contatos() existe no banco mas não está acessível. Erro: ${errorMessage}. Tente recarregar a página ou verifique as permissões.`,
                variant: 'destructive',
              });
            } else {
              toast({
                title: 'Erro ao carregar contatos',
                description: `${errorMessage || 'Erro desconhecido'}. Código: ${error.code || 'N/A'}`,
                variant: 'destructive',
              });
            }
            // Manter arrays vazios mas permitir renderização
            setContatosIndividuais([]);
            setDadosContatos([]);
            setSelectedContatos(new Set());
            setLoading(false);
            return;
          }
        } catch (e: any) {
          console.error('❌ Exceção ao chamar RPC:', e);
          error = e;
          toast({
            title: 'Erro ao carregar contatos',
            description: `Exceção: ${e.message || 'Erro desconhecido'}`,
            variant: 'destructive',
          });
          setContatosIndividuais([]);
          setDadosContatos([]);
          setSelectedContatos(new Set());
          setLoading(false);
          return;
        }

        if (!contatosData || contatosData.length === 0) {
          console.warn('⚠️ Nenhum contato encontrado');
          // Não mostrar toast, apenas usar arrays vazios
          setContatosIndividuais([]);
          setDadosContatos([]);
          setSelectedContatos(new Set());
          setLoading(false);
          return;
        }

        console.log(`✅ ${contatosData.length} contatos carregados do banco`);

        // Processar contatos do banco
        const contatosProcessados: ContatoIndividual[] = contatosData.map((contato: any, index: number) => {
          const uf = (contato.uf || contato.UF || contato.estado_uf || '').toString().toUpperCase();
          const regiao = getRegiaoByUF(uf);
          const estado = contato.estado || contato.Estado || contato.nome_estado || '';
          const cidade = contato.cidade || contato.Cidade || contato.nome_cidade || '';
          const base = contato.base || contato.Base || contato.nome_base || '';
          const distribuidora = contato.distribuidora || contato.Distribuidora || contato.nome_distribuidora || '';

          // Verificar se o contato foi pego (pode ser um campo boolean ou status)
          const pego = contato.pego || contato.Pego || contato.status === 'pego' || contato.status_contato === 'pego' || false;
          // Gerar ID único baseado nas informações do contato
          const id = `${uf}-${cidade}-${distribuidora}-${index}`.replace(/\s+/g, '-').toLowerCase();

          return {
            id,
            regiao,
            uf,
            estado,
            cidade,
            base,
            distribuidora,
            status: pego ? 'pego' : 'faltante',
            pego,
            dataContato: contato.data_contato || contato.DataContato || contato.data,
            responsavel: contato.responsavel || contato.Responsavel || contato.responsavel_contato,
            ...contato
          };
        });

        setContatosIndividuais(contatosProcessados);

        // Agrupar contatos por região/estado/cidade para o mapa
        const contatosAgrupados = new Map();

        contatosProcessados.forEach(contato => {
          // Por estado
          const keyEstado = `${contato.regiao}-${contato.uf}-${contato.estado}`;
          const estadoData = contatosAgrupados.get(keyEstado) || { total: 0, pegos: 0, uf: contato.uf, estado: contato.estado, regiao: contato.regiao };
          estadoData.total += 1;
          if (contato.pego) estadoData.pegos += 1;
          contatosAgrupados.set(keyEstado, estadoData);

          // Por cidade (se houver)
          if (contato.cidade) {
            const keyCidade = `${contato.regiao}-${contato.uf}-${contato.estado}-${contato.cidade}`;
            const cidadeData = contatosAgrupados.get(keyCidade) || { total: 0, pegos: 0, uf: contato.uf, estado: contato.estado, cidade: contato.cidade, regiao: contato.regiao };
            cidadeData.total += 1;
            if (contato.pego) cidadeData.pegos += 1;
            contatosAgrupados.set(keyCidade, cidadeData);
          }
        });

        // Converter para formato ContatoData
        const dadosContatosProcessados = Array.from(contatosAgrupados.values()).map(item => {
          const coords = getCoordinatesByUF(item.uf);
          const porcentagem = item.total > 0 ? Math.round((item.pegos / item.total) * 100) : 0;

          return {
            regiao: item.regiao,
            uf: item.uf,
            estado: item.estado,
            cidade: item.cidade,
            contatosTotal: item.total,
            contatosPegos: item.pegos,
            porcentagem,
            lat: coords.lat,
            lng: coords.lng
          };
        });

        setDadosContatos(dadosContatosProcessados);

        // Carregar contatos já selecionados (pegos)
        const idsPegos = contatosProcessados.filter(c => c.pego).map(c => c.id);
        const pegosIds = new Set(idsPegos);
        setSelectedContatos(pegosIds);

      } catch (e) {
        console.error('❌ Exceção ao carregar contatos:', e);
        setContatosIndividuais([]);
        setDadosContatos([]);
        setSelectedContatos(new Set());
      } finally {
        setLoading(false);
      }
    };

    loadContatos();
  }, [toast]);

  // Função para marcar/desmarcar contato como pego
  const toggleContatoPego = async (contatoId: string | number) => {
    try {
      const novoStatus = !selectedContatos.has(contatoId);

      // Usar função RPC para atualizar (se existir)
      let updateSuccess = false;
      let error: any = null;

      try {
        const { error: rpcError } = await supabase.rpc('update_contato_pego' as any, {
          p_id: contatoId,
          p_pego: novoStatus
        });

        if (!rpcError) {
          updateSuccess = true;
        } else {
          error = rpcError;
        }
      } catch (e) {
        // Se RPC não existir, tentar tabela pública
        try {
          const { error: publicError } = await supabase
            .from('Contatos' as any)
            .update({ pego: novoStatus } as any)
            .eq('id', contatoId);

          if (!publicError) {
            updateSuccess = true;
          } else {
            error = publicError;
          }
        } catch (e2) {
          error = e2;
        }
      }

      // Atualizar estado local
      const novosSelecionados = new Set(selectedContatos);
      if (novoStatus) {
        novosSelecionados.add(contatoId);
      } else {
        novosSelecionados.delete(contatoId);
      }
      setSelectedContatos(novosSelecionados);

      // Atualizar contato na lista e recalcular dados do mapa
      setContatosIndividuais(prev => {
        const contatosAtualizados = prev.map(c =>
          c.id === contatoId ? { ...c, pego: novoStatus, status: novoStatus ? 'pego' : 'faltante' } : c
        );

        // Recalcular dados do mapa com os contatos atualizados
        const contatosAgrupados = new Map<string, { total: number; pegos: number; uf: string; estado: string; cidade?: string; regiao: string }>();
        contatosAtualizados.forEach(contato => {
          const keyEstado = `${contato.regiao}-${contato.uf}-${contato.estado}`;
          const estadoData = contatosAgrupados.get(keyEstado) || { total: 0, pegos: 0, uf: contato.uf, estado: contato.estado, regiao: contato.regiao };
          estadoData.total += 1;
          if (contato.pego) estadoData.pegos += 1;
          contatosAgrupados.set(keyEstado, estadoData);

          if (contato.cidade) {
            const keyCidade = `${contato.regiao}-${contato.uf}-${contato.estado}-${contato.cidade}`;
            const cidadeData = contatosAgrupados.get(keyCidade) || { total: 0, pegos: 0, uf: contato.uf, estado: contato.estado, cidade: contato.cidade, regiao: contato.regiao };
            cidadeData.total += 1;
            if (contato.pego) cidadeData.pegos += 1;
            contatosAgrupados.set(keyCidade, cidadeData);
          }
        });

        const dadosContatosAtualizados: ContatoData[] = Array.from(contatosAgrupados.values()).map(item => {
          const coords = getCoordinatesByUF(item.uf);
          const porcentagem = item.total > 0 ? Math.round((item.pegos / item.total) * 100) : 0;
          return {
            regiao: item.regiao,
            uf: item.uf,
            estado: item.estado,
            cidade: item.cidade,
            contatosTotal: item.total,
            contatosPegos: item.pegos,
            porcentagem,
            lat: coords.lat,
            lng: coords.lng
          };
        });

        setDadosContatos(dadosContatosAtualizados);

        return contatosAtualizados as any;
      });


      if (updateSuccess) {
        toast({
          title: 'Sucesso',
          description: `Contato ${novoStatus ? 'marcado como pego' : 'desmarcado'}.`,
        });
      } else {
        // Ainda atualizar localmente para melhor UX
        toast({
          title: 'Aviso',
          description: `Contato ${novoStatus ? 'marcado' : 'desmarcado'} localmente, mas pode não ter sido salvo no banco.`,
          variant: 'default',
        });
      }

    } catch (error) {
      console.error('Erro ao atualizar contato:', error);
      // Ainda atualizar o estado local para melhor UX
      const isPegoCatch = selectedContatos.has(contatoId);
      const novoStatusCatch = !isPegoCatch;
      const novosSelecionados = new Set(selectedContatos);
      if (novoStatusCatch) {
        novosSelecionados.add(contatoId);
      } else {
        novosSelecionados.delete(contatoId);
      }
      setSelectedContatos(novosSelecionados);
      setContatosIndividuais(prev => prev.map(c =>
        c.id === contatoId ? { ...c, pego: novoStatusCatch, status: novoStatusCatch ? 'pego' : 'faltante' } : c
      ));

      toast({
        title: 'Erro',
        description: 'Erro ao atualizar o contato no banco, mas a mudança foi aplicada localmente.',
        variant: 'destructive',
      });
    }
  };

  // Calcular estatísticas gerais
  const stats = useMemo(() => {
    const total = dadosContatos.reduce((sum, item) => sum + item.contatosTotal, 0);
    const pegos = dadosContatos.reduce((sum, item) => sum + item.contatosPegos, 0);
    const porcentagemGeral = total > 0 ? Math.round((pegos / total) * 100) : 0;

    // Por região
    const porRegiao = dadosContatos.reduce((acc, item) => {
      if (!acc[item.regiao]) {
        acc[item.regiao] = { total: 0, pegos: 0 };
      }
      acc[item.regiao].total += item.contatosTotal;
      acc[item.regiao].pegos += item.contatosPegos;
      return acc;
    }, {} as Record<string, { total: number; pegos: number }>);

    return {
      total,
      pegos,
      porcentagemGeral,
      porRegiao
    };
  }, [dadosContatos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando contatos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-4 sm:p-6 text-white shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MapPin className="h-6 w-6" />
                Mapa de Contatos
              </h1>
              <p className="text-white/80 mt-1">
                Visualização da porcentagem de contatos pegos por região
              </p>

              <div className="flex gap-2 mt-4">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Importar Planilha
                </Button>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardContent className="p-3">
                  <div className="text-xs text-white/70">Total de Contatos</div>
                  <div className="text-xl font-bold text-white">{stats.total.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardContent className="p-3">
                  <div className="text-xs text-white/70">Contatos Pegos</div>
                  <div className="text-xl font-bold text-white">{stats.pegos.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardContent className="p-3">
                  <div className="text-xs text-white/70">Taxa Geral</div>
                  <div className="text-xl font-bold text-white">{stats.porcentagemGeral}%</div>
                </CardContent>
              </Card>
              <Card className="bg-red-500/20 backdrop-blur-sm border-red-500/30">
                <CardContent className="p-3">
                  <div className="text-xs text-white/70">Contatos Faltantes</div>
                  <div className="text-xl font-bold text-white">{(stats.total - stats.pegos).toLocaleString()}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Estatísticas por Região */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Object.entries(stats.porRegiao).map(([regiao, dados]) => {
            const porcentagem = dados.total > 0 ? Math.round((dados.pegos / dados.total) * 100) : 0;
            const faltantes = dados.total - dados.pegos;
            return (
              <Card key={regiao} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{regiao}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: getColorByPercentage(porcentagem) }}>
                        {porcentagem}%
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {dados.pegos.toLocaleString()} de {dados.total.toLocaleString()}
                      </div>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-semibold">{dados.total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-600 dark:text-green-400">Pegos:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">{dados.pegos.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-600 dark:text-red-400">Faltantes:</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">{faltantes.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${porcentagem}%`,
                            backgroundColor: getColorByPercentage(porcentagem)
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Mapa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Mapa Interativo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[600px] w-full rounded-lg overflow-hidden relative z-0">
              <style>{`
                .percentage-label {
                  background: transparent !important;
                  border: none !important;
                  box-shadow: none !important;
                }
                .percentage-label div {
                  pointer-events: none !important;
                  z-index: 10000 !important;
                  position: relative !important;
                }
                .leaflet-marker-icon.percentage-label {
                  z-index: 10000 !important;
                  position: absolute !important;
                }
                .leaflet-marker-pane {
                  z-index: 600 !important;
                }
                .leaflet-overlay-pane {
                  z-index: 400 !important;
                }
              `}</style>
              <MapContainer
                center={[-14.2350, -51.9253]}
                zoom={4}
                style={{ height: '100%', width: '100%', zIndex: 1 }}
                scrollWheelZoom={true}
                minZoom={3}
                maxZoom={10}
                maxBounds={[[-35.0, -75.0], [5.0, -30.0]]}
                maxBoundsViscosity={1.0}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RegionLayer data={dadosContatos} />
              </MapContainer>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                <strong>Instruções:</strong> Dê zoom no mapa para ver mais detalhes:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Zoom mínimo: Visualização por região</li>
                <li>Zoom médio: Visualização por estado</li>
                <li>Zoom máximo: Visualização por cidade</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Contatos Faltantes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Contatos Faltantes por Região/Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Região</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pegos</TableHead>
                    <TableHead className="text-right">Faltantes</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosContatos
                    .filter(item => !item.cidade) // Apenas estados, não cidades
                    .sort((a, b) => {
                      // Ordenar por número de faltantes (maior primeiro)
                      const faltantesA = a.contatosTotal - a.contatosPegos;
                      const faltantesB = b.contatosTotal - b.contatosPegos;
                      return faltantesB - faltantesA;
                    })
                    .map((item) => {
                      const faltantes = item.contatosTotal - item.contatosPegos;
                      const porcentagem = item.contatosTotal > 0
                        ? Math.round((item.contatosPegos / item.contatosTotal) * 100)
                        : 0;

                      return (
                        <TableRow key={`${item.uf}-${item.estado}`}>
                          <TableCell className="font-medium">{item.regiao}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{item.estado}</span>
                              <Badge variant="outline" className="text-xs">
                                {item.uf}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.contatosTotal.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-green-600 dark:text-green-400">
                            {item.contatosPegos.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-bold ${faltantes > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {faltantes.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className="font-semibold"
                              style={{
                                borderColor: getColorByPercentage(porcentagem),
                                color: getColorByPercentage(porcentagem)
                              }}
                            >
                              {porcentagem}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: getColorByPercentage(porcentagem) }}
                              />
                              <span className="text-xs text-muted-foreground">
                                {porcentagem >= 80 ? 'Excelente' :
                                  porcentagem >= 70 ? 'Bom' :
                                    porcentagem >= 60 ? 'Regular' :
                                      porcentagem >= 50 ? 'Ruim' : 'Muito Ruim'}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>

            {/* Resumo de Faltantes */}
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                <h3 className="font-semibold text-red-900 dark:text-red-100">
                  Resumo de Contatos Faltantes
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {Object.entries(stats.porRegiao).map(([regiao, dados]) => {
                  const faltantes = dados.total - dados.pegos;
                  const porcentagem = dados.total > 0
                    ? Math.round((dados.pegos / dados.total) * 100)
                    : 0;

                  return (
                    <div key={regiao} className="space-y-1">
                      <div className="font-medium text-red-800 dark:text-red-200">{regiao}</div>
                      <div className="text-red-600 dark:text-red-400 font-bold">
                        {faltantes.toLocaleString()} faltantes
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {porcentagem}% de cobertura
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista Detalhada de Contatos - Com Seleção */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Lista de Contatos - Selecione os que já foram pegos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-sm text-muted-foreground">
              Marque os contatos que você já possui. Os dados são atualizados automaticamente no mapa.
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Selecionar</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Distribuidora</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contatosIndividuais.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
                        <p>Carregando contatos...</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    contatosIndividuais.map((contato) => {
                      const isPego = selectedContatos.has(contato.id);
                      return (
                        <TableRow key={contato.id} className={isPego ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={isPego}
                              onCheckedChange={() => toggleContatoPego(contato.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {contato.regiao}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{contato.estado}</span>
                              <Badge variant="secondary" className="text-xs">
                                {contato.uf}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{contato.cidade || '-'}</TableCell>
                          <TableCell>
                            {contato.base ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{contato.base}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {contato.distribuidora ? (
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{contato.distribuidora}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={isPego ? "default" : "destructive"}
                              className={`text-xs ${isPego ? 'bg-green-600' : ''}`}
                            >
                              {isPego ? 'Pego' : 'Faltante'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {contatosIndividuais.length > 0 && contatosIndividuais.filter(c => c.status === 'faltante').length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>Todos os contatos foram marcados como pegos!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

