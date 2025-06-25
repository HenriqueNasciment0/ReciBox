import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import uuid from 'react-native-uuid';
import NovoProjetoModal from './NovoProjetoModal';

interface Projeto {
  id: string;
  nome: string;
}

interface Categoria {
  id: string;
  nome: string;
  cor: string;
  icone: string;
}

interface NovoGastoModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  gastoParaEditar?: any;
}

export default function NovoGastoModal({
  visible,
  onClose,
  onSuccess,
  gastoParaEditar,
}: NovoGastoModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [projetoId, setProjetoId] = useState('');
  const [novoProjetoModalVisible, setNovoProjetoModalVisible] = useState(false);
  const [categoriaId, setCategoriaId] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [dataGasto, setDataGasto] = useState(new Date().toISOString().split('T')[0]);
  const [imagens, setImagens] = useState<Array<{ id: string; uri: string; isUploaded?: boolean }>>(
    []
  );
  const [imagemViewerVisible, setImagemViewerVisible] = useState(false);
  const [imagemSelecionada, setImagemSelecionada] = useState<string | null>(null);

  const [isEdicao, setIsEdicao] = useState(false);

  useEffect(() => {
    if (visible && user) {
      carregarDados();
    }
  }, [visible, user]);

  const gerarUrlSegura = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('arquivos')
        .createSignedUrl(path, 60 * 60);

      if (error) {
        console.error('Erro ao gerar URL segura:', error);
        return null;
      }

      return data?.signedUrl;
    } catch (error) {
      console.error('Erro inesperado ao gerar URL:', error);
      return null;
    }
  };

  useEffect(() => {
    const carregarGastoParaEdicao = async () => {
      if (gastoParaEditar) {
        setIsEdicao(true);
        setProjetoId(gastoParaEditar.projeto_id || '');
        setCategoriaId(gastoParaEditar.categoria_id || '');
        setValor(gastoParaEditar.valor?.toString().replace('.', ',') || '');
        setDescricao(gastoParaEditar.descricao || '');
        setObservacoes(gastoParaEditar.observacoes || '');
        setDataGasto(
          formatarDataParaExibicao(gastoParaEditar.data_gasto) ||
            new Date().toISOString().split('T')[0]
        );

        if (gastoParaEditar.imagens) {
          try {
            const imagensExistentes = JSON.parse(gastoParaEditar.imagens);

            const imagensCarregadas = [];

            for (const img of imagensExistentes) {
              let urlImagem = null;

              if (img.path) {
                urlImagem = await gerarUrlSegura(img.path);
              }

              if (urlImagem) {
                imagensCarregadas.push({
                  id: uuid.v4().toString(),
                  uri: urlImagem,
                  isUploaded: true,
                  originalData: img,
                });
              } else {
                console.log('Falha ao carregar imagem:', img);
              }
            }

            setImagens(imagensCarregadas);
          } catch (error) {
            console.error('Erro ao carregar imagens:', error);
            setImagens([]);
          }
        } else {
          setImagens([]);
        }
      } else {
        setIsEdicao(false);
        limparFormulario();
      }
    };

    if (visible && user) {
      carregarGastoParaEdicao();
    }
  }, [gastoParaEditar, visible, user]);

  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        limparFormulario();
      }, 300);
    }
  }, [visible]);

  const carregarDados = async () => {
    try {
      const { data: projetosData } = await supabase
        .from('projetos')
        .select('id, nome')
        .eq('user_id', user?.id)
        .eq('status', 'ativo')
        .order('nome');

      const { data: categoriasData } = await supabase
        .from('categorias')
        .select('id, nome, cor, icone')
        .eq('user_id', user?.id)
        .order('nome');

      setProjetos(projetosData || []);
      setCategorias(categoriasData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const adicionarImagem = async () => {
    if (imagens.length >= 3) {
      Alert.alert('Limite atingido', 'Você pode adicionar no máximo 5 fotos');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos');
        return;
      }

      Alert.alert('Selecionar Foto', 'Como você quer adicionar a foto do recibo?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Câmera', onPress: () => abrirCamera() },
        { text: 'Galeria', onPress: () => abrirGaleria() },
      ]);
    } catch (error) {
      console.error('Erro ao solicitar permissões:', error);
    }
  };

  const abrirCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para usar a câmera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        const novaImagem = {
          id: uuid.v4().toString(),
          uri: result.assets[0].uri,
          isUploaded: false,
        };
        setImagens((prev) => [...prev, novaImagem]);
      }
    } catch (error) {
      console.error('Erro ao abrir a câmera:', error);
      Alert.alert('Erro', 'Não foi possível abrir a câmera.');
    }
  };

  const abrirGaleria = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images' as any,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const novaImagem = {
          id: uuid.v4().toString(),
          uri: result.assets[0].uri,
          isUploaded: false,
        };
        setImagens((prev) => [...prev, novaImagem]);
      }
    } catch (error) {
      console.error('Erro ao abrir galeria:', error);
    }
  };

  const removerImagem = (imagemId: string) => {
    Alert.alert('Remover Foto', 'Tem certeza que deseja remover esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          setImagens((prev) => prev.filter((img) => img.id !== imagemId));
        },
      },
    ]);
  };

  const visualizarImagem = (uri: string) => {
    setImagemSelecionada(uri);
    setImagemViewerVisible(true);
  };

  const uploadImagens = async (): Promise<
    Array<{ url: string; path: string; nome: string; size: number | null }>
  > => {
    const imagensUpload = [];

    for (const imagem of imagens) {
      if (!imagem.isUploaded && imagem.uri && !imagem.uri.startsWith('http')) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(imagem.uri);
          if (!fileInfo.exists) continue;

          const fileName = `${user?.id}/${uuid.v4()}.jpg`;
          const base64 = await FileSystem.readAsStringAsync(imagem.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const { data, error } = await supabase.storage
            .from('arquivos')
            .upload(fileName, decode(base64), {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (!error && data) {
            const { data: urlData } = supabase.storage.from('arquivos').getPublicUrl(fileName);

            imagensUpload.push({
              url: urlData.publicUrl,
              path: fileName,
              nome: fileName.split('/').pop() || '',
              size: fileInfo.exists && 'size' in fileInfo ? (fileInfo.size as number) : null,
            });
          }
        } catch (error) {
          console.error('Erro ao fazer upload da imagem:', error);
        }
      }
    }

    return imagensUpload;
  };

  const decode = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const salvarGasto = async () => {
    if (!projetoId || !valor) {
      Alert.alert('Erro', 'Preencha pelo menos o projeto e o valor');
      return;
    }

    setLoading(true);

    try {
      const imagensUploadadas = await uploadImagens();

      interface ImagemUploadada {
        url: string;
        path: string;
        nome: string;
        size: number | null;
      }

      let todasImagens: ImagemUploadada[] = [];

      if (isEdicao) {
        const imagensExistentes = imagens
          .filter((img) => img.isUploaded && (img as any).originalData)
          .map((img) => (img as any).originalData);

        todasImagens = [...imagensExistentes];
      }

      todasImagens = [...todasImagens, ...imagensUploadadas];

      const dadosGasto = {
        projeto_id: projetoId,
        categoria_id: categoriaId || null,
        valor: parseFloat(valor.replace(',', '.')),
        data_gasto: dataGasto,
        descricao: descricao.trim() || null,
        observacoes: observacoes.trim() || null,
        imagens: JSON.stringify(todasImagens),
        updated_at: new Date().toISOString(),
      };

      let error;
      if (isEdicao && gastoParaEditar) {
        const result = await supabase
          .from('gastos')
          .update(dadosGasto)
          .eq('id', gastoParaEditar.id)
          .eq('user_id', user?.id);
        error = result.error;
      } else {
        const result = await supabase.from('gastos').insert({
          ...dadosGasto,
          user_id: user?.id,
        });
        error = result.error;
      }

      if (error) throw error;

      Alert.alert(
        'Sucesso',
        isEdicao ? 'Gasto atualizado com sucesso!' : 'Gasto adicionado com sucesso!'
      );

      limparFormulario();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar gasto:', error);
      Alert.alert('Erro', 'Não foi possível salvar o gasto');
    } finally {
      setLoading(false);
    }
  };

  const limparFormulario = () => {
    setProjetoId('');
    setCategoriaId('');
    setValor('');
    setDescricao('');
    setObservacoes('');
    setDataGasto(new Date().toISOString().split('T')[0]);
    setImagens([]);
    setIsEdicao(false);
  };

  const formatarValor = (text: string) => {
    const cleanText = text.replace(/[^0-9,]/g, '');
    setValor(cleanText);
  };

  const formatarDataParaExibicao = (data: string) => {
    if (data.includes('T')) {
      return data.split('T')[0];
    }
    return data;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.title}>Novo Gasto</Text>
          <TouchableOpacity
            onPress={salvarGasto}
            disabled={loading || !projetoId || !valor}
            style={[styles.saveButton, (!projetoId || !valor) && styles.saveButtonDisabled]}
          >
            <Text
              style={[
                styles.saveButtonText,
                (!projetoId || !valor) && styles.saveButtonTextDisabled,
              ]}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Foto do Recibo */}
          <View style={styles.section}>
            <Text style={styles.label}>Fotos do Recibo</Text>

            {/* Grid de Imagens */}
            <View style={styles.imagensGrid}>
              {imagens.map((imagem, index) => (
                <View key={imagem.id} style={styles.imagemContainer}>
                  <TouchableOpacity
                    onPress={() => visualizarImagem(imagem.uri)}
                    style={styles.imagemTouchable}
                  >
                    <Image source={{ uri: imagem.uri }} style={styles.imagemMiniatura} />
                  </TouchableOpacity>

                  {/* Botão de remover */}
                  <TouchableOpacity
                    style={styles.botaoRemover}
                    onPress={() => removerImagem(imagem.id)}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>

                  {/* Indicador de posição */}
                  <View style={styles.indicadorPosicao}>
                    <Text style={styles.textoPosicao}>{index + 1}</Text>
                  </View>
                </View>
              ))}

              {/* Botão para adicionar nova imagem */}
              {imagens.length < 3 && (
                <TouchableOpacity style={styles.botaoAdicionar} onPress={adicionarImagem}>
                  <Ionicons name="add" size={32} color="#6B7280" />
                  <Text style={styles.textoAdicionar}>Adicionar{'\n'}Foto</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Informação sobre limite */}
            <Text style={styles.infoLimite}>
              {imagens.length}/3 fotos • Toque na foto para visualizar
            </Text>
          </View>

          {/* Projeto */}
          <View style={styles.section}>
            <Text style={styles.label}>Projeto *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.optionsContainer}>
                {projetos.map((projeto) => (
                  <TouchableOpacity
                    key={projeto.id}
                    style={[
                      styles.optionButton,
                      projetoId === projeto.id && styles.optionButtonSelected,
                    ]}
                    onPress={() => setProjetoId(projeto.id)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        projetoId === projeto.id && styles.optionTextSelected,
                      ]}
                    >
                      {projeto.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setNovoProjetoModalVisible(true)}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color="#2563EB"
                style={{ marginRight: 4 }}
              />
              <Text style={{ color: '#2563EB', fontSize: 14 }}>Criar novo projeto</Text>
            </TouchableOpacity>
          </View>

          {/* Categoria */}
          <View style={styles.section}>
            <Text style={styles.label}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.optionsContainer}>
                {categorias.map((categoria) => (
                  <TouchableOpacity
                    key={categoria.id}
                    style={[
                      styles.categoryButton,
                      categoriaId === categoria.id && styles.categoryButtonSelected,
                      { borderColor: categoria.cor },
                    ]}
                    onPress={() => setCategoriaId(categoria.id)}
                  >
                    <View style={[styles.categoryColor, { backgroundColor: categoria.cor }]} />
                    <Text
                      style={[
                        styles.categoryText,
                        categoriaId === categoria.id && styles.categoryTextSelected,
                      ]}
                    >
                      {categoria.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Valor */}
          <View style={styles.section}>
            <Text style={styles.label}>Valor *</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currency}>R$</Text>
              <TextInput
                style={styles.input}
                value={valor}
                onChangeText={formatarValor}
                placeholder="0,00"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Data */}
          <View style={styles.section}>
            <Text style={styles.label}>Data do Gasto</Text>
            <TextInput
              style={styles.input}
              value={dataGasto}
              onChangeText={setDataGasto}
              placeholder="YYYY-MM-DD"
            />
          </View>

          {/* Descrição */}
          <View style={styles.section}>
            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={styles.input}
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Ex: Almoço, Combustível, Hotel..."
            />
          </View>

          {/* Observações */}
          <View style={styles.section}>
            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={observacoes}
              onChangeText={setObservacoes}
              placeholder="Observações adicionais..."
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        <NovoProjetoModal
          visible={novoProjetoModalVisible}
          onClose={() => setNovoProjetoModalVisible(false)}
          onSuccess={() => {
            setNovoProjetoModalVisible(false);
            carregarDados();
          }}
        />

        <Modal
          visible={imagemViewerVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setImagemViewerVisible(false)}
        >
          <View style={styles.modalVisualizacao}>
            <TouchableOpacity
              style={styles.fundoModal}
              activeOpacity={1}
              onPress={() => setImagemViewerVisible(false)}
            >
              <View style={styles.containerImagem}>
                {imagemSelecionada && (
                  <Image
                    source={{ uri: imagemSelecionada }}
                    style={styles.imagemCompleta}
                    resizeMode="contain"
                  />
                )}

                <TouchableOpacity
                  style={styles.botaoFechar}
                  onPress={() => setImagemViewerVisible(false)}
                >
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#9CA3AF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  imageContainer: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: '#9CA3AF',
    fontSize: 14,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  optionButtonSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  optionText: {
    color: '#374151',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    gap: 8,
  },
  categoryButtonSelected: {
    backgroundColor: '#F0F9FF',
  },
  categoryColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryText: {
    color: '#374151',
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  currency: {
    paddingLeft: 12,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  imagensGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  imagemContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  imagemTouchable: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagemMiniatura: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
  },
  botaoRemover: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  indicadorPosicao: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoPosicao: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  botaoAdicionar: {
    width: 80,
    height: 80,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  textoAdicionar: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 12,
  },
  infoLimite: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  modalVisualizacao: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fundoModal: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerImagem: {
    width: '90%',
    height: '80%',
    position: 'relative',
  },
  imagemCompleta: {
    width: '100%',
    height: '100%',
  },
  botaoFechar: {
    position: 'absolute',
    top: -50,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
