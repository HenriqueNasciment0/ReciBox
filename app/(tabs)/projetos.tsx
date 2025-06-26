import NovoProjetoModal from '@/components/NovoProjetoModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays, format, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface ProjetosData {
  created_at: string | null;
  data_fim: string | null;
  data_inicio: string | null;
  descricao: string | null;
  id: string;
  nome: string | null;
  status: string | null;
  user_id: string | null;
  updated_at: string | null;
}

interface DashboardStats {
  totalProjetos: number;
  projetosAtivos: number;
  projetosPausados: number;
  projetosConcluidos: number;
  projetosAtrasados: number;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [novoGastoVisible, setNovoGastoVisible] = useState(false);
  const [novoProjetoVisible, setNovoProjetoVisible] = useState(false);
  const [projetos, setProjetos] = useState<ProjetosData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProjetos: 0,
    projetosAtivos: 0,
    projetosPausados: 0,
    projetosConcluidos: 0,
    projetosAtrasados: 0,
  });
  const [projetoParaEditar, setProjetoParaEditar] = useState<ProjetosData | null>(null);
  const [status, setStatus] = useState('todos');
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const STATUS_OPTIONS = [
    { value: 'todos', label: 'Todos', color: '#6366F1', icon: 'apps' },
    { value: 'ativo', label: 'Ativos', color: '#10B981', icon: 'play-circle' },
    { value: 'pausado', label: 'Pausados', color: '#F59E0B', icon: 'pause-circle' },
    { value: 'concluido', label: 'Concluídos', color: '#6B7280', icon: 'checkmark-circle' },
  ];

  const calcularStats = (todosProjetos: ProjetosData[]): DashboardStats => {
    const hoje = new Date();

    return {
      totalProjetos: todosProjetos.length,
      projetosAtivos: todosProjetos.filter((p) => p.status === 'ativo').length,
      projetosPausados: todosProjetos.filter((p) => p.status === 'pausado').length,
      projetosConcluidos: todosProjetos.filter((p) => p.status === 'concluido').length,
      projetosAtrasados: todosProjetos.filter((p) => {
        if (p.status === 'concluido' || !p.data_fim) return false;
        return isAfter(hoje, new Date(p.data_fim));
      }).length,
    };
  };

  const loadDashboardData = async (statusFiltro: string) => {
    if (!user) return;

    try {
      // Buscar todos os projetos primeiro para calcular stats
      const { data: todosProjetos } = await supabase
        .from('projetos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const stats = calcularStats(todosProjetos ?? []);
      setStats(stats);

      // Filtrar projetos baseado no status selecionado
      let projetosFiltrados = todosProjetos ?? [];
      if (statusFiltro !== 'todos') {
        projetosFiltrados = projetosFiltrados.filter((p) => p.status === statusFiltro);
      }

      setProjetos(projetosFiltrados);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData(status);
  }, [user, status]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData(status);
  };

  const getProjetoProgress = (projeto: ProjetosData) => {
    if (!projeto.data_inicio || !projeto.data_fim) return null;

    const inicio = new Date(projeto.data_inicio);
    const fim = new Date(projeto.data_fim);
    const hoje = new Date();

    const totalDias = differenceInDays(fim, inicio);
    const diasPassados = differenceInDays(hoje, inicio);

    const progress = Math.min(Math.max(diasPassados / totalDias, 0), 1);
    return { progress, totalDias, diasPassados };
  };

  const getStatusInfo = (projeto: ProjetosData) => {
    const hoje = new Date();
    const statusOption = STATUS_OPTIONS.find((opt) => opt.value === projeto.status);

    let statusText = statusOption?.label || projeto.status;
    let statusColor = statusOption?.color || '#6B7280';
    let isOverdue = false;

    if (projeto.status !== 'concluido' && projeto.data_fim) {
      const dataFim = new Date(projeto.data_fim);
      if (isAfter(hoje, dataFim)) {
        statusText = 'Atrasado';
        statusColor = '#DC2626';
        isOverdue = true;
      }
    }

    return { statusText, statusColor, isOverdue };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleEditarProjeto = async (projeto: ProjetosData) => {
    try {
      setProjetoParaEditar(projeto);
      setNovoProjetoVisible(true);
    } catch (error) {
      console.error('Erro ao carregar projeto para edição:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do projeto');
    }
  };

  const handleExcluirProjeto = (projetoId: string) => {
    Alert.alert('Confirmar Exclusão', 'Tem certeza que deseja excluir este projeto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => excluirProjeto(projetoId),
      },
    ]);
  };

  const excluirProjeto = async (projetoId: string) => {
    try {
      const { data: gastos, error: errorGastos } = await supabase
        .from('gastos')
        .select('id, imagem_path')
        .eq('projeto_id', projetoId)
        .eq('user_id', user?.id);

      if (errorGastos) {
        console.error('Erro ao buscar gastos do projeto:', errorGastos);
        throw errorGastos;
      }

      if (gastos && gastos.length > 0) {
        const imagensParaRemover: string[] = [];

        gastos.forEach((gasto) => {
          if (gasto.imagem_path) {
            imagensParaRemover.push(gasto.imagem_path);
          }
        });

        if (imagensParaRemover.length > 0) {
          const { error: errorStorage } = await supabase.storage
            .from('arquivos')
            .remove(imagensParaRemover);

          if (errorStorage) {
            console.warn('Aviso: Não foi possível remover alguns arquivos:', errorStorage);
          }
        }

        const { error: errorDeleteGastos } = await supabase
          .from('gastos')
          .delete()
          .eq('projeto_id', projetoId)
          .eq('user_id', user?.id);

        if (errorDeleteGastos) {
          console.error('Erro ao excluir gastos:', errorDeleteGastos);
          throw errorDeleteGastos;
        }
      }

      const { error: errorDeleteProjeto } = await supabase
        .from('projetos')
        .delete()
        .eq('id', projetoId)
        .eq('user_id', user?.id);

      if (errorDeleteProjeto) {
        console.error('Erro ao excluir projeto:', errorDeleteProjeto);
        throw errorDeleteProjeto;
      }

      Alert.alert('Sucesso', 'Projeto, gastos e arquivos removidos com sucesso!');
      loadDashboardData(status);
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      Alert.alert('Erro', 'Não foi possível excluir o projeto. Tente novamente.');
    }
  };

  const getStatusAtual = () => STATUS_OPTIONS.find((opt) => opt.value === status);

  const StatCard = ({
    title,
    value,
    color,
    icon,
  }: {
    title: string;
    value: number;
    color: string;
    icon: string;
  }) => (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon as any} size={20} color={color} />
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Dashboard</Text>
            <Text style={styles.date}>
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <StatCard
              title="Total de Projetos"
              value={stats.totalProjetos}
              color="#6366F1"
              icon="briefcase"
            />
            <StatCard
              title="Projetos Ativos"
              value={stats.projetosAtivos}
              color="#10B981"
              icon="play-circle"
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              title="Pausados"
              value={stats.projetosPausados}
              color="#F59E0B"
              icon="pause-circle"
            />
            <StatCard
              title="Concluídos"
              value={stats.projetosConcluidos}
              color="#6B7280"
              icon="checkmark-circle"
            />
          </View>
          {stats.projetosAtrasados > 0 && (
            <View style={styles.alertCard}>
              <Ionicons name="warning" size={20} color="#DC2626" />
              <Text style={styles.alertText}>
                {stats.projetosAtrasados} projeto{stats.projetosAtrasados > 1 ? 's' : ''} atrasado
                {stats.projetosAtrasados > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Ações Rápidas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setNovoGastoVisible(true)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="camera" size={24} color="#2563EB" />
              </View>
              <Text style={styles.quickActionText}>Novo Gasto</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setNovoProjetoVisible(true)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="add-circle" size={24} color="#16A34A" />
              </View>
              <Text style={styles.quickActionText}>Novo Projeto</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionButton}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3E2' }]}>
                <Ionicons name="document-text" size={24} color="#D97706" />
              </View>
              <Text style={styles.quickActionText}>Relatório</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filtro de Status */}
        <View style={styles.section}>
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Filtrar por Status</Text>
            <TouchableOpacity
              style={styles.statusSelector}
              onPress={() => setShowStatusPicker(!showStatusPicker)}
            >
              <View style={styles.statusValue}>
                <Ionicons
                  name={getStatusAtual()?.icon as any}
                  size={20}
                  color={getStatusAtual()?.color}
                />
                <Text style={[styles.statusText, { color: getStatusAtual()?.color }]}>
                  {getStatusAtual()?.label}
                </Text>
              </View>
              <Ionicons
                name={showStatusPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>

            {showStatusPicker && (
              <View style={styles.statusOptions}>
                {STATUS_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.statusOption,
                      status === option.value && styles.statusOptionSelected,
                    ]}
                    onPress={() => {
                      setStatus(option.value);
                      setShowStatusPicker(false);
                    }}
                  >
                    <Ionicons name={option.icon as any} size={20} color={option.color} />
                    <Text style={[styles.statusOptionText, { color: option.color }]}>
                      {option.label}
                    </Text>
                    {status === option.value && (
                      <Ionicons name="checkmark" size={20} color={option.color} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Lista de Projetos */}
        {projetos.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {status === 'todos' ? 'Todos os Projetos' : `Projetos ${getStatusAtual()?.label}`}
              <Text style={styles.projectCount}> ({projetos.length})</Text>
            </Text>
            <View style={styles.projectsList}>
              {projetos.map((projeto) => {
                const progressInfo = getProjetoProgress(projeto);
                const statusInfo = getStatusInfo(projeto);

                return (
                  <View key={projeto.id} style={styles.projectCard}>
                    <View style={styles.projectHeader}>
                      <View style={styles.projectTitleContainer}>
                        <Text style={styles.projectTitle}>{projeto.nome}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: `${statusInfo.statusColor}15` },
                          ]}
                        >
                          <Text style={[styles.statusBadgeText, { color: statusInfo.statusColor }]}>
                            {statusInfo.statusText}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.projectActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleEditarProjeto(projeto)}
                        >
                          <Ionicons name="pencil" size={16} color="#2563EB" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.deleteButton]}
                          onPress={() => handleExcluirProjeto(projeto.id)}
                        >
                          <Ionicons name="trash" size={16} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {projeto.descricao && (
                      <Text style={styles.projectDescription}>{projeto.descricao}</Text>
                    )}

                    <View style={styles.projectDates}>
                      <View style={styles.dateItem}>
                        <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                        <Text style={styles.dateText}>
                          Início:{' '}
                          {projeto.data_inicio
                            ? format(new Date(projeto.data_inicio), 'dd/MM/yyyy')
                            : 'Não definido'}
                        </Text>
                      </View>
                      <View style={styles.dateItem}>
                        <Ionicons name="flag-outline" size={16} color="#6B7280" />
                        <Text style={styles.dateText}>
                          Fim:{' '}
                          {projeto.data_fim
                            ? format(new Date(projeto.data_fim), 'dd/MM/yyyy')
                            : 'Não definido'}
                        </Text>
                      </View>
                    </View>

                    {progressInfo && projeto.status !== 'concluido' && (
                      <View style={styles.progressContainer}>
                        <View style={styles.progressHeader}>
                          <Text style={styles.progressLabel}>Progresso</Text>
                          <Text style={styles.progressText}>
                            {Math.round(progressInfo.progress * 100)}%
                          </Text>
                        </View>
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${progressInfo.progress * 100}%`,
                                backgroundColor: statusInfo.isOverdue ? '#DC2626' : '#10B981',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.progressDays}>
                          {progressInfo.diasPassados} de {progressInfo.totalDias} dias
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nenhum projeto encontrado</Text>
            <Text style={styles.emptySubtitle}>
              {status === 'todos'
                ? 'Crie seu primeiro projeto para começar'
                : `Não há projetos com status "${getStatusAtual()?.label.toLowerCase()}"`}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setNovoProjetoVisible(true)}
            >
              <Text style={styles.emptyButtonText}>Criar Projeto</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal de Novo Projeto */}
      <NovoProjetoModal
        visible={novoProjetoVisible}
        onClose={() => {
          setProjetoParaEditar(null);
          setNovoProjetoVisible(false);
        }}
        onSuccess={() => {
          setProjetoParaEditar(null);
          setNovoProjetoVisible(false);
          loadDashboardData(status);
        }}
        projetoParaEditar={projetoParaEditar}
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
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },
  date: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
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

  // Stats Cards
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  alertText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },

  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  projectCount: {
    fontSize: 16,
    fontWeight: '400',
    color: '#64748B',
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Filter
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  statusSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
  },
  statusValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusOptions: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statusOptionSelected: {
    backgroundColor: '#F0F9FF',
  },
  statusOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },

  // Projects List
  projectsList: {
    gap: 12,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  projectTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  projectActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  projectDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 20,
  },
  projectDates: {
    gap: 8,
    marginBottom: 16,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#374151',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressDays: {
    fontSize: 12,
    color: '#6B7280',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
