import React, { useState, useEffect } from 'react';
import { FlatList, View, StyleSheet, TouchableOpacity, Image, Linking, Alert } from 'react-native';
import { TextInput, Button, Text, Appbar, useTheme, IconButton, Portal, Dialog, Avatar } from 'react-native-paper';
import { database, storage } from '../config/Firebase';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import EmojiSelector, { Categories } from 'react-native-emoji-selector'; // <-- Importação do EmojiSelector

function gerarIdConversa(id1, id2) {
  return [id1, id2].sort().join('_');
}

const TEMPO_LIMITE_APAGAR_TODOS = 2 * 60 * 1000; // 2 minutos

export default function Mensagens({ usuario, contato, voltar }) {
  const [mensagem, setMensagem] = useState('');
  const [listaMensagens, setListaMensagens] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [editando, setEditando] = useState(false);
  const [modalApagar, setModalApagar] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [dialogMenuVisivel, setDialogMenuVisivel] = useState(false);
  const [modalSolicitarLimpeza, setModalSolicitarLimpeza] = useState(false);
  const [modalPerfilVisivel, setModalPerfilVisivel] = useState(false);
  const [perfilContato, setPerfilContato] = useState(null);
  const [mostrarEmoji, setMostrarEmoji] = useState(false); // <-- Estado para mostrar o EmojiSelector
  const theme = useTheme();

  const idContato = contato.key || contato.id;
  const idConversa = gerarIdConversa(usuario.id, idContato);

  useEffect(() => {
    const ref = database.ref(`/conversas/${idConversa}/mensagens`);
    const atualizar = (snap) => {
      const dados = snap.val();
      if (dados) {
        const arr = Object.entries(dados).map(([id, msg]) => ({ id, ...msg }));
        setListaMensagens(arr);

        arr.forEach(msg => {
          if (
            msg.idAutor !== usuario.id &&
            (!msg.lidoPor || !msg.lidoPor[usuario.id])
          ) {
            database.ref(`/conversas/${idConversa}/mensagens/${msg.id}/lidoPor/${usuario.id}`).set(true);
          }
        });
      } else {
        setListaMensagens([]);
      }
    };
    ref.on('value', atualizar);
    return () => ref.off('value', atualizar);
  }, [idConversa, usuario.id]);

  async function enviarMensagem() {
    if (!mensagem.trim()) return;
    if (editando && selecionadas.length === 1) {
      await database.ref(`/conversas/${idConversa}/mensagens/${selecionadas[0]}`).update({
        conteudo: mensagem,
        editada: true
      });
      setEditando(false);
      setSelecionadas([]);
      setMensagem('');
      return;
    }
    const novaRef = database.ref(`/conversas/${idConversa}/mensagens`).push();
    const novaMsg = {
      autor: usuario.apelido,
      idAutor: usuario.id,
      conteudo: mensagem,
      horario: Date.now(),
      apagadaPor: {},
      apagadaParaTodos: false,
      lidoPor: { [usuario.id]: true }
    };
    await novaRef.set(novaMsg);
    setMensagem('');
  }

  async function escolherEEnviarArquivo() {
    try {
      setEnviandoArquivo(true);

      let img = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
      if (!img.canceled && img.assets && img.assets[0]) {
        const fileUri = img.assets[0].uri;
        const fileInfo = await fetch(fileUri);
        const blob = await fileInfo.blob();

        if (blob.size > 64 * 1024 * 1024) {
          Alert.alert('Arquivo muito grande', 'O limite é 64MB por arquivo.');
          setEnviandoArquivo(false);
          return;
        }

        const nomeArquivo = `${Date.now()}-image.jpg`;
        const ref = storage.ref().child(`uploads/${nomeArquivo}`);
        await ref.put(blob).catch(e => {
          Alert.alert('Erro no upload', e.message);
        });
        const url = await ref.getDownloadURL();

        await database.ref(`/conversas/${idConversa}/mensagens`).push({
          autor: usuario.apelido,
          idAutor: usuario.id,
          horario: Date.now(),
          tipoArquivo: 'image',
          urlArquivo: url,
          apagadaPor: {},
          apagadaParaTodos: false,
          lidoPor: { [usuario.id]: true }
        });
        setEnviandoArquivo(false);
        return;
      }

      let doc = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'] });
      if (doc.type === 'success') {
        const response = await fetch(doc.uri);
        const blob = await response.blob();

        if (blob.size > 64 * 1024 * 1024) {
          Alert.alert('Arquivo muito grande', 'O limite é 64MB por arquivo.');
          setEnviandoArquivo(false);
          return;
        }

        const nomeArquivo = `${Date.now()}-pdf.pdf`;
        const ref = storage.ref().child(`uploads/${nomeArquivo}`);
        await ref.put(blob);
        const url = await ref.getDownloadURL();

        await database.ref(`/conversas/${idConversa}/mensagens`).push({
          autor: usuario.apelido,
          idAutor: usuario.id,
          horario: Date.now(),
          tipoArquivo: 'pdf',
          urlArquivo: url,
          nomeArquivo: doc.name,
          apagadaPor: {},
          apagadaParaTodos: false,
          lidoPor: { [usuario.id]: true }
        });
      }
      setEnviandoArquivo(false);
    } catch (e) {
      setEnviandoArquivo(false);
      Alert.alert('Erro ao enviar arquivo', e.message || 'Tente novamente.');
    }
  }

  async function apagarMensagensParaMim() {
    await Promise.all(selecionadas.map(msgId =>
      database.ref(`/conversas/${idConversa}/mensagens/${msgId}/apagadaPor/${usuario.id}`).set(true)
    ));
    setSelecionadas([]);
    setEditando(false);
    setModalApagar(false);
    setMensagem('');
  }

  async function apagarMensagensParaTodos() {
    await Promise.all(selecionadas.map(msgId =>
      database.ref(`/conversas/${idConversa}/mensagens/${msgId}`).update({
        conteudo: '',
        apagadaParaTodos: true,
        editada: false
      })
    ));
    setSelecionadas([]);
    setEditando(false);
    setModalApagar(false);
    setMensagem('');
  }

  function podeApagarParaTodos() {
    const agora = Date.now();
    return selecionadas.every(msgId => {
      const msg = listaMensagens.find(m => m.id === msgId);
      return msg && (agora - msg.horario <= TEMPO_LIMITE_APAGAR_TODOS);
    });
  }

  function mensagemAvisoApagarTodos() {
    if (selecionadas.length === 0) return '';
    const agora = Date.now();
    const msgsInvalidas = selecionadas.filter(msgId => {
      const msg = listaMensagens.find(m => m.id === msgId);
      return !(msg && (agora - msg.horario <= TEMPO_LIMITE_APAGAR_TODOS));
    });
    if (msgsInvalidas.length > 0) {
      return 'Só é possível apagar para todos mensagens enviadas nos últimos 2 minutos.';
    }
    return '';
  }

  // ----------- DIFERENCIAL CRIATIVO -----------
  async function solicitarLimpezaParaAmbos() {
    await database.ref(`/conversas/${idConversa}/mensagens`).push({
      tipo: 'solicitacao_limpeza',
      solicitante: usuario.id,
      nomeSolicitante: usuario.apelido,
      horario: Date.now(),
      lidoPor: { [usuario.id]: true }
    });
    setModalSolicitarLimpeza(false);
    Alert.alert('Solicitação enviada', 'Aguarde o outro usuário aceitar ou negar.');
  }

  async function aceitarLimpeza(item) {
    await database.ref(`/conversas/${idConversa}/mensagens`).remove();
    await database.ref(`/conversas/${idConversa}/mensagens`).push({
      tipo: 'info',
      conteudo: 'A conversa foi apagada para ambos os usuários.',
      horario: Date.now()
    });
  }

  async function negarLimpeza(item) {
    await database.ref(`/conversas/${idConversa}/mensagens`).push({
      tipo: 'info',
      conteudo: `${usuario.apelido} recusou a solicitação de apagar a conversa.`,
      horario: Date.now()
    });
  }
  // --------------------------------------------

  // PERFIL DO CONTATO
  async function abrirPerfilContato() {
    const snap = await database.ref(`/usuarios/${idContato}`).once('value');
    setPerfilContato(snap.val());
    setModalPerfilVisivel(true);
  }

  function renderizarStatus(item) {
    if (item.idAutor !== usuario.id) return null;
    const totalParticipantes = 2;
    const lidoPor = item.lidoPor ? Object.keys(item.lidoPor).length : 0;
    if (lidoPor >= totalParticipantes) {
      return (
        <Text style={estilos.statusLido}>
          ✔✔
        </Text>
      );
    } else {
      return (
        <Text style={estilos.statusEnviado}>
          ✔
        </Text>
      );
    }
  }

  function renderizarItem({ item }) {
    if (item.tipo === 'solicitacao_limpeza') {
      const souSolicitante = item.solicitante === usuario.id;
      if (!souSolicitante) {
        return (
          <View style={[estilos.linhaMensagem, estilos.mensagemEsquerda]}>
            <View style={[estilos.card, { backgroundColor: '#232323', alignSelf: 'flex-start' }]}>
              <Text style={{ color: '#fff', marginBottom: 8 }}>
                {item.nomeSolicitante} solicitou apagar toda a conversa para ambos. Aceitar?
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Button
                  mode="contained"
                  color="#e53935"
                  style={{ marginRight: 8 }}
                  onPress={() => aceitarLimpeza(item)}
                >
                  Aceitar
                </Button>
                <Button
                  mode="outlined"
                  color="#888"
                  onPress={() => negarLimpeza(item)}
                >
                  Negar
                </Button>
              </View>
            </View>
          </View>
        );
      } else {
        return (
          <View style={[estilos.linhaMensagem, estilos.mensagemDireita]}>
            <View style={[estilos.card, { backgroundColor: '#222', alignSelf: 'flex-end' }]}>
              <Text style={{ color: '#bbb', fontStyle: 'italic' }}>
                Aguardando resposta do outro usuário para apagar toda a conversa.
              </Text>
            </View>
          </View>
        );
      }
    }
    if (item.tipo === 'info') {
      return (
        <View style={[estilos.linhaMensagem, estilos.mensagemEsquerda]}>
          <View style={[estilos.card, { backgroundColor: '#232323', alignSelf: 'center' }]}>
            <Text style={{ color: '#bbb', fontStyle: 'italic', textAlign: 'center' }}>
              {item.conteudo}
            </Text>
          </View>
        </View>
      );
    }

    const souEu = item.idAutor === usuario.id;
    const foiApagadaParaMim = item.apagadaPor && typeof item.apagadaPor === 'object' && item.apagadaPor[usuario.id];
    const foiApagadaParaTodos = !!item.apagadaParaTodos;

    if (foiApagadaParaMim) return null;

    if (foiApagadaParaTodos) {
      return (
        <View style={[
          estilos.linhaMensagem,
          souEu ? estilos.mensagemDireita : estilos.mensagemEsquerda
        ]}>
          <View style={[
            estilos.card,
            {
              backgroundColor: '#222',
              alignSelf: souEu ? 'flex-end' : 'flex-start'
            }
          ]}>
            <Text style={{ color: '#888', fontStyle: 'italic', padding: 8 }}>Mensagem apagada</Text>
          </View>
        </View>
      );
    }

    const selecionada = selecionadas.includes(item.id);

    if (item.tipoArquivo === 'image') {
      return (
        <View style={[
          estilos.linhaMensagem,
          souEu ? estilos.mensagemDireita : estilos.mensagemEsquerda
        ]}>
          <TouchableOpacity
            onLongPress={() => {
              if (souEu) {
                if (selecionadas.length === 0) {
                  setSelecionadas([item.id]);
                }
              }
            }}
            onPress={() => {
              if (souEu && selecionadas.length > 0) {
                if (selecionadas.includes(item.id)) {
                  setSelecionadas(selecionadas.filter(id => id !== item.id));
                } else {
                  setSelecionadas([...selecionadas, item.id]);
                }
              }
            }}
            activeOpacity={0.8}
            style={[
              estilos.card,
              {
                backgroundColor: souEu ? '#e0e0e0' : '#232323',
                alignSelf: souEu ? 'flex-end' : 'flex-start',
                borderTopLeftRadius: souEu ? 16 : 6,
                borderTopRightRadius: souEu ? 6 : 16,
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16,
                minWidth: 60,
                maxWidth: '80%',
                marginBottom: 2,
                marginTop: 2,
                borderWidth: selecionada ? 2 : 0,
                borderColor: selecionada ? '#2196f3' : 'transparent',
                opacity: selecionada ? 0.7 : 1
              }
            ]}
          >
            <Image source={{ uri: item.urlArquivo }} style={{ width: 160, height: 160, borderRadius: 12 }} />
            <View style={estilos.linhaRodape}>
              <Text style={[
                estilos.horario,
                { color: souEu ? '#888' : '#bbb' }
              ]}>
                {new Date(item.horario).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {renderizarStatus(item)}
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    if (item.tipoArquivo === 'pdf') {
      return (
        <View style={[
          estilos.linhaMensagem,
          souEu ? estilos.mensagemDireita : estilos.mensagemEsquerda
        ]}>
          <TouchableOpacity
            onLongPress={() => {
              if (souEu) {
                if (selecionadas.length === 0) {
                  setSelecionadas([item.id]);
                }
              }
            }}
            onPress={() => {
              if (souEu && selecionadas.length > 0) {
                if (selecionadas.includes(item.id)) {
                  setSelecionadas(selecionadas.filter(id => id !== item.id));
                } else {
                  setSelecionadas([...selecionadas, item.id]);
                }
              }
            }}
            activeOpacity={0.8}
            style={[
              estilos.card,
              {
                backgroundColor: souEu ? '#e0e0e0' : '#232323',
                alignSelf: souEu ? 'flex-end' : 'flex-start',
                borderTopLeftRadius: souEu ? 16 : 6,
                borderTopRightRadius: souEu ? 6 : 16,
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16,
                minWidth: 60,
                maxWidth: '80%',
                marginBottom: 2,
                marginTop: 2,
                borderWidth: selecionada ? 2 : 0,
                borderColor: selecionada ? '#2196f3' : 'transparent',
                opacity: selecionada ? 0.7 : 1
              }
            ]}
          >
            <Button
              icon="file-pdf"
              mode="contained"
              color={souEu ? "#2196f3" : "#e53935"}
              onPress={() => Linking.openURL(item.urlArquivo)}
              style={{ marginBottom: 4 }}
              labelStyle={{ color: "#fff" }}
            >
              {item.nomeArquivo || "Abrir PDF"}
            </Button>
            <View style={estilos.linhaRodape}>
              <Text style={[
                estilos.horario,
                { color: souEu ? '#888' : '#bbb' }
              ]}>
                {new Date(item.horario).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {renderizarStatus(item)}
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[
        estilos.linhaMensagem,
        souEu ? estilos.mensagemDireita : estilos.mensagemEsquerda
      ]}>
        <TouchableOpacity
          onLongPress={() => {
            if (souEu) {
              if (selecionadas.length === 0) {
                setSelecionadas([item.id]);
              }
            }
          }}
          onPress={() => {
            if (souEu && selecionadas.length > 0) {
              if (selecionadas.includes(item.id)) {
                setSelecionadas(selecionadas.filter(id => id !== item.id));
              } else {
                setSelecionadas([...selecionadas, item.id]);
              }
            }
          }}
          activeOpacity={0.8}
          style={[
            estilos.card,
            {
              backgroundColor: souEu ? '#e0e0e0' : '#232323',
              alignSelf: souEu ? 'flex-end' : 'flex-start',
              borderTopLeftRadius: souEu ? 16 : 6,
              borderTopRightRadius: souEu ? 6 : 16,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              minWidth: 60,
              maxWidth: '80%',
              marginBottom: 2,
              marginTop: 2,
              borderWidth: selecionada ? 2 : 0,
              borderColor: selecionada ? '#2196f3' : 'transparent',
              opacity: selecionada ? 0.7 : 1
            }
          ]}
        >
          <Text style={{ color: souEu ? '#181818' : '#fff', fontSize: 16 }}>
            {item.conteudo}
            {item.editada && !item.apagadaParaTodos && <Text style={{ fontSize: 10, color: '#888' }}> (editada)</Text>}
          </Text>
          <View style={estilos.linhaRodape}>
            <Text style={[
              estilos.horario,
              { color: souEu ? '#888' : '#bbb' }
            ]}>
              {new Date(item.horario).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {renderizarStatus(item)}
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  useEffect(() => {
    return () => {
      setSelecionadas([]);
      setEditando(false);
      setMensagem('');
    };
  }, []);

  useEffect(() => {
    if (editando && selecionadas.length === 1) {
      const msg = listaMensagens.find(m => m.id === selecionadas[0]);
      if (msg) setMensagem(msg.conteudo);
    }
  }, [editando, selecionadas, listaMensagens]);

  return (
    <View style={[estilos.container, { backgroundColor: '#181818' }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={voltar} />
        <TouchableOpacity onPress={abrirPerfilContato}>
          {contato.fotoUrl ? (
            <Image
              source={{ uri: contato.fotoUrl }}
              style={{ width: 36, height: 36, borderRadius: 18, marginRight: 8, backgroundColor: '#444' }}
            />
          ) : (
            <View style={{
              width: 36, height: 36, borderRadius: 18, marginRight: 8,
              backgroundColor: '#444', alignItems: 'center', justifyContent: 'center'
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>
                {contato.apelido ? contato.apelido[0].toUpperCase() : '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <Appbar.Content title={contato.apelido} />
        <Appbar.Action
          icon="dots-vertical"
          color="#fff"
          onPress={() => setDialogMenuVisivel(true)}
        />
        {selecionadas.length > 0 && (
          <>
            <IconButton
              icon="delete"
              color="#e53935"
              onPress={() => setModalApagar(true)}
            />
            <IconButton
              icon="pencil"
              color="#2196f3"
              onPress={() => setEditando(true)}
              disabled={editando || selecionadas.length !== 1}
            />
            <IconButton
              icon="close"
              color="#bbb"
              onPress={() => {
                setSelecionadas([]);
                setEditando(false);
                setMensagem('');
              }}
            />
          </>
        )}
      </Appbar.Header>
      <FlatList
        data={listaMensagens.sort((a, b) => a.horario - b.horario)}
        renderItem={renderizarItem}
        keyExtractor={item => item.id}
        style={estilos.lista}
        contentContainerStyle={{ paddingBottom: 80 }}
        inverted={false}
      />
      <View style={estilos.rodape}>
        <IconButton
          icon="emoticon-outline"
          size={28}
          onPress={() => setMostrarEmoji(!mostrarEmoji)}
        />
        <IconButton
          icon="paperclip"
          size={28}
          onPress={escolherEEnviarArquivo}
          disabled={enviandoArquivo}
        />
        <TextInput
          label={editando ? "Editar mensagem" : "Mensagem"}
          value={mensagem}
          onChangeText={setMensagem}
          style={estilos.input}
          theme={{ colors: { text: '#fff', primary: '#fff', placeholder: '#bbb', background: '#232323' } }}
        />
        <Button
          mode="contained"
          onPress={enviarMensagem}
          style={estilos.botao}
          color="#e0e0e0"
          labelStyle={{ color: "#181818" }}
          disabled={enviandoArquivo}
        >
          {editando ? "Salvar" : "Enviar"}
        </Button>
      </View>
      {mostrarEmoji && (
        <EmojiSelector
          category={Categories.ALL}
          onEmojiSelected={emoji => {
            setMensagem(mensagem + emoji);
            setMostrarEmoji(false);
          }}
          showSearchBar={false}
          showTabs={true}
          columns={8}
          theme={{
            container: { backgroundColor: '#232323' },
            emoji: { fontSize: 28 },
            category: { color: '#2196f3' }
          }}
        />
      )}
      <Portal>
        {/* Modal de perfil do contato */}
        <Dialog visible={modalPerfilVisivel} onDismiss={() => setModalPerfilVisivel(false)}>
          <Dialog.Title>Perfil</Dialog.Title>
          <Dialog.Content>
            {perfilContato && (
              <View style={{ alignItems: 'center' }}>
                {perfilContato.fotoUrl ? (
                  <Image source={{ uri: perfilContato.fotoUrl }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 8 }} />
                ) : (
                  <Avatar.Icon size={80} icon="account" style={{ marginBottom: 8 }} />
                )}
                <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 4 }}>{perfilContato.apelido}</Text>
                <Text style={{ color: '#888', marginBottom: 4 }}>{perfilContato.status || ''}</Text>
                <Text style={{ color: '#bbb', textAlign: 'center' }}>{perfilContato.sobre || ''}</Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setModalPerfilVisivel(false)} color="#2196f3">Fechar</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={modalApagar} onDismiss={() => setModalApagar(false)}>
          <Dialog.Title>Apagar mensagem</Dialog.Title>
          <Dialog.Content>
            <Text>Deseja apagar {selecionadas.length > 1 ? 'essas mensagens' : 'essa mensagem'}?</Text>
            {mensagemAvisoApagarTodos() !== '' && (
              <Text style={{ color: '#e53935', marginTop: 8 }}>{mensagemAvisoApagarTodos()}</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={apagarMensagensParaMim}  color='#2196f3'>Apagar para mim</Button>
            <Button
              onPress={apagarMensagensParaTodos}
              color="#e53935"
              disabled={!podeApagarParaTodos()}
            >
              Apagar para todos
            </Button>
            <Button onPress={() => setModalApagar(false)} color="#888">Cancelar</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={modalSolicitarLimpeza} onDismiss={() => setModalSolicitarLimpeza(false)}>
          <Dialog.Title>Solicitar limpeza</Dialog.Title>
          <Dialog.Content>
            <Text>Deseja solicitar que toda a conversa seja apagada para ambos os usuários?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setModalSolicitarLimpeza(false)} color="#888">Cancelar</Button>
            <Button onPress={solicitarLimpezaParaAmbos} color="#e53935">Solicitar</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={dialogMenuVisivel} onDismiss={() => setDialogMenuVisivel(false)}>
          <Dialog.Title>Opções</Dialog.Title>
          <Dialog.Content>
            <Button
              onPress={() => {
                setDialogMenuVisivel(false);
                setModalSolicitarLimpeza(true);
              }}
              icon="skull"
              color="#e53935"
            >
              Solicitar limpar conversa para ambos
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogMenuVisivel(false)} color="#2196f3">Fechar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1 },
  lista: { flex: 1, padding: 10 },
  rodape: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  input: { flex: 1, marginRight: 8, backgroundColor: '#232323' },
  botao: { alignSelf: 'center', backgroundColor: '#e0e0e0' },
  linhaMensagem: { flexDirection: 'row', marginBottom: 2, alignItems: 'flex-end' },
  mensagemDireita: { justifyContent: 'flex-end' },
  mensagemEsquerda: { justifyContent: 'flex-start' },
  card: {
    padding: 10,
    minWidth: 60,
    maxWidth: '80%',
    borderRadius: 16,
    marginBottom: 2,
    marginTop: 2,
  },
  autor: { fontWeight: 'bold', marginBottom: 2 },
  horario: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  linhaRodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusEnviado: { fontSize: 14, color: '#888', marginLeft: 6 },
  statusLido: { fontSize: 14, color: '#2196f3', marginLeft: 6 }
});