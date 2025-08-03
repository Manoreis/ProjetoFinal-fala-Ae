import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Appbar, TextInput, Button, Text, IconButton, Avatar, Portal, Dialog } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import EmojiSelector, { Categories } from 'react-native-emoji-selector';
import { database, storage } from '../config/Firebase';

export default function MensagensGrupo({ usuario, grupo, voltar }) {
  const [mensagem, setMensagem] = useState('');
  const [listaMensagens, setListaMensagens] = useState([]);
  const [infoGrupo, setInfoGrupo] = useState(grupo.info || {});
  const [modalEditarGrupo, setModalEditarGrupo] = useState(false);
  const [novoNomeGrupo, setNovoNomeGrupo] = useState(infoGrupo.nomeGrupo || '');
  const [novaFotoGrupo, setNovaFotoGrupo] = useState(infoGrupo.fotoGrupo || null);
  const [feedback, setFeedback] = useState('');
  const [editando, setEditando] = useState(false);
  const [mostrarEmoji, setMostrarEmoji] = useState(false);

  // Carrega mensagens do grupo e marca como lida
  useEffect(() => {
    const ref = database.ref(`/conversas/${grupo.id}/mensagens`);
    ref.on('value', snap => {
      const dados = snap.val() || {};
      const arr = Object.entries(dados).map(([id, msg]) => ({ id, ...msg }));
      setListaMensagens(arr);

      // Marcar como lida as mensagens que ainda não foram marcadas para este usuário
      arr.forEach(msg => {
        if (
          msg.idAutor !== usuario.id &&
          (!msg.lidoPor || !msg.lidoPor[usuario.id])
        ) {
          database.ref(`/conversas/${grupo.id}/mensagens/${msg.id}/lidoPor/${usuario.id}`).set(true);
        }
      });
    });
    return () => ref.off();
  }, [grupo.id, usuario.id]);

  // Carrega info do grupo em tempo real
  useEffect(() => {
    const ref = database.ref(`/conversas/${grupo.id}/info`);
    ref.on('value', snap => {
      const info = snap.val() || {};
      setInfoGrupo(info);
      setNovoNomeGrupo(info.nomeGrupo || '');
      setNovaFotoGrupo(info.fotoGrupo || null);
    });
    return () => ref.off();
  }, [grupo.id]);

  async function enviarMensagem() {
    if (!mensagem.trim()) return;
    const novaRef = database.ref(`/conversas/${grupo.id}/mensagens`).push();
    await novaRef.set({
      conteudo: mensagem,
      idAutor: usuario.id,
      nomeAutor: usuario.apelido,
      horario: Date.now(),
      status: 'enviada'
    });
    setMensagem('');
  }

  async function escolherNovaFoto() {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!resultado.canceled && resultado.assets && resultado.assets.length > 0) {
      setNovaFotoGrupo(resultado.assets[0].uri);
    }
  }

  async function salvarEdicaoGrupo() {
    setEditando(true);
    let urlFoto = infoGrupo.fotoGrupo || null;
    if (novaFotoGrupo && novaFotoGrupo !== infoGrupo.fotoGrupo && !novaFotoGrupo.startsWith('http')) {
      const response = await fetch(novaFotoGrupo);
      const blob = await response.blob();
      const refFoto = storage.ref().child(`fotosGrupo/${Date.now()}_${usuario.id}.jpg`);
      await refFoto.put(blob);
      urlFoto = await refFoto.getDownloadURL();
    }
    await database.ref(`/conversas/${grupo.id}/info`).update({
      nomeGrupo: novoNomeGrupo,
      fotoGrupo: urlFoto
    });
    setEditando(false);
    setModalEditarGrupo(false);
    setFeedback('Grupo atualizado!');
    setTimeout(() => setFeedback(''), 2000);
  }

  async function removerMembro(idMembro, nome) {
    if (idMembro === usuario.id) return;
    Alert.alert(
      'Remover membro',
      `Deseja remover ${nome} do grupo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            const novosParticipantes = infoGrupo.participantes.filter(pid => pid !== idMembro);
            const idxsRemover = [];
            infoGrupo.participantes.forEach((pid, idx) => {
              if (pid === idMembro) idxsRemover.push(idx);
            });
            const novosNomes = infoGrupo.nomes.filter((n, idx) => !idxsRemover.includes(idx));
            await database.ref(`/conversas/${grupo.id}/info`).update({
              participantes: novosParticipantes,
              nomes: novosNomes
            });
            setFeedback('Membro removido!');
            setTimeout(() => setFeedback(''), 2000);
          }
        }
      ]
    );
  }

  // Pauzinhos igual Mensagens.js, só mostra ✔✔ se todos (menos o autor) leram
  function renderizarStatus(item) {
    if (item.idAutor !== usuario.id) return null;
    const totalParticipantes = infoGrupo.participantes ? infoGrupo.participantes.length : 2;
    const lidoPor = item.lidoPor ? Object.keys(item.lidoPor).filter(id => id !== usuario.id).length : 0;
    if (lidoPor >= totalParticipantes - 1 && totalParticipantes > 1) {
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
    return (
      <View style={[
        estilos.linhaMensagem,
        item.idAutor === usuario.id ? estilos.mensagemDireita : estilos.mensagemEsquerda
      ]}>
        <View style={[
          estilos.card,
          { backgroundColor: item.idAutor === usuario.id ? '#bbbbbb' : '#232323' }
        ]}>
          <Text style={[estilos.autor, { color: '#2196f3' }]}>
            {item.nomeAutor}
          </Text>
          <Text style={{ color: item.idAutor === usuario.id ? '#181818' : '#fff' }}>
            {item.conteudo}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text style={estilos.horario}>
              {new Date(item.horario).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {renderizarStatus(item)}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#181818' }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={voltar} />
        {infoGrupo.fotoGrupo ? (
          <Image source={{ uri: infoGrupo.fotoGrupo }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 8, backgroundColor: '#444' }} />
        ) : (
          <Avatar.Icon size={36} icon="account-group" style={{ backgroundColor: '#444', marginRight: 8 }} />
        )}
        <Appbar.Content title={infoGrupo.nomeGrupo || 'Grupo'} />
        {infoGrupo.admin === usuario.id && (
          <Appbar.Action icon="pencil" color="#2196f3" onPress={() => setModalEditarGrupo(true)} />
        )}
      </Appbar.Header>
      <FlatList
        data={listaMensagens.sort((a, b) => a.horario - b.horario)}
        renderItem={renderizarItem}
        keyExtractor={item => item.id}
        style={{ flex: 1, padding: 10 }}
        contentContainerStyle={{ paddingBottom: 80 }}
      />
      <View style={estilos.rodape}>
        <IconButton
          icon="emoticon-outline"
          size={28}
          onPress={() => setMostrarEmoji(!mostrarEmoji)}
        />
        <TextInput
          label="Mensagem"
          value={mensagem}
          onChangeText={setMensagem}
          style={estilos.input}
          theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
        />
        <Button
          mode="contained"
          onPress={enviarMensagem}
          style={estilos.botao}
          buttonColor="#2196f3"
          labelStyle={{ color: "#fff" }}
        >
          Enviar
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
        <Dialog visible={modalEditarGrupo} onDismiss={() => setModalEditarGrupo(false)}>
          <Dialog.Title>Editar Grupo</Dialog.Title>
          <Dialog.Content>
            <TouchableOpacity onPress={escolherNovaFoto} style={{ alignSelf: 'center', marginBottom: 12 }}>
              {novaFotoGrupo ? (
                <Image source={{ uri: novaFotoGrupo }} style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#444' }} />
              ) : (
                <Avatar.Icon size={70} icon="account-group" style={{ backgroundColor: '#444' }} />
              )}
              <Text style={{ color: '#2196f3', marginTop: 4, textAlign: 'center' }}>Alterar foto do grupo</Text>
            </TouchableOpacity>
            <TextInput
              label="Nome do grupo"
              value={novoNomeGrupo}
              onChangeText={setNovoNomeGrupo}
              style={estilos.campo}
              theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
            />
            <Text style={{ color: '#bbb', marginTop: 8, marginBottom: 4 }}>Membros:</Text>
            {infoGrupo.participantes && infoGrupo.nomes && infoGrupo.participantes.map((pid, idx) => (
              <View key={pid} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: pid === infoGrupo.admin ? '#2196f3' : '#fff', flex: 1 }}>
                  {infoGrupo.nomes[idx]} {pid === infoGrupo.admin ? '(admin)' : ''}
                </Text>
                {infoGrupo.admin === usuario.id && pid !== usuario.id && (
                  <IconButton icon="account-remove" color="#f44336" size={20} onPress={() => removerMembro(pid, infoGrupo.nomes[idx])} />
                )}
              </View>
            ))}
            {feedback ? <Text style={{ color: '#2196f3', marginTop: 8 }}>{feedback}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setModalEditarGrupo(false)} color="#2196f3">Fechar</Button>
            <Button onPress={salvarEdicaoGrupo} color="#2196f3" loading={editando}>Salvar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const estilos = StyleSheet.create({
  rodape: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  input: { flex: 1, marginRight: 8, backgroundColor: '#232323' },
  botao: { alignSelf: 'center', backgroundColor: '#2196f3' },
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
  autor: { fontWeight: 'bold', marginBottom: 2, fontSize: 13 },
  horario: { fontSize: 10, marginTop: 4, textAlign: 'right', color: '#bbb' },
  campo: { marginBottom: 10, backgroundColor: '#232323' },
  statusLido: { color: '#2196f3', fontSize: 14, marginLeft: 4 },
  statusEnviado: { color: '#888', fontSize: 14, marginLeft: 4 }
});