import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { IntegraLogo } from "@/components/IntegraLogo";
import { SaoRoqueLogo } from "@/components/SaoRoqueLogo";
import { supabase } from "@/integrations/supabase/client";
import { formatNameFromEmail } from "@/lib/utils";
import { CheckCircle, Clock, DollarSign, Download } from "lucide-react";

// Componente para visualização completa da proposta comercial
export function ProposalFullView({ batch, proposalNumber, proposalDate, generalStatus, user }: any) {
  const firstRequest = batch[0];
  const client = firstRequest.clients;
  const [requesterName, setRequesterName] = useState<string>('N/A');

  // Buscar nome do solicitante
  useEffect(() => {
    const fetchRequesterName = async () => {
      const createdBy = firstRequest.created_by || firstRequest.requested_by;
      if (createdBy) {
        try {
          // Tentar buscar em user_profiles
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('nome, email')
            .eq('user_id', createdBy)
            .maybeSingle();

          if (profileData) {
            setRequesterName(formatNameFromEmail(profileData.nome || profileData.email || 'N/A'));
            return;
          }

          // Se não encontrou, tentar buscar por email
          if (createdBy.includes('@')) {
            const { data: emailProfileData } = await supabase
              .from('user_profiles')
              .select('nome, email')
              .eq('email', createdBy)
              .maybeSingle();

            if (emailProfileData) {
              setRequesterName(formatNameFromEmail(emailProfileData.nome || emailProfileData.email || 'N/A'));
              return;
            }
          }

          // Fallback: usar o valor direto se for email
          if (createdBy.includes('@')) {
            setRequesterName(formatNameFromEmail(createdBy));
          }
        } catch (error) {
          console.error('Erro ao buscar solicitante:', error);
          setRequesterName(formatNameFromEmail(createdBy?.includes('@') ? createdBy : 'N/A'));
        }
      }
    };

    fetchRequesterName();
  }, [firstRequest.created_by, firstRequest.requested_by]);

  // Formatação com 4 casas decimais para valores unitários (custo/L, preço/L)
  const formatPrice4Decimals = (price: number) => {
    if (typeof price !== 'number' || isNaN(price)) return 'R$ 0,0000';
    return price.toLocaleString('pt-BR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
      style: 'currency',
      currency: 'BRL'
    });
  };

  // Calcular totais
  const totalVolume = batch.reduce((sum: number, r: any) => {
    const volume = r.volume_projected || 0;
    return sum + (volume * 1000); // Converter m³ para litros
  }, 0);

  // Buscar informações do vendedor
  const sellerName = formatNameFromEmail(user?.email || user?.user_metadata?.name || 'Vendedor');

  return (
    <div className="p-6 print:p-2 print:min-h-0">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5cm;
          }
          body {
            margin: 0;
            padding: 0;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      {/* Cabeçalho com Logo */}
      <div className="flex items-center justify-between mb-6 print:mb-2 print:flex-row">
        <div className="flex items-center gap-3 print:gap-2">
          <SaoRoqueLogo className="h-12 w-auto print:h-6" />
        </div>
        <button
          onClick={() => {
            window.print();
          }}
          className="text-slate-600 hover:text-slate-700 print:hidden p-2 hover:bg-slate-100 rounded"
          title="Imprimir/PDF"
          type="button"
        >
          <Download className="h-5 w-5" />
        </button>
      </div>

      {/* Título Principal */}
      <div className="mb-6 print:mb-2">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2 uppercase print:text-lg print:mb-0 print:leading-tight">
          PROPOSTA COMERCIAL
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 print:text-[10px] print:mt-0">
          Detalhes da Oferta de Combustível
        </p>
      </div>

      {/* Informações Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 print:mb-2 print:gap-2 print:text-[10px]">
        <div className="space-y-2 print:space-y-1">
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">Data da Proposta:</Label>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 print:text-[10px] print:mt-0 print:font-normal">{proposalDate}</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">Cliente:</Label>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 print:text-[10px] print:mt-0 print:font-normal">{client?.name || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">CNPJ:</Label>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 print:text-[10px] print:mt-0 print:font-normal">{client?.code || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">Vendedor:</Label>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 print:text-[10px] print:mt-0 print:font-normal">{sellerName}</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">Quem Solicitou:</Label>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 print:text-[10px] print:mt-0 print:font-normal">{requesterName}</p>
          </div>
        </div>
        <div className="space-y-2 print:space-y-1">
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">Número da Proposta:</Label>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 print:text-[10px] print:mt-0 print:font-normal">#{proposalNumber}</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide print:text-[9px] print:font-normal">Status Geral:</Label>
            <div className="mt-1 print:mt-0">
              {generalStatus === 'approved' ? (
                <Badge className="bg-green-100 text-green-800 border-green-300 text-xs font-semibold px-3 py-1 print:text-[9px] print:px-1 print:py-0 print:font-normal">
                  Aprovado
                </Badge>
              ) : generalStatus === 'pending' ? (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs font-semibold px-3 py-1 print:text-[9px] print:px-1 print:py-0 print:font-normal">
                  Aguardando Aprovação
                </Badge>
              ) : generalStatus === 'price_suggested' ? (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs font-semibold px-3 py-1 print:text-[9px] print:px-1 print:py-0 print:font-normal flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Preço Sugerido
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 border-red-300 text-xs font-semibold px-3 py-1 print:text-[9px] print:px-1 print:py-0 print:font-normal">
                  Rejeitado
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Postos e Condições */}
      <div className="mb-6 print:mb-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 pb-1 border-b-2 border-slate-300 dark:border-slate-600 print:text-xs print:mb-1 print:pb-0.5 print:border-b print:font-semibold">
          Postos e Condições
        </h2>
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse print:text-[9px] print:table-fixed" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white print:bg-blue-600">
                <th className="text-left p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '18%' }}>POSTO</th>
                <th className="text-left p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '25%' }}>CLIENTE</th>
                <th className="text-left p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '12%' }}>PREÇO (R$/L)</th>
                <th className="text-left p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '10%' }}>VOLUME (M³)</th>
                <th className="text-left p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '12%' }}>STATUS</th>
                <th className="text-center p-3 text-sm font-bold uppercase tracking-wide print:p-1 print:text-[9px] print:font-semibold" style={{ width: '8%' }}>RESULTADO</th>
              </tr>
            </thead>
            <tbody>
              {batch.map((req: any, idx: number) => {
                const station = req.stations || req.stations_list?.[0];
                const reqClient = req.clients;
                const price = req.final_price || req.suggested_price || 0;
                const priceReais = price >= 100 ? price / 100 : price;
                const volume = req.volume_projected || 0;
                const reqStatus = req.status || 'pending';

                return (
                  <tr
                    key={req.id}
                    className={`border-b border-slate-200 dark:border-border print:border-gray-300 print:border-t-0 ${idx % 2 === 0 ? 'bg-white dark:bg-card print:bg-white' : 'bg-slate-50 dark:bg-secondary/30 print:bg-gray-50'}`}
                  >
                    <td className="p-3 text-sm font-semibold text-slate-900 dark:text-slate-100 print:p-1 print:text-[9px] print:font-normal print:break-words">
                      {station?.name || req.station_id || 'N/A'}
                    </td>
                    <td className="p-3 text-sm text-slate-700 dark:text-slate-300 print:p-1 print:text-[9px] print:break-words">
                      {reqClient?.name || 'N/A'}
                    </td>
                    <td className="p-3 text-sm font-semibold text-slate-900 dark:text-slate-100 print:p-1 print:text-[9px] print:font-normal">
                      {formatPrice4Decimals(priceReais)}
                    </td>
                    <td className="p-3 text-sm text-slate-700 dark:text-slate-300 print:p-1 print:text-[9px]">
                      {volume.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 print:p-1">
                      {reqStatus === 'approved' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300 text-xs font-semibold print:text-[8px] print:px-0.5 print:py-0 print:font-normal print:inline-block">
                          Aprovado
                        </Badge>
                      ) : reqStatus === 'pending' ? (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs font-semibold print:text-[8px] print:px-0.5 print:py-0 print:font-normal print:inline-block">
                          Pendente
                        </Badge>
                      ) : reqStatus === 'price_suggested' ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs font-semibold print:text-[8px] print:px-0.5 print:py-0 print:font-normal print:inline-block flex items-center gap-1">
                          <DollarSign className="h-3 w-3 print:h-2 print:w-2" />
                          Preço Sugerido
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-300 text-xs font-semibold print:text-[8px] print:px-0.5 print:py-0 print:font-normal print:inline-block">
                          Rejeitado
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-center print:p-1">
                      {reqStatus === 'approved' ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mx-auto print:h-3 print:w-3" />
                      ) : reqStatus === 'price_suggested' ? (
                        <DollarSign className="h-5 w-5 text-blue-600 mx-auto print:h-3 print:w-3" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-600 mx-auto print:h-3 print:w-3" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Volume Total - Destaque */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 mb-4 text-white shadow-lg print:rounded print:p-2 print:mb-2 print:bg-blue-600 print:break-inside-avoid">
        <div>
          <p className="text-sm font-medium opacity-90 mb-0 print:text-[10px] print:font-normal">Volume total projetado: {totalVolume.toLocaleString('pt-BR')} L</p>
        </div>
      </div>

      {/* Notas Importantes */}
      <div className="mb-4 print:mb-2 print:break-inside-avoid">
        <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300 print:text-[9px] print:space-y-0.5">
          <p className="flex items-start gap-2 print:gap-1 print:leading-tight">
            <span className="font-bold print:font-normal">•</span>
            <span className="print:leading-tight">Preço sujeito a alteração dentro da proposta comercial.</span>
          </p>
          <p className="flex items-start gap-2 print:gap-1 print:leading-tight">
            <span className="font-bold print:font-normal">•</span>
            <span className="print:leading-tight">Posto não negociado, sujeito a cobrança com base no preço da bomba.</span>
          </p>
          <p className="flex items-start gap-2 text-red-700 dark:text-red-300 font-semibold print:gap-1 print:font-normal print:leading-tight">
            <span className="font-bold print:font-normal">•</span>
            <span className="print:leading-tight">Alterações podem ocorrer dentro de um prazo de até 24 horas.</span>
          </p>
        </div>
      </div>

      {/* Footer Profissional */}
      <div className="pt-4 print:pt-2 print:break-inside-avoid">
        <div className="text-center space-y-2 print:space-y-0.5">
          <p className="text-sm text-slate-600 dark:text-slate-400 print:text-[9px] print:leading-tight">
            Agradecemos sua atenção e ficamos à disposição para quaisquer esclarecimentos.
          </p>
          <div className="flex justify-center items-center gap-2 print:gap-1">
            <IntegraLogo className="h-8 w-auto print:h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
