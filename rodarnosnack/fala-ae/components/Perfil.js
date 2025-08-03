import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { TextInput, Button, Text, Snackbar, Avatar } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { database, storage } from '../config/Firebase';

export default function Perfil({ usuario, aoVoltar }) {
  const [apelido, setApelido] = useState(usuario.apelido);
  const [sobre, setSobre] = useState(usuario.sobre || '');
  const [status, setStatus] = useState(usuario.status || '');
  const [foto, setFoto] = useState(usuario.fotoUrl || null);
  const [feedback, setFeedback] = useState('');
  const [visivel, setVisivel] = useState(false);
  const [processando, setProcessando] = useState(false);

  async function escolherFoto() {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!resultado.canceled && resultado.assets && resultado.assets.length > 0) {
      setFoto(resultado.assets[0].uri);
    }
  }

  async function salvarPerfil() {
    setProcessando(true);
    let urlFoto = foto;
    try {
      if (foto && foto !== usuario.fotoUrl && !foto.startsWith('http')) {
        const response = await fetch(foto);
        const blob = await response.blob();
        const ref = storage.ref().child(`fotosPerfil/${usuario.id}.jpg`);
        await ref.put(blob);
        urlFoto = await ref.getDownloadURL();
      }
      await database.ref(`/usuarios/${usuario.id}`).update({
        apelido,
        sobre,
        status,
        fotoUrl: urlFoto
      });
      setFeedback('Perfil atualizado!');
    } catch (e) {
      setFeedback('Erro ao salvar perfil');
    }
    setVisivel(true);
    setProcessando(false);
  }

  return (
    <View style={estilos.fundo}>
      <Text style={estilos.titulo}>Meu Perfil</Text>
      <TouchableOpacity onPress={escolherFoto} style={{ alignSelf: 'center', marginBottom: 16 }}>
        {foto ? (
          <View style={estilos.avatarContainer}>
            <Image
              source={{ uri: foto }}
              style={estilos.avatarImage}
            />
          </View>
        ) : (
          <Avatar.Icon
            size={90}
            icon="account"
            style={{ backgroundColor: '#444' }}
            color="#fff"
          />
        )}
        <Text style={{ textAlign: 'center', color: '#2196f3', marginTop: 4 }}>Trocar foto</Text>
      </TouchableOpacity>
      <TextInput
        label="Nome de usuário"
        value={apelido}
        onChangeText={setApelido}
        style={estilos.campo}
        theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
        underlineColor="#2196f3"
        selectionColor="#2196f3"
      />
      <TextInput
        label="Status"
        value={status}
        onChangeText={setStatus}
        style={estilos.campo}
        maxLength={40}
        theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
        underlineColor="#2196f3"
        selectionColor="#2196f3"
      />
      <TextInput
        label="Sobre mim"
        value={sobre}
        onChangeText={setSobre}
        style={estilos.campo}
        multiline
        theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
        underlineColor="#2196f3"
        selectionColor="#2196f3"
      />
      <Button mode="contained" onPress={salvarPerfil} loading={processando} style={estilos.botao} buttonColor="#2196f3" labelStyle={{ color: '#fff' }}>
        Salvar
      </Button>
      <Button onPress={aoVoltar} style={estilos.botaoSecundario} buttonColor="#232323" labelStyle={{ color: '#fff' }}>
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
  campo: { marginBottom: 10, backgroundColor: '#232323', color: '#fff' },
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