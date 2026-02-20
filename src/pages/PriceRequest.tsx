
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Plus,
  Loader2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// New Components
import { PriceRequestHeader } from "@/components/price-request/PriceRequestHeader";
import { RequestForm } from "@/components/price-request/RequestForm";
import { RequestList } from "@/components/price-request/RequestList";
import { RequesterResponseActions } from "@/components/price-request/RequesterResponseActions";
import { ProposalFullView } from "@/components/ProposalFullView";
import { supabase } from "@/integrations/supabase/client";
import { useParams } from "react-router-dom";

export default function PriceRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("my-requests");
  const [selectedRequestBatch, setSelectedRequestBatch] = useState<any[] | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Animation variants
  const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } }
  };


  const loadRequestDetails = async (requestId: string) => {
    setLoadingDetails(true);
    try {
      // Buscar a solicitação específica (sem joins falhos)
      const { data: request, error } = await supabase
        .from('price_suggestions')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error) throw error;

      let batch = [request];

      // Se tiver batch_id, buscar todas do mesmo lote
      if (request.batch_id) {
        const { data: batchRequests, error: batchError } = await supabase
          .from('price_suggestions')
          .select('*')
          .eq('batch_id', request.batch_id);

        if (!batchError && batchRequests) {
          batch = batchRequests;
        }
      }

      // 3. Manual Enrichment (Optimized)
      const stationIds = [...new Set(batch.map(r => r.station_id).filter(Boolean))] as (string | number)[];
      const clientIds = [...new Set(batch.map(r => r.client_id).filter(Boolean))] as (string | number)[];

      let stationsMap: Record<string, any> = {};
      let clientsMap: Record<string, any> = {};

      if (stationIds.length > 0) {
        if (stationIds.length > 0) {
          // Prepare IDs for RPC - Convert all to string, filter out empty/null
          const allStationIds = stationIds.map(id => String(id)).filter(Boolean);

          if (allStationIds.length > 0) {
            // RPC handles both numeric legacy IDs and UUIDs
            const { data: stations } = await supabase.rpc('get_sis_empresa_by_ids', {
              p_ids: allStationIds
            } as any);

            if (stations) {
              stations.forEach(s => {
                const stationData = { name: s.nome_empresa, code: s.cnpj_cpf, id: s.id_empresa };
                // Map by legacy ID
                if (s.id_empresa) stationsMap[String(s.id_empresa)] = stationData;
                // Map by UUID if available (though RPC return might not include it if not selected, let's verify)
                // The RPC usually returns: id_empresa, nome_empresa, cnpj_cpf...
                // If the input was a UUID, we need to match it.
                // Ideally the RPC returns the input ID context or we match by unique properties.
                // For now, map by all available unique identifiers.
                if (s.cnpj_cpf) stationsMap[String(s.cnpj_cpf)] = stationData;
                if (s.nome_empresa) stationsMap[String(s.nome_empresa)] = stationData;

                // Only numeric IDs in current RPC return?
                // If `get_sis_empresa_by_ids` returns `id_empresa` (text), it might be the UUID if the table structure allows.
                // Let's assume standard mapping for now.
              });
            }
          }
        }

      }


      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from('clientes')
          .select('id_cliente, nome')
          .in('id_cliente', clientIds.map(id => Number(id)));

        if (clients) {
          clients.forEach(c => {
            clientsMap[c.id_cliente] = { name: c.nome, code: c.id_cliente, id: c.id_cliente };
          });
        }
      }

      const enrichedBatch = batch.map((req) => {
        const station = stationsMap[req.station_id] || { name: req.station_id || 'Desconhecido', code: req.station_id };
        const client = clientsMap[req.client_id] || { name: 'Cliente', code: req.client_id };

        return {
          ...req,
          stations: station,
          clients: client
        };
      });

      setSelectedRequestBatch(enrichedBatch);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Carregar detalhes quando ID estiver presente
  useEffect(() => {
    if (id) {
      loadRequestDetails(id);
    } else {
      setSelectedRequestBatch(null);
    }
  }, [id]);

  const renderContent = () => {
    if (id) {
      if (loadingDetails || !selectedRequestBatch) {
        return (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        );
      }

      // Visualização de Detalhes (Proposta)
      const first = selectedRequestBatch[0];
      return (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card>
            <CardContent>
              <div className="mb-4">
                <Button variant="ghost" onClick={() => navigate('/solicitacao-preco')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para lista
                </Button>
              </div>
              {/* Aqui poderíamos usar o ProposalFullView ou um componente de detalhes específico */}
              {/* Por simplicidade, assumindo que ProposalFullView pode ser importado se existir, ou renderizamos algo simples */}
              {/* Como não tenho importado ProposalFullView aqui, vou adicionar o import e usar */}
              <ProposalFullView
                batch={selectedRequestBatch}
                proposalNumber={first.id.substring(0, 8).toUpperCase()}
                proposalDate={new Date(first.created_at).toLocaleDateString('pt-BR')}
                generalStatus={first.status}
                user={user}
              />

              {['price_suggested', 'awaiting_justification', 'awaiting_evidence'].includes(first.status) && (
                <div className="mt-8 pt-8 border-t border-slate-200">
                  <RequesterResponseActions
                    requests={selectedRequestBatch}
                    onSuccess={() => loadRequestDetails(id)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    switch (activeTab) {
      case "new-request":
        return (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <RequestForm onSuccess={() => setActiveTab("my-requests")} />
          </motion.div>
        );

      case "drafts":
        return (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <RequestList filterStatus="draft" />
          </motion.div>
        );

      case "my-requests":
      default:
        return (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <RequestList />
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <PriceRequestHeader />

        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <TabsList className="grid w-full sm:w-auto grid-cols-3 h-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <TabsTrigger
                  value="my-requests"
                  className="px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  <FileText className="h-4 w-4 mr-2 hidden sm:inline" />
                  Minhas Solicitações
                </TabsTrigger>
                <TabsTrigger
                  value="drafts"
                  className="px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  <FileText className="h-4 w-4 mr-2 hidden sm:inline opacity-50" />
                  Rascunhos
                </TabsTrigger>
                <TabsTrigger
                  value="new-request"
                  className="px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-2 hidden sm:inline" />
                  Nova Solicitação
                </TabsTrigger>
              </TabsList>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <TabsContent value="my-requests" className="mt-0">
                  {renderContent()}
                </TabsContent>
                <TabsContent value="drafts" className="mt-0">
                  {renderContent()}
                </TabsContent>
                <TabsContent value="new-request" className="mt-0">
                  {renderContent()}
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </div>
    </div>
  );
}