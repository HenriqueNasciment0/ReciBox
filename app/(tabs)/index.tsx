import NovoGastoModal from '@/components/NovoGastoModal';
import NovoProjetoModal from '@/components/NovoProjetoModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DashboardData {
  totalMesAtual: number;
  totalGeral: number;
  projetosAtivos: number;
  ultimosGastos: Array<{
    id: string;
    valor: number;
    descricao: string;
    data_gasto: string;
    categoria_nome: string;
    projeto_nome: string;
  }>;
  gastosCategoria: Array<{
    categoria_nome: string;
    categoria_cor: string;
    total: number;
  }>;
}

interface GastoCompleto {
  id: string;
  projeto_id: string;
  categoria_id: string | null;
  valor: number;
  descricao: string | null;
  observacoes: string | null;
  data_gasto: string;
  imagens: any;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [novoGastoVisible, setNovoGastoVisible] = useState(false);
  const [novoProjetoVisible, setNovoProjetoVisible] = useState(false);
  const [data, setData] = useState<DashboardData>({
    totalMesAtual: 0,
    totalGeral: 0,
    projetosAtivos: 0,
    ultimosGastos: [],
    gastosCategoria: [],
  });
  const [gastoParaEditar, setGastoParaEditar] = useState<GastoCompleto | null>(null);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      const hoje = new Date();
      const inicioMes = startOfMonth(hoje);
      const fimMes = endOfMonth(hoje);

      const { data: gastosMes } = await supabase
        .from('gastos')
        .select('valor')
        .eq('user_id', user.id)
        .gte('data_gasto', format(inicioMes, 'yyyy-MM-dd'))
        .lte('data_gasto', format(fimMes, 'yyyy-MM-dd'));

      const { data: gastosGeral } = await supabase
        .from('gastos')
        .select('valor')
        .eq('user_id', user.id);

      const { data: projetos } = await supabase
        .from('projetos')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'ativo');

      const { data: ultimosGastos } = await supabase
        .from('gastos_detalhados')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: gastosCategoria } = await supabase.rpc('get_gastos_por_categoria', {
        p_user_id: user.id,
        p_data_inicio: format(inicioMes, 'yyyy-MM-dd'),
        p_data_fim: format(fimMes, 'yyyy-MM-dd'),
      });

      console.log('PROJETOS:', projetos);
      setData({
        totalMesAtual: gastosMes?.reduce((sum, gasto) => sum + Number(gasto.valor), 0) || 0,
        totalGeral: gastosGeral?.reduce((sum, gasto) => sum + Number(gasto.valor), 0) || 0,
        projetosAtivos: projetos?.length || 0,
        ultimosGastos: ultimosGastos || [],
        gastosCategoria: gastosCategoria?.slice(0, 4) || [],
      });
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleNovoGastoSuccess = () => {
    loadDashboardData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleEditarGasto = async (gastoResumo: any) => {
    const { data: gastoCompleto, error } = await supabase
      .from('gastos')
      .select(
        `
        id,
        projeto_id,
        categoria_id,
        valor,
        descricao,
        observacoes,
        data_gasto,
        imagens
      `
      )
      .eq('id', gastoResumo.id)
      .eq('user_id', user?.id)
      .single();

    if (error || !gastoCompleto) {
      console.error('Erro ao carregar gasto pra edição:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do gasto');
      return;
    }

    setGastoParaEditar(gastoCompleto);
    setNovoGastoVisible(true);
  };

  const handleExcluirGasto = (gastoId: string) => {
    Alert.alert('Confirmar Exclusão', 'Tem certeza que deseja excluir este gasto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => excluirGasto(gastoId),
      },
    ]);
  };

  const excluirGasto = async (gastoId: string) => {
    try {
      const { data: gasto, error: errFetch } = await supabase
        .from('gastos')
        .select('imagens')
        .eq('id', gastoId)
        .single();
      if (errFetch) throw errFetch;

      if (gasto?.imagens) {
        const imagens: Array<{ path: string }> = JSON.parse(gasto.imagens);
        const paths = imagens.map((img) => img.path);
        if (paths.length) {
          const { error: errStorage } = await supabase.storage.from('arquivos').remove(paths);
          if (errStorage) console.warn('Não foi possível remover alguns arquivos:', errStorage);
        }
      }

      const { error: errDel } = await supabase
        .from('gastos')
        .delete()
        .eq('id', gastoId)
        .eq('user_id', user?.id);
      if (errDel) throw errDel;

      Alert.alert('Sucesso', 'Gasto e imagens removidos com sucesso!');
      loadDashboardData();
    } catch (error) {
      console.error('Erro ao excluir gasto:', error);
      Alert.alert('Erro', 'Não foi possível excluir o gasto');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {user?.user_metadata?.full_name || 'Usuário'}!</Text>
            <Text style={styles.date}>
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Resumo Financeiro */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, styles.primaryCard]}>
            <Text style={styles.summaryLabel}>Gastos este mês</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.totalMesAtual)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.secondaryCard]}>
              <Text style={styles.summaryLabel}>Total geral</Text>
              <Text style={styles.summaryValueSecondary}>{formatCurrency(data.totalGeral)}</Text>
            </View>
            <View style={[styles.summaryCard, styles.secondaryCard]}>
              <Text style={styles.summaryLabel}>Projetos ativos</Text>
              <Text style={styles.summaryValueSecondary}>{data.projetosAtivos}</Text>
            </View>
          </View>
        </View>

        {/* Ações Rápidas */}
        <View style={styles.section}>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setNovoGastoVisible(true)}
            >
              <Ionicons name="camera" size={24} color="#2563EB" />
              <Text style={styles.quickActionText}>Novo Gasto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setNovoProjetoVisible(true)}
            >
              <Ionicons name="briefcase-outline" size={24} color="#2563EB" />
              <Text style={styles.quickActionText}>Novo Projeto</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionButton}>
              <Ionicons name="document-text-outline" size={24} color="#2563EB" />
              <Text style={styles.quickActionText}>Relatório</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Gastos por Categoria */}
        {data.gastosCategoria.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gastos por Categoria</Text>
            <View style={styles.categoriesContainer}>
              {data.gastosCategoria.map((categoria, index) => (
                <View key={index} style={styles.categoryItem}>
                  <View
                    style={[
                      styles.categoryColor,
                      { backgroundColor: categoria.categoria_cor || '#6B7280' },
                    ]}
                  />
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{categoria.categoria_nome}</Text>
                    <Text style={styles.categoryValue}>{formatCurrency(categoria.total)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Últimos Gastos */}
        {data.ultimosGastos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Últimos Gastos</Text>
            <View style={styles.expensesList}>
              {data.ultimosGastos.map((gasto) => (
                <View key={gasto.id} style={styles.expenseItem}>
                  <View style={styles.expenseIcon}>
                    <Ionicons name="receipt-outline" size={20} color="#6B7280" />
                  </View>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseDescription}>{gasto.descricao}</Text>
                    <Text style={styles.expenseDetails}>
                      {gasto.projeto_nome} • {gasto.categoria_nome}
                    </Text>
                  </View>
                  <View style={styles.expenseAmount}>
                    <Text style={styles.expenseValue}>{formatCurrency(gasto.valor)}</Text>
                    <Text style={styles.expenseDate}>
                      {format(new Date(gasto.data_gasto), 'dd/MM')}
                    </Text>
                  </View>
                  {/* NOVOS BOTÕES DE AÇÃO */}
                  <View style={styles.expenseActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditarGasto(gasto)}
                    >
                      <Ionicons name="pencil" size={16} color="#2563EB" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleExcluirGasto(gasto.id)}
                    >
                      <Ionicons name="trash" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal de Novo Gasto */}
      <NovoGastoModal
        visible={novoGastoVisible}
        onClose={() => setNovoGastoVisible(false)}
        onSuccess={handleNovoGastoSuccess}
      />

      <NovoGastoModal
        visible={novoGastoVisible}
        onClose={() => {
          setNovoGastoVisible(false);
          setGastoParaEditar(null);
        }}
        onSuccess={handleNovoGastoSuccess}
        gastoParaEditar={gastoParaEditar}
      />

      {/* Modal de Novo Projeto */}
      <NovoProjetoModal
        visible={novoProjetoVisible}
        onClose={() => setNovoProjetoVisible(false)}
        onSuccess={() => {
          setNovoProjetoVisible(false);
          loadDashboardData();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  date: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryCard: {
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  secondaryCard: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  summaryValueSecondary: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  categoriesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 2,
  },
  categoryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  expensesList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 2,
  },
  expenseDetails: {
    fontSize: 12,
    color: '#64748B',
  },
  expenseAmount: {
    alignItems: 'flex-end',
  },
  expenseValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  expenseDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  expenseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
});
