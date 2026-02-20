import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SaoRoqueLogo } from './SaoRoqueLogo';
import { supabase } from "@/integrations/supabase/client";
import { formatNameFromEmail } from "@/lib/utils";
import { Download, Eye, EyeOff, FileText, ShieldAlert, Image as ImageIcon } from "lucide-react";
import html2canvas from 'html2canvas';

// Componente para visualização completa da proposta comercial
export function ProposalFullView({ batch, proposalNumber, proposalDate, generalStatus, user }: any) {
  const [isInternalView, setIsInternalView] = useState(true);
  const [requesterName, setRequesterName] = useState<string>('N/A');

  // Filter items for Client View (only approved)
  const approvedItems = batch.filter((r: any) => r.status === 'approved');
  const itemsToDisplay = isInternalView ? batch : approvedItems;

  const firstRequest = batch[0];

  // Extrair clientes únicos do lote
  const uniqueClients = Array.from(new Set(batch.map((r: any) => r.clients?.id))).map(id => {
    return batch.find((r: any) => r.clients?.id === id)?.clients;
  }).filter(Boolean);

  const mainClient = uniqueClients[0];
  const hasMultipleClients = uniqueClients.length > 1;

  // Buscar nome do solicitante
  useEffect(() => {
    const fetchRequesterName = async () => {
      if (!firstRequest) return;
      const createdBy = firstRequest.created_by || firstRequest.requested_by;
      if (createdBy) {
        try {
          // Check if it's an email (legacy) or UUID
          const isEmail = createdBy.includes('@');

          if (isEmail) {
            const { data: emailProfileData } = await supabase
              .from('user_profiles')
              .select('nome, email')
              .eq('email', createdBy)
              .maybeSingle();

            if (emailProfileData) {
              setRequesterName(formatNameFromEmail(emailProfileData.nome || emailProfileData.email || 'N/A'));
              return;
            }
            // Fallback if not found in profiles but smells like email
            setRequesterName(formatNameFromEmail(createdBy));
            return;
          }

          // It's a UUID (probably), search by user_id
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('nome, email')
            .eq('user_id', createdBy)
            .maybeSingle();

          if (profileData) {
            setRequesterName(formatNameFromEmail(profileData.nome || profileData.email || 'N/A'));
            return;
          }

          // Final fallback (shouldn't really happen if ID is valid UUID but not found)
          setRequesterName(formatNameFromEmail('N/A'));

        } catch (error) {
          console.error('Erro ao buscar solicitante:', error);
          setRequesterName(formatNameFromEmail(createdBy?.includes('@') ? createdBy : 'N/A'));
        }
      }
    };

    fetchRequesterName();
  }, [firstRequest?.created_by, firstRequest?.requested_by, firstRequest]);

  // Listen for print events to toggle view
  useEffect(() => {
    const handleBeforePrint = () => {
      // Forçar Modo Cliente na impressão
      setIsInternalView(false);
    };

    const handleAfterPrint = () => {
      // Opcional: Voltar para Modo Interno ou manter como está. 
      // Manter como está (false) pode ser mais seguro, mas vamos restaurar para conveniência
      setIsInternalView(true);
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

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
  const totalVolume = itemsToDisplay.reduce((sum: number, r: any) => {
    const volume = r.volume_projected || 0;
    return sum + (volume * 1000); // Converter m³ para litros
  }, 0);

  const totalValue = itemsToDisplay.reduce((sum: number, r: any) => {
    const volume = (r.volume_projected || 0) * 1000;
    const price = r.final_price || r.suggested_price || 0;
    return sum + (volume * (price / 100)); // price is in cents
  }, 0);

  // Buscar informações do vendedor
  const sellerName = formatNameFromEmail(user?.email || user?.user_metadata?.name || 'Vendedor');

  const handleDownloadImage = async () => {
    const element = document.getElementById('proposal-capture-area');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        // Forçar largura de paisagem na captura
        windowWidth: 1280,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById('proposal-capture-area');
          if (clonedElement) {
            // 1. Forçar largura A4 Paisagem (aprox 1120px para scale 2)
            clonedElement.style.width = '1120px';
            clonedElement.style.padding = '40px';

            // 2. Esconder elementos "no-print" (botões, avisos)
            const buttons = clonedElement.querySelectorAll('.no-print');
            buttons.forEach(b => (b as HTMLElement).style.display = 'none');

            // 3. Forçar ocultamento de colunas sensíveis (Modo Cliente)
            const sensitiveItems = clonedElement.querySelectorAll('.client-hidden-col');
            sensitiveItems.forEach(item => (item as HTMLElement).style.display = 'none');
          }
        }
      });

      const link = document.createElement('a');
      link.download = `proposta_${proposalNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
    }
  };

  return (
    <div className="bg-slate-100 min-h-screen">
      {/* Controles superiores fixos na tela */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-4 no-print shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Switch
              id="view-mode"
              checked={isInternalView}
              onCheckedChange={setIsInternalView}
            />
            <Label htmlFor="view-mode" className="font-semibold text-slate-700 cursor-pointer flex flex-col">
              <span className="text-sm font-bold flex items-center gap-1.5">
                {isInternalView ? (
                  <>
                    <EyeOff className="h-4 w-4 text-orange-600" />
                    <span className="text-orange-900">Modo Interno</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 text-blue-600" />
                    <span className="text-blue-900">Modo Cliente</span>
                  </>
                )}
              </span>
              <span className="text-[10px] text-slate-500 font-normal">
                {isInternalView ? 'Custos e margens visíveis' : 'Apenas preços finais'}
              </span>
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadImage}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-sm font-bold text-sm"
          >
            <ImageIcon className="h-4 w-4 text-slate-500" />
            BAIXAR IMAGEM (WhatsApp)
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors shadow-sm font-bold text-sm"
          >
            <Download className="h-4 w-4" />
            GERAR PDF (PAISAGEM)
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto p-4 md:p-8 overflow-x-auto">
        <div
          className="bg-white shadow-xl mx-auto overflow-hidden print:shadow-none"
          id="proposal-capture-area"
          style={{ width: '100%', minWidth: '1120px' }}
        >
          <div className="p-10 md:p-14">
            <style>{`
              @media print {
                @page {
                  size: landscape;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                  background: white !important;
                  width: 1120px; /* Forçar largura A4 Paisagem */
                }
                .bg-slate-100 {
                  background: white !important;
                }
                .max-w-[1200px] {
                  max-width: none !important;
                  width: 1120px !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                #proposal-capture-area {
                  width: 1120px !important;
                  min-width: 1120px !important;
                  border: none !important;
                  box-shadow: none !important;
                  margin: 0 !important;
                }
                .no-print {
                  display: none !important;
                }
                /* Garantir que colunas sensíveis sumam se Modo Cliente estiver ativo ou durante export */
                .client-hidden-col {
                  display: ${isInternalView ? 'table-cell' : 'none'} !important;
                }
              }
            `}</style>

            {/* Cabeçalho com Logo */}
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <SaoRoqueLogo className="h-28 w-auto" />
              </div>
              <div className="text-right">
                <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">
                  Proposta Comercial
                </h1>
                <p className="text-base text-slate-500 font-mono tracking-widest mt-1">
                  #{proposalNumber}
                </p>
              </div>
            </div>

            {/* Informações Gerais Grid - Layout Horizontal Otimizado */}
            <div className="grid grid-cols-2 gap-20 mb-12 text-sm">
              {/* Bloco Esquerda: Clientes */}
              <div className="space-y-8">
                <div className="border-l-4 border-blue-600 pl-6 py-2 bg-slate-50/50 pr-4 rounded-r-lg">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                    {hasMultipleClients ? 'Clientes do Lote' : 'Cliente'}
                  </h3>
                  {hasMultipleClients ? (
                    <div className="space-y-4">
                      {uniqueClients.map((c: any) => (
                        <div key={c.id}>
                          <p className="text-xl font-bold text-slate-900 leading-tight">{c.name}</p>
                          <p className="text-xs text-slate-500 font-mono mt-1">{c.code || 'CNPJ Não Informado'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-black text-slate-900 tracking-tight">{mainClient?.name || 'Cliente Não Identificado'}</p>
                      <p className="text-sm text-slate-600 font-mono mt-1">{mainClient?.code || 'CNPJ Não Informado'}</p>
                    </>
                  )}
                </div>

                <div className="pl-7">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Solicitado Por</h3>
                  <p className="text-lg font-semibold text-slate-800">{requesterName}</p>
                </div>
              </div>

              {/* Bloco Direita: Detalhes da Proposta */}
              <div className="space-y-8 text-right bg-slate-50/30 p-6 rounded-lg">
                <div className="flex justify-end gap-12">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Emissão</h3>
                    <p className="text-xl font-bold text-slate-900">{proposalDate}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Validade</h3>
                    <p className="text-xl font-bold text-slate-900 tracking-tighter cursor-help" title="Válido para a data de emissão">24 Horas</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-200/50">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Responsável Comercial</h3>
                  <p className="text-lg font-bold text-slate-800">{sellerName}</p>
                  <p className="text-[10px] text-red-600 font-black uppercase mt-2 tracking-tighter">
                    *Preços sujeitos a alteração sem aviso prévio
                  </p>
                </div>
              </div>
            </div>

            {/* Tabela de Itens - Reforçada para Paisagem */}
            <div className="mb-12">
              <h2 className="text-xl font-black text-slate-900 mb-6 pb-2 border-b-2 border-slate-900 inline-flex items-center gap-3">
                <FileText className="h-6 w-6 text-slate-400" />
                DETALHAMENTO DA PROPOSTA
              </h2>

              {itemsToDisplay.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-medium">Nenhum item aprovado para exibição nesta proposta.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold uppercase tracking-widest text-[11px]">
                        <th className="px-8 py-5">Posto / Origem / Produto</th>
                        <th className="px-8 py-5 text-right">Volume (L)</th>
                        <th className="px-8 py-5 text-right">Preço Unit. (R$/L)</th>
                        <th className="px-8 py-5 text-right bg-slate-800">Total Bruto (R$)</th>

                        {(isInternalView || true) && (
                          <>
                            <th className="px-8 py-5 text-right bg-orange-600 text-white client-hidden-col">Custo</th>
                            <th className="px-8 py-5 text-right bg-orange-600 text-white client-hidden-col">Margem</th>
                            <th className="px-8 py-5 text-center bg-orange-600 text-white client-hidden-col">Status</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {itemsToDisplay.map((req: any, idx: number) => {
                        const station = req.stations || req.stations_list?.[0];
                        const price = req.final_price || req.suggested_price || 0;
                        const volumeM3 = Number(req.volume_projected || 0);
                        const volumeL = volumeM3 * 1000;
                        const totalItem = volumeL * price;

                        // Internal View Data
                        const costPrice = req.cost_price || 0;
                        const marginCents = req.margin_cents || 0;
                        const status = req.status;

                        return (
                          <tr key={req.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="px-8 py-6">
                              <div className="font-black text-slate-900 text-base">{station?.name || 'Posto Diversos'}</div>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-sm font-black uppercase">
                                  {req.product ? req.product.replace(/_/g, ' ').toUpperCase() : 'COMBUSTIVEL'}
                                </span>
                                {hasMultipleClients && req.clients && (
                                  <span className="text-[10px] text-blue-700 font-black uppercase bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-100">
                                    {req.clients.name}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right text-slate-600 font-bold tabular-nums">
                              {volumeL.toLocaleString('pt-BR')} L
                            </td>
                            <td className="px-8 py-6 text-right font-black text-slate-950 text-base tabular-nums">
                              {formatPrice4Decimals(price)}
                            </td>
                            <td className="px-8 py-6 text-right font-black text-blue-700 text-base tabular-nums bg-blue-50/30">
                              {totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>

                            {(isInternalView || true) && (
                              <>
                                <td className="px-8 py-6 text-right text-slate-500 font-bold tabular-nums bg-orange-50/50 border-l border-orange-100 client-hidden-col">
                                  {formatPrice4Decimals(costPrice)}
                                </td>
                                <td className={`px-8 py-6 text-right font-black tabular-nums bg-orange-50/50 client-hidden-col ${marginCents >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {marginCents} cts
                                </td>
                                <td className="px-8 py-6 text-center bg-orange-50/50 client-hidden-col">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black tracking-tighter
                                      ${status === 'approved' ? 'bg-green-100 text-green-800' :
                                      status === 'rejected' ? 'bg-red-100 text-red-800' :
                                        status === 'draft' ? 'bg-slate-200 text-slate-700' :
                                          status === 'price_suggested' ? 'bg-blue-100 text-blue-800' :
                                            status === 'awaiting_justification' ? 'bg-orange-100 text-orange-800' :
                                              status === 'awaiting_evidence' ? 'bg-purple-100 text-purple-800' :
                                                status === 'appealed' ? 'bg-yellow-100 text-yellow-800' :
                                                  'bg-slate-100 text-slate-800'}`}>
                                    {status === 'approved' ? 'APROVADO' :
                                      status === 'rejected' ? 'REJEITADO' :
                                        status === 'draft' ? 'RASCUNHO' :
                                          status === 'price_suggested' ? 'PREÇO SUGERIDO' :
                                            status === 'awaiting_justification' ? 'JUSTIFICAR' :
                                              status === 'awaiting_evidence' ? 'REFERÊNCIA' :
                                                status === 'appealed' ? 'EM APELAÇÃO' :
                                                  'PENDENTE'}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white font-black text-base border-t-4 border-white">
                      <tr>
                        <td className="px-8 py-6 uppercase tracking-widest text-xs">RESUMO GERAL</td>
                        <td className="px-8 py-6 text-right tabular-nums">{totalVolume.toLocaleString('pt-BR')} L</td>
                        <td className="px-8 py-6 text-right">-</td>
                        <td className="px-8 py-6 text-right text-blue-300 tabular-nums bg-slate-800">
                          {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        {(isInternalView || true) && (
                          <>
                            <td className="px-8 py-6 bg-slate-800 client-hidden-col"></td>
                            <td className="px-8 py-6 bg-slate-800 client-hidden-col"></td>
                            <td className="px-8 py-6 bg-slate-800 client-hidden-col"></td>
                          </>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Footer / Branding */}
            <div className="mt-16 pt-10 border-t-2 border-slate-100 flex justify-between items-end">
              <div className="space-y-4">
                {isInternalView && (
                  <div className="p-5 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg max-w-md no-print">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="h-6 w-6 text-orange-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-black text-orange-900 uppercase tracking-tighter">Aviso de Confidencialidade</h4>
                        <p className="text-xs text-orange-800 mt-1 leading-relaxed">
                          Este documento contém informações estratégicas. Ao exportar para o cliente,
                          o sistema <strong>forçará automaticamente</strong> o modo comercial ocultando custos e margens.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="text-xs text-slate-400 font-medium">
                  <p className="uppercase tracking-widest font-black text-[9px] text-slate-300 mb-1">Tecnologia</p>
                  <p className="flex items-center gap-1.5">
                    Gerado via <span className="text-slate-900 font-black">Integra-Pricing</span>
                  </p>
                  <p className="mt-1">{new Date().toLocaleString()}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="font-black text-slate-950 text-2xl tracking-tighter">Rede São Roque</p>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mt-1">Excelência em Combustíveis</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
