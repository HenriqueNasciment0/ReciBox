import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

interface NovoProjetoModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projetoParaEditar?: ProjetosData | null;
}

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo', color: '#10B981', icon: 'play-circle' },
  { value: 'pausado', label: 'Pausado', color: '#F59E0B', icon: 'pause-circle' },
  { value: 'concluido', label: 'Concluído', color: '#6B7280', icon: 'checkmark-circle' },
];

export default function NovoProjetoModal({
  visible,
  onClose,
  onSuccess,
  projetoParaEditar,
}: NovoProjetoModalProps) {
  const { user } = useAuth();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState('');
  const [status, setStatus] = useState('ativo');
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const isEditMode = !!projetoParaEditar;

  // Limpar ou preencher campos quando o modal abrir/fechar
  useEffect(() => {
    if (visible) {
      if (projetoParaEditar) {
        // Modo edição - preencher campos
        setNome(projetoParaEditar.nome || '');
        setDescricao(projetoParaEditar.descricao || '');
        setDataInicio(projetoParaEditar.data_inicio || new Date().toISOString().split('T')[0]);
        setDataFim(projetoParaEditar.data_fim || '');
        setStatus(projetoParaEditar.status || 'ativo');
      } else {
        // Modo criação - campos limpos
        setNome('');
        setDescricao('');
        setDataInicio(new Date().toISOString().split('T')[0]);
        setDataFim('');
        setStatus('ativo');
      }
    }
  }, [visible, projetoParaEditar]);

  const formatarData = (dateString: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const validarDatas = () => {
    if (dataFim && new Date(dataFim) < new Date(dataInicio)) {
      Alert.alert('Erro', 'A data de fim não pode ser anterior à data de início');
      return false;
    }
    return true;
  };

  const salvarProjeto = async () => {
    if (!nome.trim()) {
      Alert.alert('Erro', 'O nome do projeto é obrigatório');
      return;
    }

    if (!validarDatas()) return;

    setLoading(true);
    try {
      const dadosProjeto = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        status,
        updated_at: new Date().toISOString(),
      };

      if (isEditMode) {
        // Atualizar projeto existente
        const { error } = await supabase
          .from('projetos')
          .update(dadosProjeto)
          .eq('id', projetoParaEditar!.id)
          .eq('user_id', user?.id);

        if (error) throw error;
        Alert.alert('Sucesso', 'Projeto atualizado com sucesso!');
      } else {
        // Criar novo projeto
        const { error } = await supabase.from('projetos').insert({
          ...dadosProjeto,
          user_id: user?.id,
        });

        if (error) throw error;
        Alert.alert('Sucesso', 'Projeto criado com sucesso!');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar projeto:', error);
      Alert.alert('Erro', `Não foi possível ${isEditMode ? 'atualizar' : 'criar'} o projeto`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusAtual = () => STATUS_OPTIONS.find((opt) => opt.value === status);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Ionicons name={isEditMode ? 'pencil' : 'add-circle'} size={24} color="#2563EB" />
                <Text style={styles.title}>{isEditMode ? 'Editar Projeto' : 'Novo Projeto'}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Nome do Projeto */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nome do Projeto *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Viagem para Paris"
                value={nome}
                onChangeText={setNome}
                maxLength={100}
              />
              <Text style={styles.charCount}>{nome.length}/100</Text>
            </View>

            {/* Descrição */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Descrição</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Descreva os objetivos e detalhes do projeto..."
                value={descricao}
                onChangeText={setDescricao}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{descricao.length}/500</Text>
            </View>

            {/* Datas */}
            <View style={styles.dateContainer}>
              <View style={styles.dateField}>
                <Text style={styles.label}>Data de Início *</Text>
                <TextInput
                  style={styles.input}
                  value={dataInicio}
                  onChangeText={setDataInicio}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numeric"
                />
                {dataInicio && <Text style={styles.datePreview}>{formatarData(dataInicio)}</Text>}
              </View>

              <View style={styles.dateField}>
                <Text style={styles.label}>Data de Fim</Text>
                <TextInput
                  style={styles.input}
                  value={dataFim}
                  onChangeText={setDataFim}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numeric"
                />
                {dataFim && <Text style={styles.datePreview}>{formatarData(dataFim)}</Text>}
              </View>
            </View>

            {/* Status */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Status</Text>
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

            {/* Informações adicionais para edição */}
            {isEditMode && projetoParaEditar && (
              <View style={styles.infoContainer}>
                <Text style={styles.infoTitle}>Informações</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Criado em:</Text>
                  <Text style={styles.infoValue}>
                    {projetoParaEditar.created_at
                      ? formatarData(projetoParaEditar.created_at.split('T')[0])
                      : '--'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Última atualização:</Text>
                  <Text style={styles.infoValue}>
                    {projetoParaEditar.updated_at
                      ? formatarData(projetoParaEditar.updated_at.split('T')[0])
                      : '--'}
                  </Text>
                </View>
              </View>
            )}

            {/* Botões */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={loading}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={salvarProjeto}
                disabled={loading || !nome.trim()}
              >
                <Ionicons name={isEditMode ? 'save' : 'add'} size={20} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {loading ? 'Salvando...' : isEditMode ? 'Atualizar' : 'Criar Projeto'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 80,
  },
  charCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 4,
  },
  dateContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  dateField: {
    flex: 1,
  },
  datePreview: {
    fontSize: 12,
    color: '#2563EB',
    marginTop: 4,
    fontWeight: '500',
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
  infoContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
