import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Building2, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SisEmpresa {
  id_empresa?: string | number;
  nome_empresa: string;
  cnpj_cpf: string;
  bandeira?: string;
  rede?: string;
  latitude?: number;
  longitude?: number;
  registro_ativo?: string;
  municipio?: string;
  uf?: string;
  raizen_code?: string;
  vibra_code?: string;
  ipp_code?: string;
}

interface SisEmpresaComboboxProps {
  label?: string;
  value?: string;
  onSelect: (empresaId: string, empresaName: string) => void;
  required?: boolean;
}

export const SisEmpresaCombobox = ({
  label = "Posto",
  value,
  onSelect,
  required = false
}: SisEmpresaComboboxProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [empresas, setEmpresas] = useState<SisEmpresa[]>([]);
  const [filteredEmpresas, setFilteredEmpresas] = useState<SisEmpresa[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<SisEmpresa | null>(null);

  // Load all empresas on mount
  useEffect(() => {
    loadEmpresas();
  }, []);

  // Load selected empresa if value is provided, or clear if value is empty
  useEffect(() => {
    if (!value || value === "") {
      // Se value for vazio, limpar seleção
      setSelectedEmpresa(null);
    } else if (value && empresas.length > 0) {
      const empresa = empresas.find(e =>
        String(e.id_empresa) === String(value) ||
        e.nome_empresa === value ||
        String(e.cnpj_cpf) === String(value)
      );
      if (empresa) {
        setSelectedEmpresa(empresa);
      } else {
        // Se não encontrou a empresa, limpar seleção
        setSelectedEmpresa(null);
      }
    }
  }, [value, empresas]);

  const loadEmpresas = async () => {
    setLoading(true);
    try {
      // Tentar nova função primeiro, depois fallback para a original
      let data = null;
      let error = null;

      const result = await supabase.rpc('get_sis_empresa_stations');
      data = result.data;
      error = result.error;

      if (error) throw error;

      // Log detalhado para debug
      if (data && data.length > 0) {
        console.log('📊 Empresas carregadas (primeiras 3):', data.slice(0, 3).map(e => ({
          id_empresa: e.id_empresa,
          cnpj_cpf: e.cnpj_cpf,
          nome_empresa: e.nome_empresa
        })));
      }

      setEmpresas(data || []);
    } catch (error) {
      console.error('Error loading sis_empresa:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter empresas based on search term
  useEffect(() => {
    if (searchTerm.length < 2) {
      setFilteredEmpresas([]);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = empresas.filter(empresa =>
      empresa.nome_empresa?.toLowerCase().includes(term) ||
      empresa.cnpj_cpf?.includes(term) ||
      empresa.municipio?.toLowerCase().includes(term) ||
      empresa.bandeira?.toLowerCase().includes(term) ||
      empresa.raizen_code?.toLowerCase().includes(term) ||
      empresa.vibra_code?.toLowerCase().includes(term) ||
      empresa.ipp_code?.toLowerCase().includes(term) ||
      empresa.rede?.toLowerCase().includes(term)
    ).slice(0, 10);

    setFilteredEmpresas(filtered);
    setIsOpen(filtered.length > 0);
  }, [searchTerm, empresas]);

  const handleSelect = (empresa: SisEmpresa) => {
    // Usar id_empresa para compatibilidade com tipos_pagamento
    const empresaId = String(empresa.id_empresa || empresa.cnpj_cpf || empresa.nome_empresa);

    console.log('🔄 SisEmpresaCombobox - Selecionou empresa:', {
      nome: empresa.nome_empresa,
      id_empresa: empresa.id_empresa,
      cnpj_cpf: empresa.cnpj_cpf,
      empresaId_selecionado: empresaId
    });

    setSelectedEmpresa(empresa);
    setSearchTerm("");
    setIsOpen(false);

    onSelect(empresaId, empresa.nome_empresa);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredEmpresas.length > 0) {
      e.preventDefault();
      handleSelect(filteredEmpresas[0]);
    }
  };

  const handleClear = () => {
    setSelectedEmpresa(null);
    setSearchTerm("");
    onSelect("", "");
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
        <Building2 className="w-3.5 h-3.5 text-blue-900 dark:text-blue-900" />
        {label} {required && <span className="text-red-500">*</span>}
      </Label>

      {/* Selected Empresa Display - Premium Card */}
      {selectedEmpresa ? (
        <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg group">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-900/40 rounded-md text-blue-600 dark:text-blue-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {selectedEmpresa.nome_empresa}
                </span>
                {selectedEmpresa.bandeira && (
                  <Badge variant="outline" className="bg-blue-600 text-white border-transparent text-[9px] h-4 px-1.5 font-bold uppercase tracking-tight">
                    {selectedEmpresa.bandeira}
                  </Badge>
                )}
              </div>
              {selectedEmpresa.cnpj_cpf && (
                <span className="text-[10px] text-slate-500 font-mono">
                  {selectedEmpresa.cnpj_cpf}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-7 w-7 text-slate-400 hover:text-red-500 rounded-md flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        /* Search Input */
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" />
            <Input
              placeholder="Buscar por nome, CNPJ, cidade, código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 pl-9 pr-9 text-sm"
              onFocus={() => setIsOpen(filteredEmpresas.length > 0)}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => {
                  setSearchTerm("");
                  setIsOpen(false);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Results Dropdown */}
          {isOpen && (
            <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-y-auto shadow-xl bg-background border-2">
              <CardContent className="p-2">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Carregando postos...
                  </div>
                ) : filteredEmpresas.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nenhum posto encontrado
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredEmpresas.map((empresa, index) => (
                      <div
                        key={`empresa-${index}`}
                        className="flex items-start gap-3 p-3 hover:bg-secondary/80 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-primary/20"
                        onClick={() => handleSelect(empresa)}
                      >
                        <Building2 className="h-5 w-5 text-blue-900 dark:text-blue-900 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="font-semibold text-sm">
                            {empresa.nome_empresa}
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            {empresa.bandeira && (
                              <Badge variant="secondary" className="text-xs">
                                {empresa.bandeira}
                              </Badge>
                            )}
                            {empresa.rede && (
                              <Badge variant="outline" className="text-xs">
                                {empresa.rede}
                              </Badge>
                            )}
                            {empresa.municipio && empresa.uf && (
                              <Badge variant="outline" className="text-xs">
                                <MapPin className="h-2.5 w-2.5 mr-1" />
                                {empresa.municipio} - {empresa.uf}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {empresa.raizen_code && (
                              <span>Raizen: {empresa.raizen_code}</span>
                            )}
                            {empresa.vibra_code && (
                              <span>Vibra: {empresa.vibra_code}</span>
                            )}
                            {empresa.ipp_code && (
                              <span>IPP: {empresa.ipp_code}</span>
                            )}
                          </div>
                          {empresa.cnpj_cpf && (
                            <p className="text-xs text-muted-foreground font-mono">
                              CNPJ: {empresa.cnpj_cpf}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Overlay to close dropdown */}
          {isOpen && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};
