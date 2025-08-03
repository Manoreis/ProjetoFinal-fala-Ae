import React, { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { TextInput, Button, Text, Snackbar } from 'react-native-paper';
import { database, auth } from '../config/Firebase';

export default function Cadastro({ aoCadastrar, voltarLogin }) {
  const [apelido, setApelido] = useState('');
  const [email, setEmail] = useState('');
  const [chave, setChave] = useState('');
  const [feedback, setFeedback] = useState('');
  const [visivel, setVisivel] = useState(false);
  const [processando, setProcessando] = useState(false);

  async function registrar() {
    try {
      if (!apelido || !email || !chave) {
        setFeedback('Preencha todos os campos!');
        setVisivel(true);
        return;
      }
      if (chave.length < 4) {
        setFeedback('A senha precisa de pelo menos 4 dígitos.');
        setVisivel(true);
        return;
      }
      setProcessando(true);

      // Busca todos os apelidos e compara ignorando maiúsculas/minúsculas
      const todosUsuarios = await database.ref('/usuarios').once('value');
      let apelidoExiste = false;
      if (todosUsuarios.exists()) {
        todosUsuarios.forEach(child => {
          if (
            child.val().apelido &&
            child.val().apelido.toLowerCase() === apelido.toLowerCase()
          ) {
            apelidoExiste = true;
          }
        });
      }
      if (apelidoExiste) {
        setFeedback('Esse nome já está em uso.');
        setVisivel(true);
        setProcessando(false);
        return;
      }

      // Cria usuário no Auth
      await auth.createUserWithEmailAndPassword(email, chave);

      // Salva usuário no banco
      const novo = database.ref('/usuarios').push();
      await novo.set({
        apelido,
        email
      });

      setFeedback('Cadastro realizado!');
      setVisivel(true);
      setProcessando(false);
      aoCadastrar({ id: novo.key, apelido, email });
    } catch (e) {
      setFeedback('Erro ao registrar: ' + e.message);
      setVisivel(true);
      setProcessando(false);
      console.log('Erro ao registrar:', e);
    }
  }

  function limparCampos() {
    setApelido('');
    setEmail('');
    setChave('');
  }

  return (
    <View style={estilos.fundo}>
      <View style={estilos.logoContainer}>
        <Image
          source={require('../assets/logo.png')}
          style={estilos.logo}
          resizeMode="contain"
        />
      </View>
      <Text style={estilos.titulo}>Criar nova conta</Text>
      <TextInput
        label="Nome de usuário"
        value={apelido}
        onChangeText={setApelido}
        style={estilos.campo}
        autoCapitalize="none"
        mode="outlined"
        theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
      />
      <TextInput
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        style={estilos.campo}
        autoCapitalize="none"
        keyboardType="email-address"
        mode="outlined"
        theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
      />
      <TextInput
        label="Senha"
        value={chave}
        onChangeText={setChave}
        secureTextEntry
        style={estilos.campo}
        mode="outlined"
        theme={{ colors: { text: '#fff', primary: '#2196f3', placeholder: '#bbb', background: '#232323' } }}
      />
      <Button mode="contained" onPress={registrar} loading={processando} style={estilos.botao} buttonColor="#2196f3" labelStyle={{ color: '#fff' }}>
        Registrar
      </Button>
      <Button mode="contained" onPress={limparCampos} style={estilos.botaoSecundario} buttonColor="#232323" labelStyle={{ color: '#fff' }}>
        Limpar
      </Button>
      <Button mode="contained" onPress={voltarLogin} style={estilos.botaoSecundario} buttonColor="#232323" labelStyle={{ color: '#fff' }}>
        Voltar para login
      </Button>
      <Snackbar
        visible={visivel}
        onDismiss={() => setVisivel(false)}
        duration={2000}
        style={{ backgroundColor: '#232323' }}
        theme={{ colors: { onSurface: '#fff' } }}
      >
        <Text style={{ color: '#fff' }}>{feedback}</Text>
      </Snackbar>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'center', padding: 30, backgroundColor: '#181818' },
  logoContainer: { alignItems: 'center', marginBottom: 60, flexDirection: 'row', justifyContent: 'center' },
  logo: { width: 150, height: 150, marginRight: 8 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 18, textAlign: 'center', color: '#fff' },
  campo: { marginBottom: 10, backgroundColor: '#232323' },
  botao: { marginBottom: 8, backgroundColor: '#2196f3' },
  botaoSecundario: { marginBottom: 8, backgroundColor: '#232323' }
});