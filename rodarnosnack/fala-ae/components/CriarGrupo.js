import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { TextInput, Button, Text, Checkbox, Snackbar, Avatar } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { database, storage } from '../config/Firebase';

export default function CriarGrupo({ usuarioAtual, aoVoltar }) {
  const [nomeGrupo, setNomeGrupo] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [visivel, setVisivel] = useState(false);
  const [fotoGrupo, setFotoGrupo] = useState(null);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    const ref = database.ref('/usuarios');
    ref.once('value').then(snap => {
      const dados = snap.val() || {};
      const lista = Object.entries(dados)
        .filter(([id, u]) => id !== usuarioAtual.id)
        .map(([id, u]) => ({ id, apelido: u.apelido }));
      setUsuarios(lista);
    });
  }, [usuarioAtual.id]);

  function toggleSelecionado(id) {
    setSelecionados(sel =>
      sel.includes(id) ? sel.filter(i => i !== id) : [...sel, id]
    );
  }

  async function escolherFotoGrupo() {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!resultado.canceled && resultado.assets && resultado.assets.length > 0) {
      setFotoGrupo(resultado.assets[0].uri);
    }
  }

  async function criarGrupo() {
    if (!nomeGrupo.trim() || selecionados.length === 0) {
      setFeedback('Defina um nome e selecione pelo menos 1 contato!');
      setVisivel(true);
      return;
    }
    setProcessando(true);
    let urlFotoGrupo = null;

    // Upload da foto do grupo se houver
    if (fotoGrupo && !fotoGrupo.startsWith('http')) {
      const response = await fetch(fotoGrupo);
      const blob = await response.blob();
      const refFoto = storage.ref().child(`fotosGrupo/${Date.now()}_${usuarioAtual.id}.jpg`);
      await refFoto.put(blob);
      urlFotoGrupo = await refFoto.getDownloadURL();
    }

    const participantes = [usuarioAtual.id, ...selecionados];
    const nomes = [usuarioAtual.apelido, ...usuarios.filter(u => selecionados.includes(u.id)).map(u => u.apelido)];
    const ref = database.ref('/conversas').push();
    await ref.set({
      info: {
        participantes,
        nomes,
        grupo: true,
        nomeGrupo,
        fotoGrupo: urlFotoGrupo || null,
        admin: usuarioAtual.id // salva o admin do grupo
      }
    });
    setFeedback('Grupo criado!');
    setVisivel(true);
    setNomeGrupo('');
    setSelecionados([]);
    setFotoGrupo(null);
    setProcessando(false);
  }

  return (
    <View style={estilos.fundo}>
      <Text style={estilos.titulo}>Criar grupo</Text>
      <TouchableOpacity onPress={escolherFotoGrupo} style={{ alignSelf: 'center', marginBottom: 16 }}>
        {fotoGrupo ? (
          <View style={estilos.avatarContainer}>
            <Image source={{ uri: fotoGrupo }} style={estilos.avatarImage} />
          </View>
        ) : (
          <Avatar.Icon size={90} icon="account-group" style={{ backgroundColor: '#444' }} color="#fff" />
        )}
        <Text style={{ textAlign: 'center', color: '#2196f3', marginTop: 4 }}>Selecionar foto do grupo</Text>
      </TouchableOpacity>
      <TextInput
        label="Nome do grupo"
        value={nomeGrupo}
        onChangeText={setNomeGrupo}
        style={estilos.campo}
        theme={{
          colors: {
            text: '#fff',
            primary: '#2196f3',
            placeholder: '#bbb',
            background: '#232323'
          }
        }}
      />
      <Text style={{ marginBottom: 8, color: '#bbb' }}>Selecione participantes:</Text>
      <FlatList
        data={usuarios}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={estilos.linha}>
            <Checkbox
              status={selecionados.includes(item.id) ? 'checked' : 'unchecked'}
              onPress={() => toggleSelecionado(item.id)}
              color="#2196f3"
              uncheckedColor="#888"
            />
            <Text style={{ color: '#fff' }}>{item.apelido}</Text>
          </View>
        )}
        style={{ maxHeight: 200 }}
      />
      <Button
        mode="contained"
        onPress={criarGrupo}
        loading={processando}
        style={estilos.botao}
        buttonColor="#2196f3"
        labelStyle={{ color: '#fff' }}
      >
        Criar Grupo
      </Button>
      <Button
        onPress={aoVoltar}
        style={estilos.botaoSecundario}
        buttonColor="#232323"
        labelStyle={{ color: '#fff' }}
      >
        Voltar
      </Button>
      <Snackbar
        visible={visivel}
        onDismiss={() => setVisivel(false)}
        duration={2000}
        style={{ backgroundColor: '#232323' }}
        theme={{ colors: { accent: '#2196f3' } }}
      >
        <Text style={{ color: '#fff' }}>{feedback}</Text>
      </Snackbar>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'center', padding: 30, backgroundColor: '#181818' },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 18, textAlign: 'center', color: '#fff' },
  campo: { marginBottom: 10, backgroundColor: '#232323' },
  linha: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  botao: { marginBottom: 8, backgroundColor: '#2196f3' },
  botaoSecundario: { marginBottom: 8, backgroundColor: '#232323' },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#444'
  }
});