import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface NovoProjetoModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NovoProjetoModal({ visible, onClose, onSuccess }: NovoProjetoModalProps) {
  const { user } = useAuth();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);

  const salvarProjeto = async () => {
    if (!nome.trim()) {
      Alert.alert('Erro', 'O nome do projeto é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('projetos').insert({
        nome: nome.trim(),
        descricao: descricao.trim(),
        user_id: user?.id,
        data_inicio: dataInicio,
        data_fim: dataFim,
        status: 'ativo',
      });

      if (error) throw error;

      Alert.alert('Sucesso', 'Projeto criado com sucesso!');
      setNome('');
      setDataInicio(new Date().toISOString().split('T')[0]);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
      Alert.alert('Erro', 'Não foi possível criar o projeto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Novo Projeto</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
              <Ionicons name="close-circle" size={28} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Nome do projeto"
            value={nome}
            onChangeText={setNome}
          />

          <TextInput
            style={styles.input}
            placeholder="Descrição do projeto"
            value={descricao}
            onChangeText={setDescricao}
          />

          <View style={styles.section}>
            <Text style={styles.label}>Data de Início *</Text>
            <TextInput
              style={styles.input}
              value={dataInicio}
              onChangeText={setDataInicio}
              placeholder="YYYY-MM-DD"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Data de Fim *</Text>
            <TextInput
              style={styles.input}
              value={dataFim}
              onChangeText={setDataFim}
              placeholder="YYYY-MM-DD"
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={salvarProjeto} disabled={loading}>
            <Text style={styles.saveButtonText}>{loading ? 'Salvando...' : 'Salvar'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeIcon: {
    padding: 4,
  },
  input: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#111827',
  },
  section: {
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 6,
  },
  saveButton: {
    marginTop: 30,
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
